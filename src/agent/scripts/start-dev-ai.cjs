#!/usr/bin/env node
// Own only the processes started here. Never change AI policy, credentials or quota.
const net = require('node:net');
const { spawn, execFile } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { pythonEnvironment } = require('./start-python.cjs');

function portOccupied(url) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port,
    });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', (error) => {
      socket.destroy();
      if (error.code === 'ECONNREFUSED') resolve(false);
      else reject(new Error('Không kiểm tra được cổng dịch vụ AI.'));
    });
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('Hết thời gian kiểm tra cổng dịch vụ AI.'));
    });
  });
}

function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  if (process.platform === 'win32') {
    // Killing only the Node launcher would leave its Python child listening.
    return new Promise((resolve, reject) => {
      execFile(
        'taskkill',
        ['/PID', String(child.pid), '/T', '/F'],
        { windowsHide: true },
        (error) => {
          if (!error || child.exitCode !== null || child.signalCode !== null) resolve();
          else reject(new Error('Không dừng được cây tiến trình AI.'));
        }
      );
    });
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') reject(error);
      }
    }, 5000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch (error) {
      clearTimeout(timer);
      if (error.code === 'ESRCH') resolve();
      else reject(error);
    }
  });
}

function createDevRuntime(settings, adapters = {}) {
  const launch = adapters.spawn || spawn;
  const occupied = adapters.portOccupied || portOccupied;
  const fetchReady = adapters.fetch || fetch;
  const kill = adapters.stopChild || stopChild;
  const pause = adapters.delay || delay;
  const now = adapters.now || Date.now;
  const log = adapters.log || console.log;
  const controller = new AbortController();
  const children = [];
  let stopping;
  let failure;
  let finish;
  const done = new Promise((resolve) => {
    finish = resolve;
  });

  function stop(error) {
    if (stopping) return stopping;
    failure = error;
    controller.abort();
    stopping = Promise.resolve().then(async () => {
      const results = await Promise.allSettled([...children].reverse().map(kill));
      if (results.some((result) => result.status === 'rejected'))
        failure ||= new Error('Không dừng được toàn bộ tiến trình AI.');
      finish(failure);
    });
    return stopping;
  }

  function startChild(name, script) {
    controller.signal.throwIfAborted();
    const child = launch(process.execPath, [script], {
      cwd: settings.root,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
      detached: process.platform !== 'win32',
    });
    children.push(child);
    child.once('error', () => {
      void stop(new Error(`Không khởi động được ${name}.`));
    });
    child.once('exit', (code) => {
      if (!stopping) void stop(new Error(`${name} đã dừng (mã ${code ?? 'signal'}).`));
    });
    log(`[dev:ai] Đã khởi động ${name}.`);
  }

  async function ready(url, expected) {
    const deadline = now() + (settings.readyTimeoutMs || 30000);
    while (now() < deadline) {
      controller.signal.throwIfAborted();
      try {
        const response = await fetchReady(url, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(2000)]),
          redirect: 'error',
        });
        if (response.ok && expected(await response.json())) return;
      } catch {
        controller.signal.throwIfAborted();
      }
      await pause(250, undefined, { signal: controller.signal });
    }
    throw new Error('Dịch vụ chưa sẵn sàng; kiểm tra log phía trên.');
  }

  return {
    done,
    stop,
    async start() {
      try {
        const { backendUrl, pythonUrl, existingBackend } = settings;
        // Refuse an occupied Python port instead of using another runtime or killing it.
        if (await occupied(pythonUrl)) throw new Error('Cổng Python AI đang được sử dụng.');
        if (!existingBackend) {
          if (await occupied(backendUrl))
            throw new Error('Backend đang chạy. Dùng pnpm dev:ai --existing-backend.');
          startChild('backend', 'src/backend/src/Server.js');
        }
        await ready(backendUrl, (body) => body.status === 'ok');
        startChild('Python AI', 'src/agent/scripts/start-python.cjs');
        await ready(
          pythonUrl,
          (body) =>
            body.service === 'ai-python' && body.status === 'ready' && body.adapter === 'gemini'
        );
        startChild('worker AI', 'src/agent/workers/aiWorker.js');
        if (settings.sweeper) startChild('sweeper AI', 'src/agent/workers/aiSweeper.js');
        log('[dev:ai] Backend và AI đã chạy. Mở frontend bằng pnpm start. Ctrl+C để dừng.');
      } catch (error) {
        await stop(failure || (controller.signal.aborted && !failure ? undefined : error));
        if (failure) throw failure;
      }
    },
  };
}

async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || args.some((arg) => arg !== '--existing-backend'))
    throw new Error('Dùng pnpm dev:ai [--existing-backend].');
  const { repositoryDirectory } = require('../../backend/src/config/env');
  let env;
  try {
    env = pythonEnvironment(process.env);
  } catch {
    throw new Error(
      'AI chưa được cấu hình. Chạy pnpm ai:admin:enable để kiểm tra; không tự bật AI.'
    );
  }
  const backendUrl = new URL(env.AI_PYTHON_NODE_URL);
  backendUrl.pathname = '/api/health/ready';
  if (
    !args.length &&
    Number(backendUrl.port) !== Number(process.env.BACKEND_PORT || process.env.PORT || 5000)
  )
    throw new Error('PORT backend và cổng AI_INTERNAL_URL phải khớp.');
  const pythonUrl = new URL(
    `http://${env.AI_PYTHON_HOST.includes(':') ? `[${env.AI_PYTHON_HOST}]` : env.AI_PYTHON_HOST}:${env.AI_PYTHON_PORT}/health/ready`
  );
  const runtime = createDevRuntime({
    root: repositoryDirectory,
    backendUrl,
    pythonUrl,
    existingBackend: args.includes('--existing-backend'),
    sweeper: true,
  });
  const shutdown = () => {
    void runtime.stop();
  };
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
  main().catch((error) => {
    console.error(`[dev:ai] ${error.message}`);
    process.exitCode = 1;
  });
module.exports = { createDevRuntime, main };
