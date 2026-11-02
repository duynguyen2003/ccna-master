// Synthetic HTTP transport/load benchmark. No app DB, provider or credentials.
const http = require('node:http');
const express = require('express');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { createRequestStreamHub } = require('../node/requestStream');
const { examples } = require('../contracts/ai-lab/v1/fixtures/build-cases.cjs');
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];

async function scenario(count) {
  const rows = new Map();
  const waits = [],
    first = [],
    complete = [];
  let active = 0,
    peakWorkers = 0,
    peakConnections = 0;
  const queued = [];
  function finish(row) {
    row.data = {
      ...structuredClone(examples.resource),
      requestId: row.id,
      progress: {
        ...row.data.progress,
        phase: 'FINISHED',
        unitStatus: 'CONSUMED',
        streamVersion: row.data.progress.streamVersion + 1,
      },
    };
    active--;
    work();
  }
  function work() {
    while (active < 4 && queued.length) {
      const row = queued.shift();
      active++;
      peakWorkers = Math.max(peakWorkers, active);
      waits.push(performance.now() - row.started);
      row.data.status = 'RUNNING';
      row.data.progress.phase = 'ANALYZING';
      row.data.progress.streamVersion++;
      setTimeout(finish, 120, row);
    }
  }
  const hub = createRequestStreamHub({
    intervalMs: 1000,
    read: async (principal, attempt, id) => {
      const row = rows.get(id);
      if (!row || row.userId !== principal.id)
        throw Object.assign(new Error(), { code: 'AI_RESOURCE_NOT_FOUND' });
      return { data: row.data };
    },
  });
  const app = express();
  app.use(express.json());
  app.post('/requests', (req, res) => {
    const id = randomUUID();
    const row = {
      id,
      userId: req.body.userId,
      started: performance.now(),
      data: {
        ...structuredClone(examples.resource),
        requestId: id,
        status: 'QUEUED',
        responseMode: 'NONE',
        result: null,
        pollAfterMs: 2000,
        progress: {
          streamVersion: 1,
          phase: 'QUEUED',
          unitStatus: 'RESERVED',
          reasonCode: null,
          deadlineAt: new Date(Date.now() + 60000).toISOString(),
        },
      },
    };
    rows.set(id, row);
    queued.push(row);
    res.status(202).json({ requestId: id });
  });
  app.get('/requests/:id/events', async (req, res) => {
    try {
      await hub.attach({
        principal: { id: Number(req.headers['x-synthetic-user']), sessionVersion: 1 },
        attemptId: 'synthetic',
        requestId: req.params.id,
        res,
      });
      peakConnections = Math.max(peakConnections, hub.stats().connections);
      if (peakConnections === count) work();
    } catch {
      res.status(404).end();
    }
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const heapBefore = process.memoryUsage().heapUsed;
  let peakHeap = heapBefore,
    failures = 0;
  const sample = setInterval(() => {
    peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
  }, 10);
  try {
    await Promise.all(
      Array.from({ length: count }, async (_, i) => {
        const start = performance.now();
        try {
          const admission = await fetch(`${base}/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: i + 1 }),
          });
          const { requestId } = await admission.json();
          const response = await fetch(`${base}/requests/${requestId}/events`, {
            headers: { 'X-Synthetic-User': String(i + 1) },
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) throw new Error();
          const reader = response.body.getReader();
          let received = false,
            result = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!received) {
              first.push(performance.now() - start);
              received = true;
            }
            result += new TextDecoder().decode(value);
          }
          if (!result.includes('event: result')) throw new Error();
          complete.push(performance.now() - start);
        } catch {
          failures++;
        }
      })
    );
    const stats = hub.stats();
    return {
      connections: count,
      failures,
      peakConnections,
      syntheticWorkerLimit: 4,
      snapshotPollMs: 1000,
      peakWorkers,
      transportFirstEventMs: { p50: percentile(first, 0.5), p95: percentile(first, 0.95) },
      completeMs: { p50: percentile(complete, 0.5), p95: percentile(complete, 0.95) },
      syntheticQueueMs: { p95: percentile(waits, 0.95) },
      snapshotReads: stats.queries,
      heapGrowthPeakBytes: peakHeap - heapBefore,
      heapGrowthPerConnectionBytes: Math.ceil((peakHeap - heapBefore) / count),
      remainingConnections: stats.connections,
    };
  } finally {
    clearInterval(sample);
    hub.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
(async () => {
  const results = [];
  for (const count of [1, 40, 80]) results.push(await scenario(count));
  console.log(
    JSON.stringify(
      {
        mode: 'synthetic-local-http',
        note: 'Includes client/server allocations; not isolated socket memory, real DB, model latency or browser paint.',
        results,
      },
      null,
      2
    )
  );
  if (results.some((r) => r.failures || r.remainingConnections)) process.exitCode = 1;
})().catch(() => {
  console.error('STREAM_BENCHMARK_FAILED');
  process.exitCode = 1;
});
