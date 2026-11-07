const {
  VERSION,
  schemas,
  ErrorStatuses,
  parseRequestResource,
} = require('@ccna/shared/aiLabContract');

const kindOf = (data) =>
  data.result ? 'result' : ['QUEUED', 'RUNNING'].includes(data.status) ? 'state' : 'terminal';
const encode = (data) => {
  const event = schemas.RequestStreamEvent.parse({
    contractVersion: VERSION,
    kind: kindOf(data),
    data: parseRequestResource(data),
  });
  return `id: ${data.requestId}:${data.progress.streamVersion}\nevent: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
};

// One bounded polling loop per authorized request/session in this process, shared by tabs.
// Each read rechecks membership, account/session and policy. No transaction spans the stream.
function createRequestStreamHub({
  read,
  intervalMs = 1000,
  heartbeatMs = 10000,
  maxDurationMs = 75000,
  maxPerUser = 2,
  maxConnections = 256,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  setDeadlineTimer = setTimeout,
  clearDeadlineTimer = clearTimeout,
} = {}) {
  const groups = new Map();
  const counts = new Map();
  let connections = 0;
  let queries = 0;
  function close(sub, endResponse = true) {
    if (sub.closed) return;
    sub.closed = true;
    clearDeadlineTimer(sub.deadlineTimer);
    sub.res.off('close', sub.onClose);
    sub.group?.subscribers.delete(sub);
    counts.set(sub.userId, Math.max(0, (counts.get(sub.userId) || 1) - 1));
    if (!counts.get(sub.userId)) counts.delete(sub.userId);
    connections--;
    if (endResponse && !sub.res.writableEnded) sub.res.end();
    if (sub.group && !sub.group.subscribers.size) {
      clearTimer(sub.group.timer);
      if (groups.get(sub.group.key) === sub.group) groups.delete(sub.group.key);
    }
  }
  function write(sub, text) {
    if (sub.closed || sub.res.destroyed) {
      close(sub);
      return;
    }
    // A slow reader recovers from a snapshot; don't accumulate output in memory.
    try {
      if (
        Buffer.byteLength(text) > 131072 ||
        sub.res.writableLength > 131072 ||
        !sub.res.write(text)
      )
        close(sub);
    } catch {
      close(sub);
    }
  }
  function send(sub, data, force = false) {
    if (sub.closed) return;
    if (now() >= sub.expiresAt) {
      close(sub);
      return;
    }
    const version = data.progress.streamVersion;
    if (force || version !== sub.version || kindOf(data) !== 'state') {
      write(sub, encode(data));
      sub.version = version;
      sub.lastWrite = now();
    } else if (now() - sub.lastWrite >= heartbeatMs) {
      write(sub, `: heartbeat ${now()}\n\n`);
      sub.lastWrite = now();
    }
    if (kindOf(data) !== 'state') close(sub);
  }
  async function tick(group) {
    if (groups.get(group.key) !== group) return;
    try {
      for (const sub of [...group.subscribers]) if (now() >= sub.expiresAt) close(sub);
      if (!group.subscribers.size) return;
      queries++;
      const response = await read(group.principal, group.attemptId, group.requestId);
      if (groups.get(group.key) !== group) return;
      for (const sub of [...group.subscribers]) send(sub, response.data);
    } catch (error) {
      const code = ErrorStatuses[error.code]
        ? error.code
        : error.status === 401
          ? 'UNAUTHORIZED'
          : error.status === 404
            ? 'AI_RESOURCE_NOT_FOUND'
            : 'AI_INTERNAL_ERROR';
      for (const sub of [...group.subscribers]) {
        write(
          sub,
          `event: error\ndata: ${JSON.stringify({ contractVersion: VERSION, error: { code, message: code } })}\n\n`
        );
        close(sub);
      }
    } finally {
      if (group.subscribers.size && groups.get(group.key) === group) {
        group.timer = setTimer(() => void tick(group), intervalMs);
        group.timer?.unref?.();
      }
    }
  }
  return {
    async attach({ principal, attemptId, requestId, res }) {
      if (connections >= maxConnections || (counts.get(principal.id) || 0) >= maxPerUser)
        throw Object.assign(new Error('AI_CONCURRENT_LIMIT'), { code: 'AI_CONCURRENT_LIMIT' });
      const sub = {
        userId: principal.id,
        res,
        version: null,
        lastWrite: now(),
        expiresAt: Math.min(now() + maxDurationMs, principal.tokenExpiresAt || Infinity),
        closed: false,
      };
      connections++;
      counts.set(sub.userId, (counts.get(sub.userId) || 0) + 1);
      sub.onClose = () => close(sub);
      res.on('close', sub.onClose);
      sub.deadlineTimer = setDeadlineTimer(() => close(sub), Math.max(0, sub.expiresAt - now()));
      sub.deadlineTimer?.unref?.();
      try {
        queries++;
        const response = await read(principal, attemptId, requestId);
        if (sub.closed || res.destroyed) {
          close(sub);
          return;
        }
        const data = response.data;
        const key = `${principal.id}:${principal.sessionVersion}:${attemptId}:${requestId}`;
        let group = groups.get(key);
        if (!group) {
          group = { key, principal, attemptId, requestId, subscribers: new Set() };
          groups.set(key, group);
        }
        sub.group = group;
        group.subscribers.add(sub);
        res.status(200).set({
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store, no-transform',
          'X-Accel-Buffering': 'no',
          'X-AI-Contract-Version': VERSION,
        });
        res.flushHeaders();
        // Reconnection always receives the current snapshot, including a committed terminal result.
        send(sub, data, true);
        if (group.subscribers.size && !group.timer) {
          group.timer = setTimer(() => void tick(group), intervalMs);
          group.timer?.unref?.();
        }
      } catch (error) {
        // Before headers the route returns the ordinary typed HTTP error.
        close(sub, false);
        throw error;
      }
    },
    stats: () => ({ connections, groups: groups.size, queries }),
    close() {
      for (const group of [...groups.values()])
        for (const sub of [...group.subscribers]) close(sub);
    },
  };
}
module.exports = { createRequestStreamHub, kindOf, encode };
