import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/Api';
import { normalizeLearningPath } from '../utils/learningPathAdapter';

export const learningKeys = {
  all: ['learning'],
  path: (userId) => ['learning-path', userId],
  courses: (userId) => ['courses', userId ?? 'guest'],
  progress: (userId) => ['user-progress', userId],
  profile: (userId) => ['profile', userId],
};

const COLD_START_THRESHOLD_MS = 4000;

export const useLearningPath = () => {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isColdStarting, setIsColdStarting] = useState(false);
  const prevUserIdRef = useRef(user?.id);

  // Quản lý dọn cache khi chuyển user hoặc logout
  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    if (prevUserId && prevUserId !== user?.id) {
      queryClient.cancelQueries({ queryKey: learningKeys.path(prevUserId) });
      queryClient.removeQueries({ queryKey: learningKeys.path(prevUserId) });
      queryClient.removeQueries({ queryKey: learningKeys.progress(prevUserId) });
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id, queryClient]);

  const query = useQuery({
    queryKey: learningKeys.path(user?.id),
    queryFn: async ({ signal }) => {
      const data = await api.getLearningPath(token, { signal });
      return normalizeLearningPath(data);
    },
    enabled: !authLoading && isAuthenticated && Boolean(token),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, error) => {
      // 401, 403, 404, 400 không retry
      if (error?.status && error.status < 500) return false;
      return failureCount < 2;
    },
  });

  // Theo dõi Render cold start (> 4s khi đang fetch)
  useEffect(() => {
    let timer = null;
    if (query.isLoading || (query.isFetching && !query.data)) {
      timer = setTimeout(() => {
        setIsColdStarting(true);
      }, COLD_START_THRESHOLD_MS);
    } else {
      setIsColdStarting(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [query.isLoading, query.isFetching, query.data]);

  return {
    learningPath: query.data || null,
    courses: query.data?.courses || [],
    stats: query.data?.stats || { streakDays: 0, xp: 0, badges: 0, overallProgress: 0 },
    currentCourseId: query.data?.currentCourseId || null,
    isLoading: query.isLoading,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isColdStarting,
    isAuthenticated,
    authLoading,
  };
};

export default useLearningPath;
