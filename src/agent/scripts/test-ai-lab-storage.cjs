// Isolated migration runner; never imports the app, dotenv or provider modules.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { Client } = require('pg');

const root = path.resolve(__dirname, '../../..');
const backendRequire = createRequire(path.join(root, 'src/backend/package.json'));
const prismaEntry = require.resolve('prisma/build/index.js');
const configFile = path.join(root, 'src/agent/prisma/test.config.ts');
const schema = path.join(root, 'src/backend/prisma/schema.prisma');
const migrations = path.join(root, 'src/backend/prisma/migrations');
const fixtures = path.join(root, 'src/agent/node/fixtures');
const baseline = require('../node/fixtures/pre-be01-migrations.json');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
const created = new Map();

function prisma(args, env) {
  try {
    return execFileSync(process.execPath, [prismaEntry, ...args, '--config', configFile], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 90000,
      env: { ...process.env, ...env, LAB_AI_MODE: 'deterministic' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // Prisma receives the URL through environment only, never command arguments.
    const out = `${error.stdout || ''}${error.stderr || ''}`;
    throw new Error(`Isolated Prisma ${args[0]} failed (${error.status}): ${out}`);
  }
}

async function adminConnection() {
  let url;
  let record;
  if (process.env.AI_TEST_ADMIN_URL) {
    assert.equal(process.env.CI, 'true', 'Admin override is reserved for the dedicated CI service');
    url = new URL(process.env.AI_TEST_ADMIN_URL);
    assert.equal(url.pathname, '/postgres');
    assert.equal(url.port, '5432');
  } else {
    record = JSON.parse(
      fs.readFileSync(path.join(root, '.tmp/ai-lab-local/connection.json'), 'utf8')
    );
    url = new URL(record.databaseUrl);
    assert.equal(url.pathname, '/ai_lab_local');
    assert.equal(url.port, '55432');
    assert.equal(url.username, 'ai_lab_local');
    assert.ok(
      record.clusterId && record.dataDirectory,
      'Run ai:db:start to verify the owned cluster'
    );
  }
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1', 'Loopback only; no remote database fallback');
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  await client.connect();
  const {
    rows: [identity],
  } = await client.query(`SELECT current_database() AS db,
    host(inet_server_addr()) AS host, inet_server_port() AS port,
    current_setting('data_directory') AS directory,
    (SELECT system_identifier::text FROM pg_control_system()) AS id`);
  assert.equal(identity.db, url.pathname.slice(1));
  assert.equal(identity.port, Number(url.port));
  if (record) {
    assert.equal(identity.host, '127.0.0.1');
    assert.equal(identity.id, record.clusterId);
    assert.equal(
      path.resolve(identity.directory).toLowerCase(),
      record.dataDirectory.toLowerCase()
    );
  }
  return { client, url };
}

async function createDatabase(admin, url, name) {
  assert.match(name, /^ai_lab_be01_(fresh|upgrade)_[a-f0-9]+$/);
  await admin.query(`CREATE DATABASE ${quote(name)}`);
  const {
    rows: [row],
  } = await admin.query('SELECT oid FROM pg_database WHERE datname=$1', [name]);
  created.set(name, row.oid);
  const target = new URL(url);
  target.pathname = `/${name}`;
  return target.toString();
}

async function fingerprint(url, columns) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    if (!columns) {
      columns = {};
      const { rows } =
        await client.query(`SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name <> '_prisma_migrations' ORDER BY table_name, ordinal_position`);
      for (const row of rows) (columns[row.table_name] ||= []).push(row.column_name);
    }
    const tables = {};
    for (const [table, fields] of Object.entries(columns)) {
      const { rows } = await client.query(`SELECT row_to_json(t) AS row FROM
        (SELECT ${fields.map(quote).join(',')} FROM ${quote(table)}) AS t`);
      const values = rows.map((r) => JSON.stringify(r.row)).sort();
      tables[table] = { count: values.length, hash: hash(JSON.stringify(values)) };
    }
    return { columns, tables };
  } finally {
    await client.end();
  }
}

async function seedLegacy(url, legacyDirectory) {
  const { PrismaClient } = require(legacyDirectory);
  const { PrismaPg } = backendRequire('@prisma/adapter-pg');
  const legacy = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const now = new Date();
  const future = new Date(now.getTime() + 86400000);
  try {
    const user = await legacy.user.create({
      data: {
        email: 'be01-synthetic@example.invalid',
        fullName: 'BE01 synthetic',
        passwordHash: 'not-a-real-password-hash',
        role: 'ADMIN',
      },
    });
    const course = await legacy.course.create({
      data: { id: 'be01', code: 'BE01', title: 'Synthetic course' },
    });
    const module = await legacy.module.create({
      data: { id: 'be01m', courseId: course.id, title: 'Synthetic module', orderIndex: 1 },
    });
    const lesson = await legacy.lesson.create({
      data: { moduleId: module.id, title: 'Synthetic lesson', orderIndex: 1 },
    });
    const lab = await legacy.lab.create({
      data: {
        title: 'BE01 synthetic lab',
        labType: 'CLI_SIMULATION',
        courseId: course.id,
        moduleId: module.id,
        simulatorVersion: '1.0.0',
        initialState: { devices: {} },
      },
    });
    const attempt = await legacy.labAttempt.create({
      data: {
        userId: user.id,
        labId: lab.id,
        simulatorVersion: '1.0.0',
        deviceState: { revision: 0, devices: {} },
        definition: { synthetic: true },
        score: 0,
        feedback: { checks: [] },
      },
    });
    await legacy.labCommand.create({
      data: {
        attemptId: attempt.id,
        sequence: 1,
        command: 'enable',
        mode: 'USER_EXEC',
        prompt: 'Router>',
        action: { type: 'command', deviceId: 'R1', command: 'enable' },
      },
    });
    const exam = await legacy.exam.create({
      data: {
        title: 'Synthetic exam',
        totalQuestions: 1,
        durationMinutes: 5,
        courseId: course.id,
        moduleId: module.id,
      },
    });
    await legacy.examQuestion.create({
      data: {
        examId: exam.id,
        question: 'Synthetic?',
        options: ['A', 'B'],
        correctAnswer: [0],
        orderIndex: 1,
      },
    });
    const examAttempt = await legacy.examAttempt.create({
      data: {
        userId: user.id,
        examId: exam.id,
        examSnapshot: { synthetic: true },
        expiresAt: future,
      },
    });
    await legacy.examResult.create({
      data: {
        userId: user.id,
        examId: exam.id,
        attemptId: examAttempt.id,
        score: 1,
        totalQuestions: 1,
        percentage: '100.00',
        isPassed: true,
        answers: [0],
        timeSpent: 10,
      },
    });
    await legacy.courseTopic.create({ data: { courseId: course.id, title: 'Synthetic topic' } });
    await legacy.refreshToken.create({
      data: { userId: user.id, token: 'synthetic-refresh-only', expiresAt: future },
    });
    await legacy.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash('synthetic-reset'), expiresAt: future },
    });
    await legacy.userProgress.create({
      data: {
        userId: user.id,
        courseId: course.id,
        moduleId: module.id,
        lessonId: lesson.id,
        labId: lab.id,
      },
    });
    await legacy.resource.create({
      data: { title: 'Synthetic resource', type: 'DOCUMENT', courseId: course.id },
    });
    await legacy.userBadge.create({ data: { userId: user.id, badgeName: 'Synthetic badge' } });
    await legacy.userActivity.create({
      data: { userId: user.id, title: 'Synthetic activity', type: 'TEST' },
    });
    await legacy.userNote.create({
      data: { userId: user.id, lessonId: lesson.id, content: 'Synthetic note' },
    });
    await legacy.adminLog.create({
      data: { adminId: user.id, action: 'TEST', targetTable: 'labs' },
    });
    await legacy.tool.create({ data: { title: 'Synthetic tool' } });
    await legacy.questionBank.create({
      data: { title: 'Synthetic bank', type: 'TEST', content: 'Synthetic content' },
    });
    await legacy.videoProgress.create({
      data: { userId: user.id, lessonId: lesson.id, watchedSeconds: 1 },
    });
    await legacy.videoProgressSession.create({
      data: {
        userId: user.id,
        lessonId: lesson.id,
        sessionId: crypto.randomUUID(),
        startedAt: now,
        lastSequence: 1,
        lastCapturedAt: now,
      },
    });
    await legacy.studyLog.create({ data: { userId: user.id, duration: 1 } });
    return { user, lab, attempt };
  } finally {
    await legacy.$disconnect();
  }
}

async function legacyCompatibility(url, legacyDirectory, records) {
  const { PrismaClient } = require(legacyDirectory);
  const { PrismaPg } = backendRequire('@prisma/adapter-pg');
  const { withAttempt } = require('../../backend/src/simulation/attemptAccess');
  const legacy = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const read = await legacy.labAttempt.findUniqueOrThrow({
      where: { id: records.attempt.id },
      include: { lab: true, commands: true },
    });
    assert.equal(read.commands.length, 1);
    assert.equal(read.lab.title, records.lab.title);
    assert.equal(
      'feedbackRevision' in read,
      false,
      'Frozen client must remain the pre-BE-01 client'
    );
    assert.doesNotThrow(() => JSON.stringify(read));
    await withAttempt(legacy, records.attempt.id, records.user.id, (tx) =>
      tx.labAttempt.update({
        where: { id: records.attempt.id },
        data: { score: 10, feedback: { checks: [], legacyClient: true } },
      })
    );
    const createdAttempt = await legacy.labAttempt.create({
      data: {
        userId: records.user.id,
        labId: records.lab.id,
        simulatorVersion: '1.0.0',
        deviceState: { revision: 0 },
      },
    });
    assert.ok(createdAttempt.id);
    console.log(
      'Legacy Prisma client and existing withAttempt read/write/create work after migration.'
    );
  } finally {
    await legacy.$disconnect();
  }
}

async function main() {
  assert.ok(
    process.argv.length === 2,
    'This runner has no destructive reset or arbitrary-URL options'
  );
  for (const [name, checksum] of Object.entries(baseline)) {
    assert.equal(
      hash(fs.readFileSync(path.join(migrations, name, 'migration.sql'))),
      checksum,
      `Historical migration changed: ${name}`
    );
  }
  const suffix = crypto.randomBytes(6).toString('hex');
  const runDirectory = path.join(root, '.tmp/ai-lab-be01', suffix);
  fs.mkdirSync(runDirectory, { recursive: true });
  const oldMigrations = path.join(runDirectory, 'old-migrations');
  fs.mkdirSync(oldMigrations);
  for (const name of Object.keys(baseline)) {
    fs.mkdirSync(path.join(oldMigrations, name));
    fs.copyFileSync(
      path.join(migrations, name, 'migration.sql'),
      path.join(oldMigrations, name, 'migration.sql')
    );
  }
  fs.copyFileSync(
    path.join(migrations, 'migration_lock.toml'),
    path.join(oldMigrations, 'migration_lock.toml')
  );
  const legacyDirectory = path.join(runDirectory, 'legacy-client');
  const oldSchema = path.join(runDirectory, 'legacy.prisma');
  const original = fs.readFileSync(path.join(fixtures, 'pre-be01.prisma'), 'utf8');
  fs.writeFileSync(
    oldSchema,
    original.replace(
      'generator client {',
      `generator client {\n  output = ${JSON.stringify(legacyDirectory.replaceAll('\\', '/'))}`
    )
  );
  const { client: admin, url } = await adminConnection();
  try {
    const fresh = await createDatabase(admin, url, `ai_lab_be01_fresh_${suffix}`);
    const upgrade = await createDatabase(admin, url, `ai_lab_be01_upgrade_${suffix}`);
    const freshEnv = {
      AI_TEST_DATABASE_URL: fresh,
      AI_TEST_SCHEMA: schema,
      AI_TEST_MIGRATIONS: migrations,
    };
    const upgradeEnv = { ...freshEnv, AI_TEST_DATABASE_URL: upgrade };
    prisma(['validate'], freshEnv);
    prisma(['generate'], freshEnv);
    prisma(['generate'], { ...upgradeEnv, AI_TEST_SCHEMA: oldSchema });
    prisma(['migrate', 'deploy'], {
      ...upgradeEnv,
      AI_TEST_SCHEMA: oldSchema,
      AI_TEST_MIGRATIONS: oldMigrations,
    });
    const records = await seedLegacy(upgrade, legacyDirectory);
    const before = await fingerprint(upgrade);
    assert.ok(
      Object.values(before.tables).every((t) => t.count >= 1),
      'Every old domain table must contain synthetic data'
    );
    prisma(['migrate', 'deploy'], freshEnv);
    prisma(['migrate', 'deploy'], upgradeEnv);
    prisma(['migrate', 'deploy'], upgradeEnv); // Re-run is a no-op.
    const after = await fingerprint(upgrade, before.columns);
    assert.deepEqual(after.tables, before.tables);
    console.log(
      `Fresh install and populated upgrade passed; ${Object.keys(before.tables).length} legacy table fingerprints unchanged.`
    );
    for (const env of [freshEnv, upgradeEnv]) {
      try {
        prisma(
          ['migrate', 'diff', '--from-config-datasource', '--to-schema', schema, '--exit-code'],
          env
        );
      } catch (error) {
        const inspection = new Client({ connectionString: env.AI_TEST_DATABASE_URL });
        await inspection.connect();
        try {
          console.error(
            (
              await inspection.query(`SELECT indexname,indexdef FROM pg_indexes
            WHERE schemaname='public' AND indexname IN ('ai_requests_one_active_user','ai_event_outbox_pending_idx')`)
            ).rows
          );
        } finally {
          await inspection.end();
        }
        throw error;
      }
      execFileSync(process.execPath, ['--test', 'src/agent/node/storage.integration.test.js'], {
        cwd: root,
        env: { ...process.env, ...env, LAB_AI_MODE: 'deterministic' },
        stdio: 'inherit',
        windowsHide: true,
        timeout: 90000,
      });
    }
    await legacyCompatibility(upgrade, legacyDirectory, records);
    execFileSync(
      process.execPath,
      [
        '--test',
        '--test-concurrency=1',
        'src/agent/node/access.integration.test.js',
        'src/agent/node/admission.integration.test.js',
        'src/agent/node/worker.integration.test.js',
        'src/agent/node/context.integration.test.js',
      ],
      {
        cwd: root,
        env: { ...process.env, ...freshEnv, LAB_AI_MODE: 'deterministic' },
        stdio: 'inherit',
        windowsHide: true,
        timeout: 90000,
      }
    );
    fs.writeFileSync(
      path.join(runDirectory, 'evidence.json'),
      JSON.stringify(
        {
          migration: '20261022000000_ai_lab_storage',
          workerMigration: '20261023000000_ai_worker',
          accessAdmissionWorkerPassed: true,
          contextOutputPassed: true,
          diagnosticsIntegrationPassed: true,
          legacyTables: before.tables,
          freshAndUpgradePassed: true,
          legacyClientPassed: true,
          checkedAt: new Date().toISOString(),
        },
        null,
        2
      ) + '\n'
    );
    console.log(
      'BE-01 migration/constraint evidence saved under .tmp/ai-lab-be01; no application DB or provider calls.'
    );
  } finally {
    for (const [name, oid] of created) {
      assert.match(name, /^ai_lab_be01_(fresh|upgrade)_[a-f0-9]+$/);
      const result = await admin.query('SELECT oid FROM pg_database WHERE datname=$1', [name]);
      if (result.rows.length) {
        assert.equal(result.rows[0].oid, oid, 'Refusing to drop a database whose identity changed');
        await admin.query(`DROP DATABASE ${quote(name)} WITH (FORCE)`);
      }
    }
    await admin.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
