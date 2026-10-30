import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createAiLabApi } from '../api/aiLabApi.js';
import { createAssistantController } from '../state/assistantController.js';

const sessionStorageOrNull = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export default function useAiLabAssistant({
  baseUrl,
  token,
  userId,
  attemptId,
  onUnauthorized,
  api: injectedApi,
}) {
  const api = useMemo(
    () => injectedApi || createAiLabApi({ baseUrl, token, onUnauthorized }),
    [baseUrl, token, onUnauthorized, injectedApi]
  );
  // A new scope has an empty snapshot synchronously, before effect cleanup.
  const controller = useMemo(
    () => createAssistantController({ api, userId, attemptId, storage: sessionStorageOrNull() }),
    [api, userId, attemptId]
  );
  const identity = `${token}:${userId}:${attemptId}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );
  useEffect(() => {
    const environment = () => ({
      isOnline: navigator.onLine !== false,
      isVisible: document.visibilityState !== 'hidden',
    });
    const update = () => controller.setEnvironment(environment());
    void controller.start(environment());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      document.removeEventListener('visibilitychange', update);
      controller.stop({ forgetPending: currentIdentity.current !== identity });
    };
  }, [controller, identity]);
  return { state, controller };
}
