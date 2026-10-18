const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const repositoryDirectory = path.resolve(__dirname, '../../../..');

test(
  'baseline upgrade preserves legacy results; database and uploads restore together',
  { skip: process.env.OPERATIONS_INTEGRATION !== '1', timeout: 90000 },
  async () => {
    const { Client } = require('pg');
    const url = new URL(process.env.DATABASE_URL);
    assert.match(url.pathname, /_test$/);
    const tag = crypto.randomBytes(4).toString('hex');
    const sourceName = `ccna_upgrade_${tag}_test`,
      targetName = `ccna_restore_${tag}_test`;
    const admin = new Client({ connectionString: url.href });
    await admin.connect();
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccna-restore-'));
    const uploads = path.join(temp, 'uploads'),
      restoredUploads = path.join(temp, 'restored');
    fs.mkdirSync(uploads);
    fs.writeFileSync(path.join(uploads, 'lab.txt'), 'restored lab fixture');
    let source, restored;
    const run = (args, env) =>
      spawnSync(process.execPath, args, {
        cwd: repositoryDirectory,
        env: { ...process.env, ...env, NODE_ENV: 'test' },
        encoding: 'utf8',
        windowsHide: true,
      });
    const ok = (result) => assert.equal(result.status, 0, result.stderr + result.stdout);
    try {
      await admin.query(`CREATE DATABASE ${sourceName}`);
      await admin.query(`CREATE DATABASE ${targetName}`);
      url.pathname = '/' + sourceName;
      const sourceUrl = url.href;
      source = new Client({ connectionString: sourceUrl });
      await source.connect();
      await source.query(
        fs.readFileSync(
          path.join(
            repositoryDirectory,
            'src/backend/prisma/migrations/20260901000000_baseline/migration.sql'
          ),
          'utf8'
        )
      );
      await source.query(
        fs.readFileSync(
          path.join(
            repositoryDirectory,
            'src/backend/prisma/migrations/20260922190000_add_video_progress_sessions/migration.sql'
          ),
          'utf8'
        )
      );
      await source.query(`INSERT INTO users (id,email,password_hash,updated_at) VALUES (1,'legacy@example.invalid','unused',NOW());
      INSERT INTO exams (id,title,total_questions,duration_minutes) VALUES (1,'Legacy exam',1,10);
      INSERT INTO exam_results (id,user_id,exam_id,score,total_questions,percentage,is_passed,answers,time_spent) VALUES (1,1,1,1000,1,100,true,'{"5":[1,2]}',60);`);
      const prisma = ['node_modules/prisma/build/index.js'];
      for (const migration of [
        '20260901000000_baseline',
        '20260922190000_add_video_progress_sessions',
      ]) {
        ok(
          run([...prisma, 'migrate', 'resolve', '--applied', migration], {
            DATABASE_URL: sourceUrl,
          })
        );
      }
      ok(run([...prisma, 'migrate', 'deploy'], { DATABASE_URL: sourceUrl }));
      const old = (
        await source.query(
          'SELECT r.answers,r.exam_snapshot,u.session_version FROM exam_results r JOIN users u ON u.id=r.user_id'
        )
      ).rows[0];
      assert.deepEqual(old.answers, { 5: [1, 2] });
      assert.equal(old.exam_snapshot, null);
      assert.equal(old.session_version, 0);
      const backupEnv = {
        DATABASE_URL: sourceUrl,
        UPLOADS_DIR: uploads,
        BACKUP_DIR: path.join(temp, 'backups'),
      };
      ok(run(['src/scripts/backup.cjs'], backupEnv));
      const backupPath = path.join(backupEnv.BACKUP_DIR, fs.readdirSync(backupEnv.BACKUP_DIR)[0]);
      url.pathname = '/' + targetName;
      const restoreEnv = { DATABASE_URL: url.href, UPLOADS_DIR: restoredUploads };
      ok(
        run(['src/scripts/restore.cjs', backupPath, '--confirm-database', targetName], restoreEnv)
      );
      restored = new Client({ connectionString: url.href });
      await restored.connect();
      assert.equal(
        (await restored.query('SELECT score FROM exam_results WHERE id=1')).rows[0].score,
        1000
      );
      assert.equal(
        (
          await restored.query(
            'SELECT COUNT(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL'
          )
        ).rows[0].count,
        3
      );
      assert.equal(
        fs.readFileSync(path.join(restoredUploads, 'lab.txt'), 'utf8'),
        'restored lab fixture'
      );
      assert.notEqual(
        run(['src/scripts/restore.cjs', backupPath, '--confirm-database', targetName], restoreEnv)
          .status,
        0
      );
      const nonemptyDatabase = run(
        ['src/scripts/restore.cjs', backupPath, '--confirm-database', targetName],
        { ...restoreEnv, UPLOADS_DIR: path.join(temp, 'another-empty-target') }
      );
      assert.notEqual(nonemptyDatabase.status, 0);
      assert.match(nonemptyDatabase.stderr, /Target database must be empty/);
      fs.appendFileSync(path.join(backupPath, 'database.dump'), 'corrupted');
      const corrupt = run(
        ['src/scripts/restore.cjs', backupPath, '--confirm-database', targetName],
        restoreEnv
      );
      assert.notEqual(corrupt.status, 0);
      assert.match(corrupt.stderr, /Checksum mismatch/);
    } finally {
      await source?.end();
      await restored?.end();
      // Only these freshly generated, validated SQL identifiers can be dropped.
      for (const name of [sourceName, targetName])
        await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.end();
      // Keep the verified archive for inspection in this OS temporary directory.
      console.log(`Restore drill artifacts: ${temp}`);
    }
  }
);
