require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { connection, run, digest } = require('./backup-lib.cjs');
(async () => {
  const { database, env } = connection();
  const source = path.resolve(process.argv[2] || '');
  if (
    !process.argv[2] ||
    process.argv[3] !== '--confirm-database' ||
    process.argv[4] !== database
  ) {
    throw new Error(
      'Usage: pnpm restore <backup-directory> --confirm-database <empty-target-database>'
    );
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1) throw new Error('Unsupported backup format');
  for (const file of ['database.dump', 'uploads.tar.gz']) {
    if ((await digest(path.join(source, file))) !== manifest.files[file])
      throw new Error(`Checksum mismatch: ${file}`);
  }
  const uploads = path.resolve(process.env.UPLOADS_DIR || 'src/uploads');
  if (fs.existsSync(uploads) && fs.readdirSync(uploads).length)
    throw new Error('UPLOADS_DIR must be empty');
  const entries = run('tar', ['-tzf', path.join(source, 'uploads.tar.gz')], env)
    .split(/\r?\n/)
    .filter(Boolean);
  if (
    entries.some((entry) => /^[\\/]|^[A-Za-z]:/.test(entry) || entry.split(/[\\/]/).includes('..'))
  )
    throw new Error('Unsafe upload archive path');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const tables = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') LIMIT 1"
    );
    if (tables.rowCount)
      throw new Error('Target database must be empty; restore never overwrites existing data');
  } finally {
    await client.end();
  }
  run(
    process.env.PG_RESTORE_BIN || 'pg_restore',
    [
      '--dbname',
      database,
      '--no-owner',
      '--no-acl',
      '--exit-on-error',
      '--single-transaction',
      path.join(source, 'database.dump'),
    ],
    env
  );
  fs.mkdirSync(uploads, { recursive: true });
  run('tar', ['-xzf', path.join(source, 'uploads.tar.gz'), '-C', uploads], env);
  console.log(`Restore complete: ${database}; uploads: ${uploads}`);
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
