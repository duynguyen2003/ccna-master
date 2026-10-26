#!/usr/bin/env node
// Local development cluster only. Never load dotenv or accept an external URL.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const root = path.resolve(__dirname, '../../..');
const recordDirectory = path.join(root, '.tmp', 'ai-lab-local');
// Windows PostgreSQL tools cannot reliably re-exec from a non-ASCII working path.
const clusterSuffix = crypto.createHash('sha256').update(root).digest('hex').slice(0, 12);
const directory = path.join(os.tmpdir(), `ccna-ai-lab-${clusterSuffix}`);
const dataDirectory = path.join(directory, 'pgdata');
const connectionFile = path.join(recordDirectory, 'connection.json');
const passwordFile = path.join(directory, 'initdb-password.txt');
const port = 55432;
const user = 'ai_lab_local';
const database = 'ai_lab_local';
const action = process.argv[2];

function run(program, args, allowed = [0]) {
  const result = spawnSync(program, args, {
    cwd: fs.existsSync(directory) ? directory : os.tmpdir(),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 45000,
    // PostgreSQL on Windows can inherit pipe handles past pg_ctl's exit.
    stdio: args.includes('start') ? 'ignore' : ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (!allowed.includes(result.status)) {
    // These commands never contain credentials. Do not print connectionFile.
    throw new Error(
      `${program} failed: ${result.stderr || result.stdout || 'check the local postgres.log'}`
    );
  }
  return result;
}

function assertOwnedPath() {
  // Refuse linked/junction directories before init/start/stop can touch a cluster.
  for (const candidate of [
    path.join(root, '.tmp'),
    recordDirectory,
    directory,
    dataDirectory,
    connectionFile,
  ]) {
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isSymbolicLink()) {
      throw new Error(`Refusing linked local cluster directory: ${candidate}`);
    }
  }
}

function readConnection() {
  const config = JSON.parse(fs.readFileSync(connectionFile, 'utf8'));
  const url = new URL(config.databaseUrl);
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    url.port !== String(port) ||
    url.username !== user ||
    url.pathname !== `/${database}` ||
    config.dataDirectory !== dataDirectory ||
    !/^[a-f0-9]{64}$/.test(url.password) ||
    url.search ||
    url.hash
  ) {
    throw new Error('Local connection file does not match the fixed sandbox identity');
  }
  return config;
}

async function verify(config) {
  const client = new Client({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 3000,
  });
  try {
    await client.connect();
    const identity = await verifyIdentity(client, database, config);
    config.clusterId = identity.cluster_id;
    fs.writeFileSync(connectionFile, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    console.log(`Verified PostgreSQL ${identity.version}; ${database} at 127.0.0.1:${port}.`);
    console.log('Private connection: .tmp/ai-lab-local/connection.json (not printed).');
  } finally {
    await client.end();
  }
}

async function verifyIdentity(client, expectedDatabase, config) {
  const {
    rows: [identity],
  } = await client.query(`
      SELECT current_database() AS database, current_user AS username,
             host(inet_server_addr()) AS host, inet_server_port() AS port,
             current_setting('data_directory') AS directory,
             current_setting('server_version') AS version,
             (SELECT system_identifier::text FROM pg_control_system()) AS cluster_id
    `);
  if (
    identity.database !== expectedDatabase ||
    identity.username !== user ||
    identity.host !== '127.0.0.1' ||
    identity.port !== port ||
    path.resolve(identity.directory).toLowerCase() !== dataDirectory.toLowerCase() ||
    (config.clusterId && identity.cluster_id !== config.clusterId)
  ) {
    throw new Error('Connected database is not the owned local cluster');
  }
  return identity;
}

async function main() {
  if (!['start', 'status', 'stop'].includes(action) || process.argv.length !== 3) {
    throw new Error('Usage: node src/agent/scripts/ai-lab-local-db.cjs start|status|stop');
  }
  assertOwnedPath();
  if (action === 'stop') {
    if (!fs.existsSync(path.join(dataDirectory, 'PG_VERSION'))) {
      console.log('No local cluster to stop.');
      return;
    }
    const status = run('pg_ctl', ['-D', dataDirectory, 'status'], [0, 3]);
    if (status.status === 0) run('pg_ctl', ['-D', dataDirectory, '-m', 'fast', '-w', 'stop']);
    console.log('Local cluster stopped; data retained.');
    return;
  }
  if (action === 'status') {
    await verify(readConnection());
    return;
  }

  run('initdb', ['--version']);
  run('pg_ctl', ['--version']);
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync(recordDirectory, { recursive: true });
  if (!fs.existsSync(connectionFile)) {
    if (fs.existsSync(dataDirectory)) throw new Error('Existing cluster has no ownership record');
    const password = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(
      connectionFile,
      `${JSON.stringify(
        {
          databaseUrl: `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`,
          dataDirectory,
        },
        null,
        2
      )}\n`,
      { flag: 'wx', mode: 0o600 }
    );
  }
  const config = readConnection();
  if (config.clusterId && !fs.existsSync(path.join(dataDirectory, 'PG_VERSION'))) {
    throw new Error('Owned cluster data is missing; refusing automatic reinitialization');
  }
  if (!fs.existsSync(path.join(dataDirectory, 'PG_VERSION'))) {
    fs.writeFileSync(passwordFile, `${new URL(config.databaseUrl).password}\n`, { mode: 0o600 });
    try {
      run('initdb', [
        '-D',
        dataDirectory,
        '-U',
        user,
        '--pwfile',
        passwordFile,
        '--auth-host=scram-sha-256',
        '--auth-local=scram-sha-256',
        '--encoding=UTF8',
        '--no-locale',
      ]);
    } finally {
      fs.unlinkSync(passwordFile);
    }
  }
  const status = run('pg_ctl', ['-D', dataDirectory, 'status'], [0, 3]);
  if (status.status !== 0) {
    run('pg_ctl', [
      '-D',
      dataDirectory,
      '-l',
      path.join(directory, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p ${port} -c unix_socket_directories=`,
      '-w',
      'start',
    ]);
  }
  // CREATE DATABASE cannot run in a transaction. Credentials are passed only via pg.
  const adminUrl = new URL(config.databaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new Client({
    connectionString: adminUrl.toString(),
    connectionTimeoutMillis: 3000,
  });
  try {
    await admin.connect();
    await verifyIdentity(admin, 'postgres', config);
    const result = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (result.rowCount === 0) await admin.query('CREATE DATABASE ai_lab_local');
  } finally {
    await admin.end();
  }
  await verify(config);
}

main().catch((error) => {
  // Errors from pg may carry connection metadata; avoid echoing such objects.
  console.error(error.code ? `Local DB operation failed (${error.code}).` : error.message);
  process.exitCode = 1;
});
