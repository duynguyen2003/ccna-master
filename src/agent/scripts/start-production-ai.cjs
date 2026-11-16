#!/usr/bin/env node
const { runtimeConfig } = require('../node/workerConfig');
const path = require('node:path');
const { pythonEnvironment } = require('./start-python.cjs');
const { createDevRuntime } = require('./start-dev-ai.cjs');

function productionSettings(env, root) {
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('AI_PRODUCTION_INVALID_PORT');
  const configured = {
    ...env,
    AI_INLINE_SWEEPER: 'true',
    AI_INTERNAL_URL: env.AI_INTERNAL_URL || `http://127.0.0.1:${port}/internal/v1/ai`,
    AI_ANALYZE_URL: env.AI_ANALYZE_URL || 'http://127.0.0.1:8001/internal/v1/lab-assistant/analyze',
  };
  const runtime = runtimeConfig(configured);
  if (!runtime.enabled || runtime.environment !== 'production')
    throw new Error('AI_PRODUCTION_NOT_CONFIGURED');
  const python = pythonEnvironment(configured);
  const backendUrl = new URL(python.AI_PYTHON_NODE_URL);
  if (Number(backendUrl.port) !== port) throw new Error('AI_PRODUCTION_PORT_MISMATCH');
  backendUrl.pathname = '/api/health/ready';
  return {
    root,
    env: configured,
    backendUrl,
    pythonUrl: new URL(
      `http://${python.AI_PYTHON_HOST === '::1' ? '[::1]' : python.AI_PYTHON_HOST}:${python.AI_PYTHON_PORT}/health/ready`
    ),
    label: 'production:ai',
    readyMessage: '[production:ai] API, Python và worker đã khởi động; sweeper chạy cùng worker.',
    readyTimeoutMs: 60000,
    sweeper: false,
    pythonProcess: {
      executable: path.join(
        root,
        'src/agent/python/.venv',
        process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
      ),
      args: ['-m', 'app'],
      cwd: path.join(root, 'src/agent/python'),
      env: python,
    },
  };
}

async function main() {
  const { repositoryDirectory } = require('../../backend/src/config/env');
  const runtime = createDevRuntime(productionSettings(process.env, repositoryDirectory));
  const shutdown = () => void runtime.stop();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    await runtime.start();
    const error = await runtime.done;
    if (error) throw error;
  } finally {
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
  }
}

if (require.main === module)
  main().catch(() => {
    console.error(
      '[production:ai] Startup failed; check configuration, policy and service readiness.'
    );
    process.exitCode = 1;
  });
module.exports = { productionSettings, main };
