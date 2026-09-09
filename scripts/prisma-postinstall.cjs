const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const prismaEntry = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');

if (!fs.existsSync(prismaEntry)) {
  console.log('[postinstall] Prisma CLI is not installed; skipping prisma generate.');
  process.exit(0);
}

execFileSync(process.execPath, [prismaEntry, 'generate'], {
  stdio: 'inherit',
});
