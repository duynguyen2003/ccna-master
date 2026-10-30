import { VERSION } from '../api/aiLabApi.js';
import contract from '@ccna/agent-contracts';

const running = (request) => request && ['QUEUED', 'RUNNING'].includes(request.status);
const initial = () => ({
  phase: 'loading',
  capabilities: null,
  quota: null,
  messages: [],
  optimisticQuestion: null,
  request: null,
  pending: null,
  error: null,
  historyError: null,
  nextCursor: null,
  loadingOlder: false,
  resetting: false,
  feedback: {},
  online: true,
});
const safeError = (error) => ({
  code: error.code || 'AI_NETWORK_ERROR',
  status: error.status,
  resetAt: error.resetAt,
  retryAfterMs: error.retryAfterMs,
});

// No response/question/token is persisted. This metadata only locates a request
// which the server must re-authorize. Injected IO makes races testable offline.
export function createAssistantController({
  api,
  userId,
  attemptId,
  storage,
  uuid = () => crypto.randomUUID(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  random = Math.random,
}) {
  let state = initial();
  let generation = 0;
  let active = false;
  let visible = true;
  let online = true;
  let timer;
  let abort;
  let payload = null;
  let failures = 0;
  let posting = false;
  let polling = false;
  let readingHistory = false;
  let cancelRequested = false;
  let cancelling = false;
  const listeners = new Set();
  const key = `ccna.ai.pending.v1:${encodeURIComponent(userId)}:${encodeURIComponent(attemptId)}`;
  const emit = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const valid = (stamp) => active && stamp === generation && !abort?.signal.aborted;
  const forget = () => {
    try {
      storage?.removeItem(key);
    } catch {}
  };
  const save = (pending) => {
    try {
      storage?.setItem(key, JSON.stringify(pending));
    } catch {}
  };
  const restore = () => {
    try {
      const data = JSON.parse(storage?.getItem(key) || 'null');
      if (
        data &&
        /^[0-9a-f-]{36}$/i.test(data.clientRequestId) &&
        (data.requestId == null || /^[0-9a-f-]{36}$/i.test(data.requestId))
      )
        return { clientRequestId: data.clientRequestId, requestId: data.requestId || null };
    } catch {}
    return null;
  };
  const stopIO = () => {
    generation++;
    clearTimer(timer);
    abort?.abort();
    abort = new AbortController();
    posting = false;
    polling = false;
    readingHistory = false;
    cancelling = false;
  };
  const clearPrivate = () => {
    stopIO();
    forget();
    payload = null;
    cancelRequested = false;
    emit({ ...initial(), phase: 'blocked', online, error: state.error });
  };
  const handleError = (error, stamp) => {
    if (!valid(stamp)) return;
    const failure = safeError(error);
    if (
      [401, 403].includes(error.status) ||
      error.code === 'AI_CONVERSATION_CHANGED' ||
      error.code === 'AI_RESOURCE_NOT_FOUND'
    ) {
      clearPrivate();
      emit({ error: failure, phase: 'blocked' });
      return;
    }
    emit({ error: failure, phase: online ? (state.pending ? 'uncertain' : 'error') : 'offline' });
  };
  const canRead = () => active && visible && online;
  function schedule(pollAfterMs = 2000) {
    clearTimer(timer);
    if (!canRead() || !state.pending) return;
    const backoff = [2000, 3000, 5000, 8000][Math.min(failures, 3)];
    timer = setTimer(
      () => {
        void poll();
      },
      Math.max(Number.isFinite(pollAfterMs) ? pollAfterMs : 0, backoff) + Math.floor(random() * 250)
    );
  }
  function adopt(request, stamp) {
    if (!valid(stamp)) return false;
    if (
      state.request?.requestId === request.requestId &&
      !running(state.request) &&
      state.request.status !== request.status
    )
      return false;
    const cap = state.capabilities;
    if (
      cap &&
      (request.conversationEpoch !== cap.conversationEpoch ||
        (cap.conversationId && request.conversationId !== cap.conversationId))
    ) {
      handleError({ code: 'AI_CONVERSATION_CHANGED' }, stamp);
      return false;
    }
    emit({
      request,
      optimisticQuestion: state.optimisticQuestion
        ? { ...state.optimisticQuestion, requestId: request.requestId }
        : null,
      quota: request.quota,
      error: null,
      capabilities: cap ? { ...cap, conversationId: request.conversationId } : cap,
      phase: running(request) ? 'pending' : 'ready',
    });
    if (running(request)) {
      const pending = { ...state.pending, requestId: request.requestId };
      emit({ pending });
      save(pending);
      schedule(request.pollAfterMs);
      if (cancelRequested && !posting) void cancelRequest();
    } else {
      clearTimer(timer);
      forget();
      payload = null;
      cancelRequested = false;
      emit({ pending: null });
      void history(false, stamp);
    }
    return true;
  }
  async function history(older = false, stamp = generation) {
    const cap = state.capabilities;
    if (!canRead() || !cap?.conversationId || readingHistory || (older && !state.nextCursor))
      return;
    readingHistory = true;
    if (older) emit({ loadingOlder: true });
    try {
      const page = await api.history(attemptId, older ? state.nextCursor : null, abort.signal);
      if (!valid(stamp)) return;
      if (
        page.conversationId !== cap.conversationId ||
        page.conversationEpoch !== cap.conversationEpoch
      )
        throw Object.assign(new Error(), { code: 'AI_CONVERSATION_CHANGED' });
      const merged = new Map(
        (older ? [...page.items, ...state.messages] : [...state.messages, ...page.items]).map(
          (item) => [item.messageId, item]
        )
      );
      const messages = [...merged.values()].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.messageId.localeCompare(b.messageId)
      );
      emit({
        messages,
        optimisticQuestion: messages.some(
          (item) => item.role === 'USER' && item.requestId === state.optimisticQuestion?.requestId
        )
          ? null
          : state.optimisticQuestion,
        nextCursor: older || !state.messages.length ? page.nextCursor : state.nextCursor,
        historyError: null,
      });
    } catch (error) {
      if (!valid(stamp)) return;
      if ([401, 403, 404].includes(error.status) || error.code === 'AI_CONVERSATION_CHANGED')
        handleError(error, stamp);
      else emit({ historyError: safeError(error) });
    } finally {
      if (valid(stamp)) {
        readingHistory = false;
        emit({ loadingOlder: false });
      }
    }
  }
  async function poll() {
    if (!canRead() || !state.pending || posting || polling) return;
    polling = true;
    clearTimer(timer);
    const stamp = generation;
    try {
      const pending = state.pending;
      const request = pending.requestId
        ? await api.read(attemptId, pending.requestId, abort.signal)
        : await api.recover(attemptId, pending.clientRequestId, abort.signal);
      failures = 0;
      adopt(request, stamp);
    } catch (error) {
      if (!valid(stamp)) return;
      if (error.status === 404 && !state.pending?.requestId) {
        // A lost POST response is not proof of failure. Never invent another ID.
        clearTimer(timer);
        try {
          // The same 404 also covers removed membership. Re-authorize before
          // retaining history or offering a retry of the original POST.
          const cap = await api.capabilities(attemptId, abort.signal);
          if (!valid(stamp)) return;
          if (!cap.eligible)
            throw Object.assign(new Error('AI_NOT_ELIGIBLE'), {
              status: 403,
              code: 'AI_NOT_ELIGIBLE',
            });
          if (
            state.capabilities &&
            (cap.conversationEpoch !== state.capabilities.conversationEpoch ||
              (state.capabilities.conversationId &&
                cap.conversationId !== state.capabilities.conversationId))
          )
            throw Object.assign(new Error('AI_CONVERSATION_CHANGED'), {
              code: 'AI_CONVERSATION_CHANGED',
            });
          emit({ phase: 'uncertain', error: { code: 'AI_REQUEST_NOT_FOUND' } });
        } catch (accessError) {
          handleError(accessError, stamp);
        }
      } else {
        failures++;
        handleError(error, stamp);
        if (state.phase !== 'blocked') schedule(error.retryAfterMs);
      }
    } finally {
      if (valid(stamp)) polling = false;
    }
  }
  async function connect() {
    if (!canRead()) return;
    stopIO();
    const stamp = generation;
    emit({ phase: 'loading', error: null });
    try {
      const cap = await api.capabilities(attemptId, abort.signal);
      if (!valid(stamp)) return;
      if (
        state.capabilities &&
        (state.capabilities.conversationEpoch !== cap.conversationEpoch ||
          state.capabilities.conversationId !== cap.conversationId)
      ) {
        forget();
        payload = null;
        emit({
          messages: [],
          request: null,
          pending: null,
          nextCursor: null,
          optimisticQuestion: null,
        });
      }
      emit({ capabilities: cap, phase: cap.eligible ? 'ready' : 'blocked' });
      if (!cap.eligible) return;
      const quota = await api.quota(attemptId, abort.signal);
      if (!valid(stamp)) return;
      emit({ quota: quota.quota });
      const pending = state.pending || restore();
      if (pending) emit({ pending, phase: 'pending' });
      await history(false, stamp);
      if (valid(stamp) && pending) await poll();
    } catch (error) {
      handleError(error, stamp);
    }
  }
  async function post() {
    if (!canRead() || !payload || posting) return;
    posting = true;
    const stamp = generation;
    const body = payload;
    clearTimer(timer);
    emit({ phase: 'sending', error: null });
    try {
      const request = await api.create(attemptId, body, abort.signal);
      adopt(request, stamp);
    } catch (error) {
      if (!valid(stamp)) return;
      if (
        (error.status && error.status < 500 && error.code !== 'AI_INVALID_RESPONSE') ||
        ['AI_DISABLED', 'AI_CAPACITY_EXHAUSTED', 'AI_BUDGET_PAUSED'].includes(error.code)
      ) {
        if (!['AI_IDEMPOTENCY_CONFLICT', 'AI_RECOVERY_RECONFIRM'].includes(error.code)) {
          forget();
          payload = null;
          emit({ pending: null, optimisticQuestion: null });
        }
        handleError(error, stamp);
      } else {
        emit({ phase: 'uncertain', error: safeError(error) });
        schedule();
      }
    } finally {
      if (valid(stamp)) {
        posting = false;
        if (cancelRequested && state.pending) void cancelRequest();
      }
    }
  }
  async function cancelRequest() {
    if (!canRead() || !state.pending) return;
    cancelRequested = true;
    if (posting || cancelling) return;
    cancelling = true;
    clearTimer(timer);
    const stamp = generation;
    try {
      if (!state.pending.requestId) await poll();
      if (!valid(stamp) || !state.pending?.requestId) return;
      const request = await api.cancel(attemptId, state.pending.requestId, abort.signal);
      adopt(request, stamp);
    } catch (error) {
      handleError(error, stamp);
    } finally {
      if (valid(stamp)) cancelling = false;
    }
  }
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    start({ isOnline = true, isVisible = true } = {}) {
      active = true;
      online = isOnline;
      visible = isVisible;
      emit({ online, phase: online ? 'loading' : 'offline' });
      return connect();
    },
    stop({ forgetPending = false } = {}) {
      active = false;
      stopIO();
      payload = null;
      cancelRequested = false;
      if (forgetPending) forget();
      state = initial();
    },
    setEnvironment({ isOnline = online, isVisible = visible }) {
      const resume = (!online || !visible) && isOnline && isVisible;
      online = isOnline;
      visible = isVisible;
      if (!online || !visible) {
        stopIO();
        emit({ online, ...(online ? {} : { phase: 'offline' }) });
      } else {
        emit({ online });
        if (resume) void connect();
      }
    },
    send(input, revision) {
      if (
        !canRead() ||
        state.pending ||
        state.resetting ||
        !state.capabilities?.eligible ||
        state.quota?.remaining === 0
      )
        return;
      const clientRequestId = uuid();
      cancelRequested = false;
      payload = {
        ...input,
        contractVersion: VERSION,
        clientRequestId,
        expectedRevision: revision,
        conversationEpoch: state.capabilities.conversationEpoch,
        recoveryEpoch: state.capabilities.recoveryEpoch,
      };
      if (!contract.schemas.CreateRequest.safeParse(payload).success) {
        payload = null;
        emit({ phase: 'error', error: { code: 'AI_INVALID_REQUEST' } });
        return;
      }
      const pending = { clientRequestId, requestId: null };
      save(pending);
      emit({
        pending,
        optimisticQuestion: {
          role: 'USER',
          messageId: clientRequestId,
          requestId: null,
          content:
            input.message?.trim() ||
            {
              NEXT_STEP: 'Gợi ý bước tiếp theo',
              DIAGNOSE: 'Phân tích kết nối',
              EXPLAIN_CONCEPT: 'Giải thích khái niệm',
              LAB_REVIEW: 'Giải thích kết quả chấm',
            }[input.intent],
        },
      });
      return post();
    },
    async retry() {
      if (!canRead()) return;
      if (!state.capabilities) return connect();
      if (state.pending) {
        await poll();
        if (state.error?.code === 'AI_REQUEST_NOT_FOUND' && payload) return post();
      } else return connect();
    },
    async newQuestion() {
      if (running(state.request)) return;
      forget();
      payload = null;
      emit({ pending: null, request: null, error: null, optimisticQuestion: null });
      return connect();
    },
    cancel: cancelRequest,
    loadOlder: () => history(true),
    reloadHistory: () => history(false),
    async resetConversation() {
      const cap = state.capabilities;
      if (!canRead() || !cap?.conversationId || state.resetting) return false;
      stopIO();
      const stamp = generation;
      emit({ resetting: true, error: null });
      try {
        await api.reset(attemptId, cap.conversationId, cap.conversationEpoch, abort.signal);
        if (!valid(stamp)) return false;
        forget();
        payload = null;
        cancelRequested = false;
        emit({ ...initial(), online, phase: 'loading', resetting: true });
        await connect();
        emit({ resetting: false });
        return true;
      } catch (error) {
        if (valid(stamp)) {
          emit({ resetting: false });
          handleError(error, stamp);
          if (state.pending) schedule();
        }
        return false;
      }
    },
    async feedback(messageId, input) {
      if (!canRead() || state.feedback[messageId]?.pending) return;
      const stamp = generation;
      emit({ feedback: { ...state.feedback, [messageId]: { pending: true } } });
      try {
        const result = await api.feedback(attemptId, messageId, input, abort.signal);
        if (!valid(stamp)) return;
        emit({
          feedback: { ...state.feedback, [messageId]: { helpful: result.helpful, saved: true } },
        });
      } catch (error) {
        if (!valid(stamp)) return;
        if ([401, 403, 404].includes(error.status)) handleError(error, stamp);
        else emit({ feedback: { ...state.feedback, [messageId]: { error: true } } });
      }
    },
  };
}
