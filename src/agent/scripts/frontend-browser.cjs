const path = require('node:path');
const { createRequire } = require('node:module');

// Compile this browser-only workspace as application JSX, not as server code.
module.exports = function configureAgentBrowser(frontendDirectory) {
  const resolve = createRequire(path.join(frontendDirectory, 'package.json')).resolve;
  const configPath = resolve('react-scripts/config/webpack.config.js');
  const createConfig = require(configPath);
  const browserDirectory = path.resolve(__dirname, '../browser');
  require.cache[configPath].exports = (...args) => {
    const config = createConfig(...args);
    for (const rule of config.module.rules.flatMap((entry) => entry.oneOf || [])) {
      if (rule.include && String(rule.loader).includes('babel-loader'))
        rule.include = [rule.include, browserDirectory];
    }
    const scope = config.resolve.plugins.find((plugin) => plugin?.appSrcs);
    if (scope) scope.appSrcs.push(browserDirectory);
    return config;
  };
};
