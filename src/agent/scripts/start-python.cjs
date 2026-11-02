#!/usr/bin/env node
// Start the existing internal service with a narrow server-only environment.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { runtimeConfig } = require('../node/workerConfig');

function pythonEnvironment(env) {
  if (
    !runtimeConfig(env).enabled ||
    !['python-gemini', 'app-gemini'].includes(env.AI_WORKER_MODE) ||
    !env.AI_SERVICE_SECRET ||
    env.AI_SERVICE_SECRET.length < 32 ||
    /\s/.test(env.AI_SERVICE_SECRET) ||
    !env.GEMINI_API_KEY?.trim()
  )
    throw new Error('Python service requires an explicit configured worker mode');
  const analyze = new URL(
    env.AI_ANALYZE_URL || 'http://127.0.0.1:8001/internal/v1/lab-assistant/analyze'
  );
  const callback = new URL(env.AI_INTERNAL_URL || 'http://127.0.0.1:5500/internal/v1/ai');
  for (const [url, pathname] of [
    [analyze, '/internal/v1/lab-assistant/analyze'],
    [callback, '/internal/v1/ai'],
  ]) {
    if (
      url.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== pathname
    )
      throw new Error('Internal service URLs must be explicit HTTP loopback endpoints');
  }
  const child = Object.fromEntries(
    Object.entries(env).filter(([key]) =>
      ['PATH', 'SYSTEMROOT', 'WINDIR', 'USERPROFILE', 'TEMP', 'TMP', 'LANG', 'LC_ALL'].includes(
        key.toUpperCase()
      )
    )
  );
  return {
    ...child,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONDONTWRITEBYTECODE: '1',
    AI_SERVICE_SECRET: env.AI_SERVICE_SECRET,
    AI_PYTHON_MODE: 'gemini',
    AI_PYTHON_ENVIRONMENT: 'local',
    AI_PYTHON_LIVE_ENABLED: 'true',
    AI_PYTHON_HOST: analyze.hostname === '[::1]' ? '::1' : '127.0.0.1',
    AI_PYTHON_PORT: analyze.port,
    AI_PYTHON_NODE_URL: callback.toString(),
    AI_PYTHON_MAX_CONCURRENT: '1',
    AI_PYTHON_MAX_REQUEST_MS: '55000',
    AI_PYTHON_TRACE_TIMINGS: env.AI_TRACE_TIMINGS === 'true' ? 'true' : 'false',
    GEMINI_API_KEY: env.GEMINI_API_KEY,
  };
}

function main() {
  const { repositoryDirectory } = require('../../backend/src/config/env');
  const env = pythonEnvironment(process.env);
  const project = path.join(repositoryDirectory, 'src/agent/python');
  const executable = path.join(
    project,
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
  );
  if (!fs.existsSync(executable))
    throw new Error('Python environment missing; run uv sync --project src/agent/python --frozen');
  const child = spawn(executable, ['-m', 'app'], {
    cwd: project,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', () => {
    console.error('AI Python service could not start');
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
}
if (require.main === module) {
  try {
    main();
  } catch {
    console.error('AI Python service configuration unavailable');
    process.exitCode = 1;
  }
}
module.exports = { pythonEnvironment };
