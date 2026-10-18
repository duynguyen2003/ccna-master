const { packageManager } = require('../../package.json');
const expectedVersion = packageManager.split('@')[1];
const userAgent = process.env.npm_config_user_agent || '';

if (userAgent.split(' ')[0] !== `pnpm/${expectedVersion}`) {
  console.error(`Use pnpm ${expectedVersion} for this project: corepack pnpm install`);
  process.exit(1);
}
