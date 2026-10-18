const { uploadsDirectory } = require('../backend/src/config/env');
const fs = require('node:fs');
const path = require('node:path');
const { connection, run, digest } = require('./backup-lib.cjs');
(async () => {
  const { env } = connection();
  const uploads = uploadsDirectory;
  if (!fs.statSync(uploads).isDirectory()) throw new Error('UPLOADS_DIR must be a directory');
  const target = path.resolve(
    process.env.BACKUP_DIR || 'backups',
    new Date().toISOString().replace(/[:.]/g, '-')
  );
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  run(
    process.env.PG_DUMP_BIN || 'pg_dump',
    ['--format=custom', '--no-owner', '--no-acl', '--file', path.join(target, 'database.dump')],
    env
  );
  run('tar', ['-czf', path.join(target, 'uploads.tar.gz'), '-C', uploads, '.'], env);
  const files = {};
  for (const file of ['database.dump', 'uploads.tar.gz'])
    files[file] = await digest(path.join(target, file));
  fs.writeFileSync(
    path.join(target, 'manifest.json'),
    JSON.stringify(
      {
        version: 1,
        createdAt: new Date().toISOString(),
        files,
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
  console.log(`Backup complete: ${target}`);
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
