import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../services/Api';

export default function useActivityCalendar(period, type) {
  const { token } = useAuth();
  const [state, setState] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${period}:${type}`;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    window.addEventListener('focus', retry);
    return () => window.removeEventListener('focus', retry);
  }, [retry]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    let cancelled = false;
    const filters =
      period === 'last365' ? { range: 'last365', type } : { range: 'year', year: period, type };
    setState((previous) => ({
      token,
      key,
      loading: true,
      availableYears: previous?.token === token ? previous.availableYears : undefined,
    }));
    const load = async () => {
      try {
        const data = await api.getActivityCalendar(token, filters, { signal: controller.signal });
        if (
          !data ||
          !Array.isArray(data.days) ||
          !Array.isArray(data.levels) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(data.from) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(data.to)
        )
          throw new Error('INVALID_CALENDAR');
        if (!cancelled)
          setState({ token, key, data, loading: false, availableYears: data.availableYears });
      } catch {
        if (!cancelled) setState({ token, key, error: true, loading: false });
      }
    };
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, key, period, type, attempt]);

  // Scope the render too: effects run after paint, so clearing only in the effect
  // could briefly display another account's or another filter's result.
  const current = token && state?.token === token && state?.key === key;
  return { ...(current ? state : { loading: true }), retry };
}
