#!/usr/bin/env node
// Opt-in setup for the development app. Dry run unless --apply is supplied.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Client } = require('pg');
const { repositoryDirectory } = require('../../backend/src/config/env');
const { runtimeConfig } = require('../node/workerConfig');
const budget = require('../node/localGeminiBudget');
const { costOf } = require('../node/settlement');

function adminProvider(env) {
  if (!env.GEMINI_API_KEY?.trim() || (env.GEMINI_MODEL && env.GEMINI_MODEL !== budget.policy.model))
    throw new Error('Server Gemini key/model configuration unavailable');
  const id = 'local-gemini-v1';
  const config = runtimeConfig({
    ...env,
    AI_WORKER_MODE: 'app-gemini',
    AI_ENVIRONMENT: 'admin-test',
  });
  if (!config.enabled) throw new Error('Development PostgreSQL configuration required');
  const provider = config.providers[id];
  return {
    id,
    provider,
    limits: {
      userMinute: 2,
      userDay: budget.policy.maxCalls,
      globalDayMicros: budget.policy.dailyMicroUsd,
      globalMonthMicros: budget.policy.monthlyMicroUsd,
      maxCostMicros: Number(
        costOf(provider, {
          status: 'FINAL',
          inputTokens: provider.caps.maxInputTokens,
          outputTokens: provider.caps.maxOutputTokens,
          reasoningTokens: provider.caps.maxReasoningTokens,
        })
      ),
      globalConcurrency: 1,
    },
  };
}

function patchEnv(source, values) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let output = source;
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, 'gm');
    const line = `${key}=${JSON.stringify(value)}`;
    if (pattern.test(output)) output = output.replace(pattern, () => line);
    else output += `${output.endsWith('\n') || !output ? '' : eol}${line}${eol}`;
  }
  return output;
}

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !['--apply', '--gemini'].includes(arg)) ||
    new Set(args).size !== args.length
  )
    throw new Error('Use --apply and/or --gemini');
  if (process.env.NODE_ENV === 'production') throw new Error('Development setup only');
  const apply = args.includes('--apply');
  // --gemini remains accepted for compatibility; all setups now use Gemini.
  const selected = adminProvider(process.env);
  budget.available();
  const environment = 'admin-test';
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL required');
  const port = Number(process.env.BACKEND_PORT || process.env.PORT || 5500);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid backend port');
  const values = {
    AI_ENVIRONMENT: environment,
    AI_WORKER_MODE: 'app-gemini',
    AI_INTERNAL_URL: `http://127.0.0.1:${port}/internal/v1/ai`,
    AI_ANALYZE_URL: 'http://127.0.0.1:8001/internal/v1/lab-assistant/analyze',
    LAB_AI_MODE: 'off',
    AI_RECOVERY_EPOCH:
      process.env.AI_RECOVERY_EPOCH || `epoch_admin_${randomBytes(8).toString('hex')}`,
    AI_OWNER_SECRET: process.env.AI_OWNER_SECRET || randomBytes(32).toString('hex'),
    AI_SERVICE_SECRET: process.env.AI_SERVICE_SECRET || randomBytes(32).toString('hex'),
  };
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(values.AI_RECOVERY_EPOCH))
    throw new Error('Invalid recovery epoch; correct it before setup');
  if (values.AI_OWNER_SECRET.length < 32 || values.AI_SERVICE_SECRET.length < 32)
    throw new Error('Existing AI secrets must have at least 32 characters');
  const appCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryDirectory,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  if (!/^[a-f0-9]{40}$/.test(appCommit)) throw new Error('Invalid app commit');
  const limits = {
    ...selected.limits,
    versions: { ...selected.provider.versions, appCommit },
  };
  const rules = { adminAccess: true, userIds: [], labIds: [] };
  const backendEnv = path.join(repositoryDirectory, 'src/backend/.env');
  const envFile = fs.existsSync(backendEnv) ? backendEnv : path.join(repositoryDirectory, '.env');
  // Refuse to put secrets in a tracked or unignored file.
  execFileSync(
    'git',
    ['check-ignore', '--quiet', '--', path.relative(repositoryDirectory, envFile)],
    {
      cwd: repositoryDirectory,
      windowsHide: true,
      stdio: 'ignore',
    }
  );
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 15000,
  });
  await client.connect();
  try {
    const admins = (
      await client.query(
        "SELECT id, full_name FROM users WHERE role = 'ADMIN' AND is_active = true AND deleted_at IS NULL ORDER BY id"
      )
    ).rows;
    if (!admins.length) throw new Error('No active ADMIN account');
    const schema = await client.query(
      "SELECT to_regclass('public.ai_runtime_policies') IS NOT NULL AS ready"
    );
    console.log(
      JSON.stringify({
        mode: apply ? 'apply' : 'dry-run',
        database: { host: url.hostname, database: url.pathname.slice(1) },
        admins,
        schemaReady: schema.rows[0].ready,
        environment,
        provider: selected.provider.provider,
        limits: selected.limits,
        envFile: path.relative(repositoryDirectory, envFile),
      })
    );
    if (!schema.rows[0].ready) {
      if (apply) throw new Error('Run reviewed pending migrations with pnpm db:deploy first');
      return;
    }
    if (!apply) return;
    const original = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
    const patched = patchEnv(original, values);
    const backupDirectory = path.join(repositoryDirectory, '.tmp', 'admin-ai-setup');
    fs.mkdirSync(backupDirectory, { recursive: true });
    const backupFile = path.join(backupDirectory, `${Date.now()}-${randomUUID()}.env`);
    if (patched !== original) fs.writeFileSync(backupFile, original, { mode: 0o600, flag: 'wx' });
    await client.query('BEGIN');
    try {
      await client.query(
        'SELECT environment FROM ai_runtime_policies WHERE environment = $1 FOR UPDATE',
        [environment]
      );
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('ai-admission:admin-test', 1))"
      );
      const pending = await client.query(
        `SELECT count(*)::int AS count FROM ai_requests r
         JOIN ai_reservations s ON s.request_id = r.id
         JOIN ai_quota_buckets b ON b.id = s.bucket_id
         WHERE b.scope_type = 'GLOBAL_DAY' AND b.scope_key = $1
           AND r.status IN ('QUEUED', 'RUNNING')`,
        [environment]
      );
      if (pending.rows[0].count)
        throw new Error('Wait for admin-test requests to finish before setup');
      await client.query(
        `INSERT INTO ai_runtime_policies
         (environment, version, admission_enabled, dispatch_enabled, provider_config_id, eligibility_rules, limits, updated_at)
         VALUES ($1, 1, true, true, $4, $2::jsonb, $3::jsonb, now())
         ON CONFLICT (environment) DO UPDATE SET
           version = ai_runtime_policies.version + 1,
           admission_enabled = true, dispatch_enabled = true,
           provider_config_id = EXCLUDED.provider_config_id, eligibility_rules = EXCLUDED.eligibility_rules,
           limits = EXCLUDED.limits, updated_at = now()
         WHERE ai_runtime_policies.admission_enabled IS DISTINCT FROM true
           OR ai_runtime_policies.dispatch_enabled IS DISTINCT FROM true
           OR ai_runtime_policies.provider_config_id IS DISTINCT FROM EXCLUDED.provider_config_id
           OR ai_runtime_policies.eligibility_rules IS DISTINCT FROM EXCLUDED.eligibility_rules
           OR ai_runtime_policies.limits IS DISTINCT FROM EXCLUDED.limits`,
        [environment, JSON.stringify(rules), JSON.stringify(limits), selected.id]
      );
      // Existing fake buckets have a zero money ceiling. Change ceilings only;
      // retain all reservations, usage and spend, including past paid requests.
      await client.query(
        `UPDATE ai_quota_buckets SET limit_micros = GREATEST(spent_micros + reserved_micros, CASE scope_type
           WHEN 'GLOBAL_DAY' THEN $2::bigint WHEN 'GLOBAL_MONTH' THEN $3::bigint
           ELSE limit_micros END),
           limit_units = GREATEST(used_units + reserved_units, CASE scope_type
           WHEN 'USER_DAY' THEN $4::int WHEN 'USER_MINUTE' THEN $5::int
           ELSE limit_units END)
         WHERE (scope_type IN ('GLOBAL_DAY', 'GLOBAL_MONTH') AND scope_key = $1)
            OR (scope_type IN ('USER_DAY', 'USER_MINUTE') AND starts_with(scope_key, $1 || ':'))`,
        [
          environment,
          limits.globalDayMicros,
          limits.globalMonthMicros,
          limits.userDay,
          limits.userMinute,
        ]
      );
      if (patched !== original) fs.writeFileSync(envFile, patched, { mode: 0o600 });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (patched !== original) fs.writeFileSync(envFile, original, { mode: 0o600 });
      throw error;
    }
    console.log(
      'Admin Gemini enabled. Restart backend, then run pnpm ai:python and pnpm ai:worker. Existing live ledger preserved.'
    );
  } finally {
    await client.end();
  }
}

if (require.main === module)
  main().catch((error) => {
    // Never log connection strings, SQL parameter values or secrets.
    console.error('Admin test setup failed:', error.code || error.name);
    process.exitCode = 1;
  });
module.exports = { patchEnv, adminProvider };
