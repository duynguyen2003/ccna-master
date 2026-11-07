const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const connection = () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database) throw new Error('DATABASE_URL must name a database');
  return {
    database,
    env: {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGDATABASE: database,
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      ...(url.searchParams.get('sslmode') ? { PGSSLMODE: url.searchParams.get('sslmode') } : {}),
    },
  };
};
const run = (program, args, env, { cwd, inputFile, outputFile } = {}) => {
  const descriptors = [];
  try {
    // Native Windows tools may lose Unicode paths in argv. Let Node open the
    // files and stream through inherited handles, without buffering archives.
    const open = (file, mode) => {
      const descriptor = fs.openSync(file, mode, 0o600);
      descriptors.push(descriptor);
      return descriptor;
    };
    const result = spawnSync(program, args, {
      env,
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      stdio: [
        inputFile ? open(inputFile, 'r') : 'pipe',
        outputFile ? open(outputFile, 'w') : 'pipe',
        'pipe',
      ],
    });
    if (result.error || result.status !== 0)
      throw new Error(`${program} failed: ${result.error?.message || result.stderr}`);
    return result.stdout;
  } finally {
    for (const descriptor of descriptors) fs.closeSync(descriptor);
  }
};
const digest = async (file) => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
module.exports = { connection, run, digest };
