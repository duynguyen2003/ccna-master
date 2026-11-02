const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const frontendDirectory = path.resolve(__dirname, '..');
const repositoryDirectory = path.resolve(frontendDirectory, '../..');
const rootEnvironment = path.join(repositoryDirectory, '.env');
const command = process.argv[2];
const mode = command === 'build' ? 'production' : command === 'test' ? 'test' : 'development';
const localEnvironmentFiles = [
  `.env.${mode}.local`,
  ...(mode === 'test' ? [] : ['.env.local']),
  `.env.${mode}`,
  '.env',
];
const localEnvironmentKeys = new Set();
for (const filename of localEnvironmentFiles) {
  const environmentFile = path.join(frontendDirectory, filename);
  if (fs.existsSync(environmentFile)) {
    Object.keys(dotenv.parse(fs.readFileSync(environmentFile))).forEach((key) =>
      localEnvironmentKeys.add(key)
    );
  }
}
const developmentOptions = new Set([
  'PORT',
  'HOST',
  'HTTPS',
  'BROWSER',
  'BROWSER_ARGS',
  'CI',
  'BUILD_PATH',
  'DISABLE_ESLINT_PLUGIN',
  'GENERATE_SOURCEMAP',
  'FAST_REFRESH',
  'CHOKIDAR_USEPOLLING',
  'WATCHPACK_POLLING',
  'WDS_SOCKET_HOST',
  'WDS_SOCKET_PATH',
  'WDS_SOCKET_PORT',
]);

// Keep existing root .env setups working. Only public React variables and
// development-server options reach the frontend process; server secrets stay out.
if (fs.existsSync(rootEnvironment)) {
  const parsed = dotenv.parse(fs.readFileSync(rootEnvironment));
  for (const [key, value] of Object.entries(parsed)) {
    if (
      (key.startsWith('REACT_APP_') || developmentOptions.has(key)) &&
      process.env[key] === undefined &&
      !localEnvironmentKeys.has(key)
    ) {
      process.env[key] = value;
    }
  }
}

process.chdir(frontendDirectory);
const supported = ['start', 'build', 'test'].includes(command);
if (supported) {
  process.env.NODE_ENV = mode;
  process.env.BABEL_ENV = mode;
  if (command !== 'test') require('../../agent/scripts/frontend-browser.cjs')(frontendDirectory);
}
const entry = require.resolve(
  supported ? `react-scripts/scripts/${command}.js` : 'react-scripts/bin/react-scripts.js'
);
process.argv = [process.execPath, entry, ...process.argv.slice(supported ? 3 : 2)];
require(entry);
