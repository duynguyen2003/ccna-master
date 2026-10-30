/* global globalThis */
import contract from '@ccna/agent-contracts';

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
