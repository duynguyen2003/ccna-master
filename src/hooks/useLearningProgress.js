import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/Api';
import { normalizeLearningPath } from '../utils/learningPathAdapter';
import { learningKeys } from './useLearningPath';

// ── In-memory One-time Transition Event Store ──────────────────────────────
let pendingTransitionEvent = null;

export const storeTransitionEvent = (transition, userId) => {
  if (!transition || !transition.changed) return;
  pendingTransitionEvent = {
    ...transition,
    userId,
    timestamp: Date.now(),
    consumed: false,
  };
};

export const consumeTransitionEvent = (userId) => {
  if (!pendingTransitionEvent) return null;
  if (pendingTransitionEvent.consumed) return null;
  if (userId && pendingTransitionEvent.userId && pendingTransitionEvent.userId !== userId) {
    return null;
  }
  pendingTransitionEvent.consumed = true;
  const event = { ...pendingTransitionEvent };
  return event;
};

export const peekTransitionEvent = (userId) => {
  if (!pendingTransitionEvent || pendingTransitionEvent.consumed) return null;
  if (userId && pendingTransitionEvent.userId && pendingTransitionEvent.userId !== userId) {
    return null;
  }
  return pendingTransitionEvent;
};

export const clearTransitionEvents = () => {
  pendingTransitionEvent = null;
};

export const useLearningProgress = () => {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();

  const handleSuccessfulProgress = useCallback(
    (response) => {
      if (!user) return;
      const pathKey = learningKeys.path(user.id);

      // Cập nhật snapshot learning-path nếu server trả về
      if (response?.learningPath) {
        queryClient.setQueryData(pathKey, normalizeLearningPath(response.learningPath));
      }

      // Invalidate các query liên quan
      queryClient.invalidateQueries({ queryKey: learningKeys.progress(user.id) });
      queryClient.invalidateQueries({ queryKey: learningKeys.courses(user.id) });
      queryClient.invalidateQueries({ queryKey: learningKeys.profile(user.id) });

      // Lưu transition event nếu có thay đổi
      if (response?.transition?.changed) {
        storeTransitionEvent(response.transition, user.id);
        window.dispatchEvent(
          new CustomEvent('learning_progress_updated', {
            detail: { transition: response.transition, userId: user.id },
          })
        );
      }
    },
    [user, queryClient]
  );

  // Mutation cho POST /api/users/progress
  const progressMutation = useMutation({
    mutationKey: ['progress-update', user?.id],
    mutationFn: async (payload) => {
      if (!token) throw new Error('Yêu cầu đăng nhập');
      return await api.updateUserProgress(token, payload);
    },
    onMutate: async () => {
      if (user?.id) {
        await queryClient.cancelQueries({ queryKey: learningKeys.path(user.id) });
      }
    },
    onSuccess: (data) => {
      handleSuccessfulProgress(data);
    },
    retry: false,
  });

  // Mutation cho PATCH /api/learning/modules/:moduleId/progress
  const moduleMutation = useMutation({
    mutationKey: ['module-complete', user?.id],
    mutationFn: async (moduleId) => {
      if (!token) throw new Error('Yêu cầu đăng nhập');
      return await api.completeModule(token, moduleId);
    },
    onMutate: async () => {
      if (user?.id) {
        await queryClient.cancelQueries({ queryKey: learningKeys.path(user.id) });
      }
    },
    onSuccess: (data) => {
      handleSuccessfulProgress(data);
    },
    retry: false,
  });

  // Helper trực tiếp áp dụng kết quả chấm từ CLI Lab hoặc Packet Tracer
  const applyGradingResult = useCallback(
    (result) => {
      handleSuccessfulProgress(result);
    },
    [handleSuccessfulProgress]
  );

  return {
    saveProgress: progressMutation.mutateAsync,
    saveProgressSync: progressMutation.mutate,
    completeModule: moduleMutation.mutateAsync,
    completeModuleSync: moduleMutation.mutate,
    applyGradingResult,
    isSaving: progressMutation.isPending || moduleMutation.isPending,
    isPending: progressMutation.isPending || moduleMutation.isPending,
    error: progressMutation.error || moduleMutation.error,
    consumeTransitionEvent: () => consumeTransitionEvent(user?.id),
    peekTransitionEvent: () => peekTransitionEvent(user?.id),
  };
};

export default useLearningProgress;
