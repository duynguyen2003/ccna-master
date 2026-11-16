const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const root = path.resolve(__dirname, '../../..');
const image = process.env.AI_PRODUCTION_TEST_IMAGE || 'ccna-ai-production:local-check';
const nonce = crypto.randomBytes(6).toString('hex');
const prefix = 'ccna-ai-qa-' + nonce;
const network = prefix + '-network',
  database = prefix + '-db',
  app = prefix + '-app';
const dir = path.join(root, '.tmp', 'ai-production-docker-' + nonce);
fs.mkdirSync(path.dirname(dir), { recursive: true });
fs.mkdirSync(dir);
const created = [];
const envFiles = [];
let networkMade = false;
function docker(args) {
  return execFileSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function envFile(name, values) {
  const file = path.join(dir, name);
  fs.writeFileSync(
    file,
    Object.entries(values)
      .map(([k, v]) => k + '=' + v)
      .join('\n') + '\n',
    { mode: 0o600, flag: 'wx' }
  );
  envFiles.push(file);
  return file;
}
async function main() {
  const password = crypto.randomBytes(24).toString('hex');
  const dbEnv = envFile('database.env', {
    POSTGRES_USER: 'ai_qa',
    POSTGRES_PASSWORD: password,
    POSTGRES_DB: 'ai_production_smoke',
  });
  const appEnv = envFile('application.env', {
    NODE_ENV: 'production',
    PORT: 10000,
    DATABASE_URL: `postgresql://ai_qa:${password}@ai-db:5432/ai_production_smoke`,
    FRONTEND_URL: 'https://frontend.example.invalid',
    CORS_ORIGIN: 'https://frontend.example.invalid',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
    AI_PRODUCTION_ENABLED: 'true',
    AI_ENVIRONMENT: 'production',
    AI_WORKER_MODE: 'production-gemini',
    AI_RELEASE_SHA: 'a'.repeat(40),
    AI_RECOVERY_EPOCH: 'qa_' + nonce,
    AI_SERVICE_SECRET: crypto.randomBytes(32).toString('hex'),
    AI_OWNER_SECRET: crypto.randomBytes(32).toString('hex'),
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_API_KEY: 'synthetic-never-used-policy-remains-disabled',
    LAB_AI_MODE: 'deterministic',
    AI_STATUS_STREAM_ENABLED: 'true',
  });
  docker(['network', 'create', '--label', 'netmaster.qa=' + nonce, network]);
  networkMade = true;
  docker([
    'run',
    '-d',
    '--name',
    database,
    '--network',
    network,
    '--network-alias',
    'ai-db',
    '--label',
    'netmaster.qa=' + nonce,
    '--env-file',
    dbEnv,
    'postgres:16-alpine',
  ]);
  created.push(database);
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      docker(['exec', database, 'pg_isready', '-U', 'ai_qa', '-d', 'ai_production_smoke']);
      ready = true;
      break;
    } catch {
      await delay(1000);
    }
  }
  if (!ready) throw new Error('QA PostgreSQL not ready');
  docker(['run', '--rm', '--network', network, '--env-file', appEnv, image, 'pnpm', 'db:deploy']);
  docker([
    'run',
    '-d',
    '--name',
    app,
    '--network',
    network,
    '--label',
    'netmaster.qa=' + nonce,
    '--env-file',
    appEnv,
    image,
  ]);
  created.push(app);
  let statuses;
  for (let i = 0; i < 45; i++) {
    try {
      const output = docker([
        'exec',
        app,
        'node',
        '-e',
        "Promise.all(['http://127.0.0.1:10000/api/health/ready','http://127.0.0.1:8001/health/ready'].map(async u=>{const r=await fetch(u);return {status:r.status,body:await r.json()}})).then(x=>{console.log(JSON.stringify(x));if(x.some(r=>r.status!==200))process.exitCode=1}).catch(()=>process.exitCode=1)",
      ]);
      statuses = JSON.parse(output);
      break;
    } catch {
      await delay(1000);
    }
  }
  if (!statuses) throw new Error('QA app readiness failed');
  await delay(2500);
  const processes = docker(['top', app, '-eo', 'pid,args']);
  for (const needle of ['Server.js', 'aiWorker.js', '-m app'])
    if (!processes.includes(needle)) throw new Error('Missing process: ' + needle);
  if (!docker(['logs', app]).includes('ai.sweeper.started'))
    throw new Error('Inline sweeper not started');
  const policy = JSON.parse(
    docker(['exec', app, 'node', 'src/agent/scripts/production-policy.cjs', '--status'])
  );
  if (policy.policy !== null || !policy.productionRuntimeEnabled)
    throw new Error('Unexpected QA admission policy');
  let health;
  for (let i = 0; i < 20; i++) {
    health = docker(['inspect', '--format', '{{.State.Health.Status}}', app]);
    if (health === 'healthy') break;
    await delay(1000);
  }
  if (health !== 'healthy') throw new Error('Container healthcheck did not use the assigned PORT');
  const memory = docker(['stats', '--no-stream', '--format', '{{.MemUsage}}', app]);
  const result = {
    apiPort: 10000,
    health,
    api: statuses[0].status,
    python: statuses[1].status,
    processes: { api: true, python: true, worker: true, sweeper: 'inline' },
    policy: policy.policy,
    productionRuntimeEnabled: policy.productionRuntimeEnabled,
    providerCalls: 0,
    memoryAtIdle: memory,
  };
  fs.writeFileSync(
    path.join(root, '.tmp/ai-production-docker-result.json'),
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result));
}
main()
  .catch((e) => {
    console.error('Production Docker smoke failed:', e.message);
    process.exitCode = 1;
    try {
      console.error(docker(['logs', '--tail', '45', app]));
    } catch {}
  })
  .finally(() => {
    for (const name of created.reverse()) {
      try {
        const label = docker([
          'inspect',
          '--format',
          '{{index .Config.Labels "netmaster.qa"}}',
          name,
        ]);
        if (label !== nonce) throw new Error('QA container ownership changed');
        docker(['rm', '-f', '-v', name]);
      } catch (e) {
        console.error('QA cleanup:', e.message);
        process.exitCode = 1;
      }
    }
    if (networkMade) {
      try {
        docker(['network', 'rm', network]);
      } catch {
        console.error('QA cleanup: owned network could not be removed');
        process.exitCode = 1;
      }
    }
    try {
      for (const file of envFiles) fs.unlinkSync(file);
      fs.rmdirSync(dir);
    } catch {
      console.error('QA cleanup: owned fixture files could not be removed');
      process.exitCode = 1;
    }
  });
