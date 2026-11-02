const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');

test(
  'PY-02 worker, Python, Node receipts and PostgreSQL accounting',
  { skip: process.env.PY02_INTEGRATION !== '1', timeout: 90000 },
  async (t) => {
    const target = new URL(process.env.AI_TEST_DATABASE_URL || 'http://invalid');
    assert.equal(target.hostname, '127.0.0.1');
    assert.match(target.pathname, /^\/ai_lab_be01_(fresh|upgrade)_[a-f0-9]+$/);
    const live = process.env.PY02_LIVE_SMOKE === '1';
    Object.assign(process.env, {
      DATABASE_URL: target.toString(),
      NODE_ENV: 'test',
      LAB_AI_MODE: 'deterministic',
      AI_WORKER_MODE: 'python-gemini',
      AI_ENVIRONMENT: 'py02',
      AI_RECOVERY_EPOCH: 'epoch_py02',
      AI_OWNER_SECRET: 'synthetic-owner-py02-at-least-32-characters',
      AI_SERVICE_SECRET: 'synthetic-service-py02-at-least-32-characters',
    });
    const express = require('express');
    const engine = require('@ccna/shared/simulation/networkEngine');
    const { getPrisma, disconnectDatabase } = require('../../backend/src/config/database');
    const { runtimeConfig } = require('./workerConfig');
    const { service } = require('./requests');
    const { publicMetadata } = require('./snapshot');
    const { createWorker } = require('../workers/aiWorker');
    const { pythonAnalyze } = require('./pythonTransport');
    const budget = require('./localGeminiBudget');
    const { labs } = require('../fixtures/labs/disc03');
    const db = getPrisma();
    const config = runtimeConfig();
    config.ownerSecret = process.env.AI_OWNER_SECRET;
    const api = service(db, config);
    const app = express();
    app.use('/internal/v1/ai', require('../routes/aiInternal')(db, config));
    const server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ccna-py02-integration-'));
    const children = [];
    const reports = [];
    async function python(mode, vendor) {
      const portServer = net.createServer();
      await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve));
      const port = portServer.address().port;
      await new Promise((resolve) => portServer.close(resolve));
      const env = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('AI_PYTHON_'))
      );
      Object.assign(env, {
        AI_PYTHON_MODE: mode,
        AI_PYTHON_ENVIRONMENT: mode === 'gemini' ? 'local' : 'test',
        AI_PYTHON_LIVE_ENABLED: mode === 'gemini' ? 'true' : 'false',
        AI_PYTHON_PORT: String(port),
        AI_PYTHON_NODE_URL: `http://127.0.0.1:${server.address().port}/internal/v1/ai`,
        GEMINI_API_KEY: live
          ? process.env.GEMINI_API_KEY
          : 'synthetic-py02-key-never-used-with-vendor',
        PY02_VENDOR_MODE: vendor,
      });
      const root = path.resolve(__dirname, '../../..');
      const project = path.join(root, 'src/agent/python');
      env.PYTHONPATH = project;
      const executable =
        process.env.PY02_PYTHON ||
        path.join(
          project,
          '.venv',
          process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
        );
      const child = spawn(executable, ['tests/fixtures/run_service.py'], {
        cwd: project,
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let log = '';
      child.stdout.on('data', (chunk) => {
        log += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        log += chunk.toString();
      });
      children.push(child);
      const base = `http://127.0.0.1:${port}`;
      const getLog = () => log;
      for (let n = 0; n < 120; n++) {
        assert.equal(
          child.exitCode,
          null,
          'Python service exited; inspect its safe startup configuration'
        );
        try {
          if ((await fetch(base + '/health/ready')).ok) return { base, child, log: getLog };
        } catch {
          /* Startup not ready. */
        }
        await delay(50);
      }
      throw new Error('Python service failed to become ready');
    }
    try {
      const user = await db.user.create({
        data: {
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'not-real',
          fullName: 'ACTOR_SECRET_PY02',
        },
      });
      const fixture = labs[0];
      const lab = await db.lab.create({
        data: {
          title: fixture.title,
          objective: fixture.objective,
          labType: 'CLI_SIMULATION',
          status: 'PUBLISHED',
          initialState: fixture.initialState,
          gradingSpec: fixture.gradingSpec,
        },
      });
      const modes = live
        ? [['gemini', 'good']]
        : [
            ['gemini', 'good'],
            ['gemini', 'invalid-output'],
            ['gemini', 'overlong-output'],
            ['gemini', 'missing-usage'],
            ['gemini', '429'],
          ];
      for (const [mode, vendor] of modes) {
        await t.test(`${mode}/${vendor}${live ? ' live' : ''}`, async () => {
          const providerId = 'local-gemini-v1';
          const provider = config.providers[providerId];
          if (mode === 'gemini' && !live) {
            const file = path.join(directory, `budget-${vendor}.json`);
            budget.initializeBudget(file);
            provider.localLedgerFile = file;
          }
          const limits = {
            userMinute: 100,
            userDay: 100,
            globalDayMicros: 50000,
            globalMonthMicros: 100000,
            maxCostMicros: 5800,
            globalConcurrency: 2,
            versions: { ...provider.versions, appCommit: '0'.repeat(40) },
          };
          await db.aiRuntimePolicy.upsert({
            where: { environment: 'py02' },
            create: {
              environment: 'py02',
              admissionEnabled: true,
              dispatchEnabled: true,
              providerConfigId: providerId,
              limits,
              eligibilityRules: { userIds: [user.id], labIds: [lab.id] },
            },
            update: {
              admissionEnabled: true,
              dispatchEnabled: true,
              providerConfigId: providerId,
              limits,
            },
          });
          const attempt = await db.labAttempt.create({
            data: {
              userId: user.id,
              labId: lab.id,
              simulatorVersion: fixture.simulatorVersion,
              deviceState: engine.initial(fixture.initialState),
              definition: { ...fixture, privateRubric: 'PRIVATE_RUBRIC_PY02' },
              publicMetadata: publicMetadata(lab, fixture),
              publicMetadataProvenance: 'CAPTURED_AT_ATTEMPT_START',
              publicMetadataCapturedAt: new Date(),
              members: [],
            },
          });
          const response = await api.create(
            { id: user.id, sessionVersion: user.sessionVersion },
            attempt.id,
            {
              contractVersion: '1.0.0',
              clientRequestId: randomUUID(),
              intent: 'EXPLAIN_CONCEPT',
              message:
                'Giải thích ngắn vì sao gói trả lời cần đường về. Chỉ giải thích khái niệm, không kết luận bài đã đúng và không viết lệnh.',
              expectedRevision: 0,
              conversationEpoch: 0,
              recoveryEpoch: 'epoch_py02',
            }
          );
          const peer = await python(mode, vendor);
          const send = pythonAnalyze(peer.base + '/internal/v1/lab-assistant/analyze');
          let captured;
          let tokens;
          const errors = [];
          const worker = createWorker(db, config, {
            workerId: 'py02_worker',
            analyze: async (input, scoped) => {
              captured = structuredClone(input);
              tokens = scoped;
              return send(input, scoped);
            },
            onError: (error) => errors.push(error.code || error.message),
          });
          await worker.tick();
          const row = await db.aiRequest.findUniqueOrThrow({
            where: { id: response.data.requestId },
          });
          const call = await db.aiProviderCall.findUnique({
            where: { requestId_stepIndex: { requestId: row.id, stepIndex: 0 } },
          });
          const report = {
            mode,
            vendor,
            live,
            status: row.status,
            responseMode: row.responseMode,
            callState: call?.state,
            usageStatus: call?.usageStatus,
            inputTokens: call?.inputTokens,
            outputTokens: call?.outputTokens,
            reasoningTokens: call?.reasoningTokens,
            costMicros: call?.costMicros?.toString() ?? null,
            finishReason: call?.finishReason,
            errors,
          };
          reports.push(report);
          if (process.env.PY02_EVIDENCE_FILE)
            fs.writeFileSync(process.env.PY02_EVIDENCE_FILE, JSON.stringify(reports, null, 2));
          if (live) {
            assert.equal(row.status, 'COMPLETED', JSON.stringify(report));
            assert.equal(row.responseMode, 'LLM');
            assert.equal(call.usageStatus, 'FINAL');
            assert.ok(call.costMicros > 0n && call.costMicros <= 5800n);
          } else {
            const success = vendor === 'good' || vendor === 'missing-usage';
            assert.equal(row.status, success ? 'COMPLETED' : 'FAILED', JSON.stringify(report));
            if (mode === 'gemini' && ['good', 'invalid-output', 'overlong-output'].includes(vendor))
              assert.equal(call.costMicros, 136n);
            if (['missing-usage', '429'].includes(vendor)) assert.equal(call.costMicros, null);
            if (vendor === 'invalid-output') {
              assert.equal(call.receiptPayload, null);
              assert.equal(call.suppressionReason, 'FAILED');
              assert.equal(
                await db.aiEventOutbox.count({
                  where: {
                    type: 'AI_OUTPUT_REJECTED',
                    payload: { path: ['callId'], equals: call.id },
                  },
                }),
                1
              );
              assert.equal(
                await db.aiMessage.count({ where: { requestId: row.id, role: 'ASSISTANT' } }),
                0
              );
            }
            if (vendor === 'overlong-output') {
              assert.equal(call.state, 'KNOWN_FAILURE');
              assert.equal(call.finishReason, 'INVALID_OUTPUT');
              assert.equal(call.receiptPayload, null);
              assert.equal(call.usageStatus, 'FINAL');
              assert.equal(
                await db.aiMessage.count({ where: { requestId: row.id, role: 'ASSISTANT' } }),
                0
              );
            }
            if (mode === 'gemini') {
              const ledger = budget.readBudget(provider.localLedgerFile);
              assert.equal(ledger.calls.length, 1);
              assert.equal(ledger.calls[0].callId, call.id);
            }
            if (mode === 'gemini' && vendor === 'good') {
              const duplicatePeer = await python(mode, vendor);
              const duplicate = await fetch(
                duplicatePeer.base + '/internal/v1/lab-assistant/analyze',
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${tokens.analyzeToken}`,
                    'X-AI-Claim-Token': tokens.claimToken,
                    'X-AI-Receipt-Token': tokens.receiptToken,
                    'X-AI-Contract-Version': '1.0.0',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(captured),
                }
              );
              assert.equal(duplicate.status, 409);
              assert.equal(
                (await (await fetch(duplicatePeer.base + '/test/stats')).json()).generateContent,
                0
              );
              assert.equal(
                (await (await fetch(peer.base + '/test/stats')).json()).generateContent,
                1
              );
            }
          }
          assert.doesNotMatch(peer.log(), /PRIVATE_RUBRIC_PY02|ACTOR_SECRET_PY02|Bearer /);
        });
      }
    } finally {
      for (const child of children) {
        if (child.exitCode === null) {
          if (process.platform === 'win32') {
            await new Promise((resolve) => {
              const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
                windowsHide: true,
                stdio: 'ignore',
              });
              killer.once('exit', resolve);
            });
          } else child.kill('SIGTERM');
        }
      }
      await new Promise((resolve) => server.close(resolve));
      await disconnectDatabase();
    }
  }
);
