#!/usr/bin/env node
require('../../backend/src/config/env');
if (process.env.AI_PRODUCTION_ENABLED === 'true') {
  require('./start-production-ai.cjs')
    .main()
    .catch(() => {
      console.error('[production:ai] Runtime could not start.');
      process.exitCode = 1;
    });
} else {
  require('../../backend/src/Server.js').startServer();
}
