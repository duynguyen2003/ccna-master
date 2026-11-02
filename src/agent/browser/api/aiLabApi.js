/* global globalThis */
import contract from '@ccna/agent-contracts';
import { readSse } from './sse.js';

const { VERSION, schemas, parseRequestResource } = contract;
export { VERSION };

export function validateResult(result) {
  const evidence = new Set(result.evidence.map((entry) => entry.evidenceId));
  const commands = new Set(result.commands.map((entry) => entry.commandId));
  if (
    result.answer.evidenceIds.some((id) => !evidence.has(id)) ||
    result.answer.nextSteps.some((step) => step.commandId && !commands.has(step.commandId))
  )
    throw Object.assign(new Error('AI_INVALID_RESPONSE'), { code: 'AI_INVALID_RESPONSE' });
  return result;
}

export function createAiLabApi({
  baseUrl,
  token,
  fetchImpl = globalThis.fetch,
  onUnauthorized = () => {},
  timeoutMs = 15000,
}) {
  async function call(attemptId, path, schema, { signal, body, method = 'GET' } = {}) {
    const abort = new AbortController();
    const cancel = () => abort.abort();
    if (signal?.aborted) cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(cancel, timeoutMs);
    try {
      const response = await fetchImpl(
        `${baseUrl.replace(/\/$/, '')}/lab-attempts/${encodeURIComponent(attemptId)}/ai${path}`,
        {
          method,
          signal: abort.signal,
          cache: 'no-store',
          credentials: 'omit',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-AI-Contract-Version': VERSION,
            'X-AI-Progress': '1',
            'Content-Type': 'application/json',
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        }
      );
      const json = await response.json().catch(() => null);
      if (response.status === 401) {
        onUnauthorized();
        throw Object.assign(new Error('AI_UNAUTHENTICATED'), {
          code: 'AI_UNAUTHENTICATED',
          status: 401,
        });
      }
      if (!response.ok) {
        const parsed = schemas.ErrorResponse.safeParse(json);
        const retryAfter = response.headers?.get('retry-after');
        throw Object.assign(new Error('AI_HTTP_ERROR'), {
          status: response.status,
          code: parsed.success ? parsed.data.error.code : 'AI_HTTP_ERROR',
          resetAt: parsed.success ? parsed.data.error.resetAt : undefined,
          retryAfterMs:
            parsed.success && parsed.data.error.retryAfterSeconds !== undefined
              ? parsed.data.error.retryAfterSeconds * 1000
              : /^\d+$/.test(retryAfter || '')
                ? Number(retryAfter) * 1000
                : undefined,
        });
      }
      if (response.headers?.get('x-ai-contract-version') !== VERSION)
        throw Object.assign(new Error('AI_INVALID_RESPONSE'), { code: 'AI_INVALID_RESPONSE' });
      const parsed = schema.safeParse(json);
      if (!parsed.success)
        throw Object.assign(new Error('AI_INVALID_RESPONSE'), { code: 'AI_INVALID_RESPONSE' });
      const data = parsed.data.data;
      if (schema === schemas.RequestResponse) {
        parseRequestResource(data);
        if (data.result) validateResult(data.result);
      }
      if (schema === schemas.HistoryResponse)
        data.items
          .filter((item) => item.role === 'ASSISTANT')
          .forEach((item) => validateResult(item.result));
      return data;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!error.code)
        throw Object.assign(new Error('AI_NETWORK_ERROR'), { code: 'AI_NETWORK_ERROR' });
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
    }
  }
  return {
    async events(attempt, id, { signal, lastEventId, onEvent } = {}) {
      const abort = new AbortController();
      const cancel = () => abort.abort();
      if (signal?.aborted) cancel();
      signal?.addEventListener('abort', cancel, { once: true });
      let idle;
      const activity = () => {
        clearTimeout(idle);
        idle = setTimeout(cancel, 20000);
      };
      const total = setTimeout(cancel, 85000);
      const firstEvent = setTimeout(cancel, 5000);
      activity();
      try {
        const response = await fetchImpl(
          `${baseUrl.replace(/\/$/, '')}/lab-attempts/${encodeURIComponent(attempt)}/ai/requests/${encodeURIComponent(id)}/events`,
          {
            signal: abort.signal,
            cache: 'no-store',
            credentials: 'omit',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'text/event-stream',
              'X-AI-Contract-Version': VERSION,
              ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
            },
          }
        );
        if (!response.ok) {
          const error = schemas.ErrorResponse.safeParse(await response.json().catch(() => null));
          if (response.status === 401) onUnauthorized();
          throw Object.assign(new Error('AI_HTTP_ERROR'), {
            status: response.status,
            code:
              response.status === 401
                ? 'AI_UNAUTHENTICATED'
                : error.success
                  ? error.data.error.code
                  : 'AI_HTTP_ERROR',
          });
        }
        if (
          response.headers.get('x-ai-contract-version') !== VERSION ||
          !/^text\/event-stream(?:;|$)/i.test(response.headers.get('content-type') || '')
        )
          throw Object.assign(new Error('AI_STREAM_UNAVAILABLE'), {
            code: 'AI_STREAM_UNAVAILABLE',
          });
        await readSse(
          response.body,
          (frame) => {
            let json;
            try {
              json = JSON.parse(frame.data);
            } catch {
              throw Object.assign(new Error('AI_INVALID_RESPONSE'), {
                code: 'AI_INVALID_RESPONSE',
              });
            }
            if (frame.type === 'error') {
              const parsed = schemas.ErrorResponse.parse(json);
              const code = parsed.error.code;
              if (code === 'UNAUTHORIZED') onUnauthorized();
              throw Object.assign(new Error(code), { code, status: contract.ErrorStatuses[code] });
            }
            const event = schemas.RequestStreamEvent.parse(json);
            const data = parseRequestResource(event.data);
            const expected = data.result
              ? 'result'
              : ['QUEUED', 'RUNNING'].includes(data.status)
                ? 'state'
                : 'terminal';
            if (
              data.requestId !== id ||
              !data.progress ||
              event.kind !== frame.type ||
              event.kind !== expected ||
              frame.id !== `${id}:${data.progress.streamVersion}`
            )
              throw Object.assign(new Error('AI_INVALID_RESPONSE'), {
                code: 'AI_INVALID_RESPONSE',
              });
            if (data.result) validateResult(data.result);
            clearTimeout(firstEvent);
            onEvent({ ...event, id: frame.id });
          },
          { signal: abort.signal, onActivity: activity }
        );
      } finally {
        clearTimeout(idle);
        clearTimeout(total);
        clearTimeout(firstEvent);
        signal?.removeEventListener('abort', cancel);
        abort.abort();
      }
    },
    capabilities: (attempt, signal) =>
      call(attempt, '/capabilities', schemas.CapabilitiesResponse, { signal }),
    quota: (attempt, signal) => call(attempt, '/quota', schemas.QuotaResponse, { signal }),
    reset: (attempt, conversationId, conversationEpoch, signal) =>
      call(
        attempt,
        `/conversations/${encodeURIComponent(conversationId)}`,
        schemas.DeleteConversationResponse,
        {
          signal,
          method: 'DELETE',
          body: { contractVersion: VERSION, conversationEpoch },
        }
      ),
    create: (attempt, input, signal) =>
      call(attempt, '/requests', schemas.RequestResponse, {
        signal,
        method: 'POST',
        body: schemas.CreateRequest.parse(input),
      }),
    read: (attempt, id, signal) =>
      call(attempt, `/requests/${encodeURIComponent(id)}`, schemas.RequestResponse, { signal }),
    recover: (attempt, id, signal) =>
      call(attempt, `/requests/by-client-id/${encodeURIComponent(id)}`, schemas.RequestResponse, {
        signal,
      }),
    cancel: (attempt, id, signal) =>
      call(attempt, `/requests/${encodeURIComponent(id)}/cancel`, schemas.RequestResponse, {
        signal,
        method: 'POST',
      }),
    history: (attempt, cursor, signal) =>
      call(
        attempt,
        `/messages?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        schemas.HistoryResponse,
        { signal }
      ),
    feedback: (attempt, id, input, signal) =>
      call(attempt, `/messages/${encodeURIComponent(id)}/feedback`, schemas.FeedbackResponse, {
        signal,
        method: 'POST',
        body: schemas.FeedbackRequest.parse({ contractVersion: VERSION, ...input }),
      }),
  };
}
