import React, { useEffect, useRef, useState } from 'react';
import YouTube from 'react-youtube';
import api from '../../services/Api';

export const formatVideoTime = (value) => {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  return hours
    ? [hours, String(minutes).padStart(2, '0'), remainder].join(':')
    : [minutes, remainder].join(':');
};

const getYoutubeVideoId = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    if (host === 'youtu.be' || host === 'www.youtu.be') return parsed.pathname.slice(1);
    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      return parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    }
  } catch {
    return null;
  }
  return null;
};

const newSessionId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const random = Math.floor(Math.random() * 16);
        return (character === 'x' ? random : (random & 3) | 8).toString(16);
      });

const initialBookmark = { lastPosition: 0, watchedSeconds: 0, isCompleted: false };

const VideoProgressPlayer = ({
  url,
  lessonId,
  token,
  user,
  onProgressChange,
  onMetricsChange,
  seekRequest,
}) => {
  const youtubeId = getYoutubeVideoId(url);
  const [bookmark, setBookmark] = useState(initialBookmark);
  const [progressLoaded, setProgressLoaded] = useState(!token);
  const [bookmarkLoadError, setBookmarkLoadError] = useState(false);
  const [bookmarkAttempt, setBookmarkAttempt] = useState(0);
  const [playerError, setPlayerError] = useState(false);
  const playerRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const intervalRef = useRef(null);
  const retryTimerRef = useRef(null);
  const lastTickRef = useRef(null);
  const isPlayingRef = useRef(false);
  const maxViewedTimeRef = useRef(0);
  const resumeTargetRef = useRef(0);
  const baseWatchedSecondsRef = useRef(0);
  const watchedMsRef = useRef(0);
  const sessionIdRef = useRef(null);
  if (!sessionIdRef.current) sessionIdRef.current = newSessionId();
  const sessionStartedAtRef = useRef(null);
  if (!sessionStartedAtRef.current) sessionStartedAtRef.current = new Date().toISOString();
  const sequenceRef = useRef(0);
  const lastQueuedRef = useRef(null);
  const lastQueuedAtRef = useRef(0);
  const pendingRef = useRef(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const callbacksRef = useRef({ onProgressChange, onMetricsChange });
  callbacksRef.current = { onProgressChange, onMetricsChange };

  const emitMetrics = (patch) => callbacksRef.current.onMetricsChange?.(lessonId, patch);

  useEffect(() => {
    let active = true;
    if (!token) {
      setProgressLoaded(true);
      emitMetrics({ saveStatus: 'guest' });
      return () => {
        active = false;
      };
    }
    setProgressLoaded(false);
    setBookmarkLoadError(false);
    emitMetrics({ saveStatus: 'loading' });
    api
      .getVideoProgress(token, lessonId)
      .then((response) => {
        if (!active) return;
        const next = { ...initialBookmark, ...response.data };
        setBookmark(next);
        setProgressLoaded(true);
        maxViewedTimeRef.current = Math.max(0, next.lastPosition || 0);
        resumeTargetRef.current = Math.max(0, next.lastPosition || 0);
        baseWatchedSecondsRef.current = Math.max(0, next.watchedSeconds || 0);
        emitMetrics({
          lastPosition: next.lastPosition || 0,
          playedSeconds: next.lastPosition || 0,
          watchedSeconds: next.watchedSeconds || 0,
          serverCompleted: Boolean(next.isCompleted),
          saveStatus: 'saved',
        });
      })
      .catch((error) => {
        if (!active) return;
        console.error('Không tải được vị trí xem tiếp:', error);
        setBookmarkLoadError(true);
        emitMetrics({ saveStatus: 'error' });
      });
    return () => {
      active = false;
    };
    // Component được remount theo lessonId; callback mới được đọc qua ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, token, bookmarkAttempt]);

  const pump = () => {
    if (!token || inFlightRef.current || !pendingRef.current) return;
    const payload = pendingRef.current;
    pendingRef.current = null;
    inFlightRef.current = true;
    if (mountedRef.current) emitMetrics({ saveStatus: 'saving' });
    api
      .updateVideoProgress(token, payload)
      .then((response) => {
        if (mountedRef.current) {
          emitMetrics({
            lastPosition: response.data?.lastPosition ?? payload.lastPosition,
            watchedSeconds: response.data?.watchedSeconds ?? baseWatchedSecondsRef.current,
            saveStatus: 'saved',
          });
        }
      })
      .catch((error) => {
        console.error('Không lưu được tiến độ video:', error);
        if (!pendingRef.current || pendingRef.current.sequence < payload.sequence) {
          pendingRef.current = payload;
        }
        if (mountedRef.current) emitMetrics({ saveStatus: 'error' });
        if (!retryTimerRef.current && mountedRef.current) {
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null;
            pump();
          }, 2500);
        }
      })
      .finally(() => {
        inFlightRef.current = false;
        if (pendingRef.current && !retryTimerRef.current && mountedRef.current) pump();
      });
  };

  const queueSnapshot = (force = false, keepalive = false) => {
    if (!token || !playerRef.current || resumeTargetRef.current > 0) return;
    const currentPosition = Math.max(0, Math.floor(playerRef.current.getCurrentTime() || 0));
    const sessionWatchedSeconds = Math.floor(watchedMsRef.current / 1000);
    const previous = lastQueuedRef.current;
    if (
      previous &&
      previous.lastPosition === currentPosition &&
      previous.sessionWatchedSeconds === sessionWatchedSeconds
    ) {
      if (keepalive) api.updateVideoProgress(token, previous, { keepalive: true }).catch(() => {});
      return;
    }
    if (!force && Date.now() - lastQueuedAtRef.current < 10000) return;
    const payload = {
      lessonId,
      sessionId: sessionIdRef.current,
      sessionStartedAt: sessionStartedAtRef.current,
      sequence: ++sequenceRef.current,
      sessionWatchedSeconds,
      lastPosition: currentPosition,
      capturedAt: new Date().toISOString(),
    };
    lastQueuedRef.current = payload;
    lastQueuedAtRef.current = Date.now();
    if (keepalive) {
      api.updateVideoProgress(token, payload, { keepalive: true }).catch(() => {});
    } else {
      pendingRef.current = payload;
      pump();
    }
  };

  const sample = (player, force = false) => {
    if (!player) return;
    const currentTime = Math.max(0, Number(player.getCurrentTime()) || 0);
    const duration = Math.max(0, Number(player.getDuration()) || 0);
    const position = Math.floor(currentTime);
    const now = performance.now();
    if (resumeTargetRef.current > 0) {
      if (duration > 0 && resumeTargetRef.current > duration) {
        resumeTargetRef.current = 0;
      } else if (currentTime < resumeTargetRef.current - 2) {
        lastTickRef.current = now;
        return;
      } else {
        resumeTargetRef.current = 0;
      }
    }
    const expectedAdvance = lastTickRef.current !== null
      ? ((now - lastTickRef.current) / 1000) * (player.getPlaybackRate?.() || 1)
      : 0;
    const seekTolerance = Math.max(3, Math.ceil(expectedAdvance) + 2);
    if (token && user?.role !== 'ADMIN' && position > maxViewedTimeRef.current + seekTolerance) {
      player.seekTo(maxViewedTimeRef.current, true);
      lastTickRef.current = now;
      return;
    }
    maxViewedTimeRef.current = Math.max(maxViewedTimeRef.current, position);
    if (isPlayingRef.current && lastTickRef.current !== null && document.visibilityState !== 'hidden') {
      watchedMsRef.current += Math.min(2000, Math.max(0, now - lastTickRef.current));
    }
    lastTickRef.current = now;
    if (duration > 0) {
      callbacksRef.current.onProgressChange?.({
        played: Math.min(1, currentTime / duration),
        playedSeconds: position,
        loadedSeconds: duration,
        eligibleCompletion: currentTime / duration >= 0.9,
        serverCompleted: Boolean(bookmark.isCompleted),
      });
    }
    emitMetrics({
      playedSeconds: position,
      watchedSeconds: baseWatchedSecondsRef.current + Math.floor(watchedMsRef.current / 1000),
      durationSeconds: duration,
    });
    queueSnapshot(force);
  };

  const stopTracking = (player, flush = true) => {
    if (player && flush) sample(player, true);
    isPlayingRef.current = false;
    lastTickRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTracking = (player) => {
    if (!player) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    playerRef.current = player;
    isPlayingRef.current = true;
    lastTickRef.current = performance.now();
    intervalRef.current = setInterval(() => sample(player), 1000);
  };

  useEffect(() => {
    if (!seekRequest || !Number.isFinite(seekRequest.seconds)) return;
    const requestedSeconds = Math.max(0, Math.floor(seekRequest.seconds));
    pendingSeekRef.current = requestedSeconds;
    const player = playerRef.current;
    if (!player) return;
    const allowedSeconds =
      token && user?.role !== 'ADMIN'
        ? Math.min(requestedSeconds, maxViewedTimeRef.current)
        : requestedSeconds;
    resumeTargetRef.current = allowedSeconds;
    player.seekTo(allowedSeconds, true);
    pendingSeekRef.current = null;
    sample(player, true);
    // `seekRequest.id` makes repeated clicks on the same timestamp observable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekRequest?.id]);

  const onReady = (player) => {
    playerRef.current = player;
    const target = pendingSeekRef.current ?? bookmark.lastPosition;
    const duration = Math.max(0, Number(player.getDuration()) || 0);
    if (target > 0) {
      resumeTargetRef.current = target;
      player.seekTo(target, true);
    }
    pendingSeekRef.current = null;
    emitMetrics({
      lastPosition: bookmark.lastPosition || 0,
      playedSeconds: bookmark.lastPosition || 0,
      durationSeconds: duration,
    });
  };

  useEffect(() => {
    const handlePageHide = () => {
      const player = playerRef.current;
      if (player) {
        sample(player, true);
        queueSnapshot(true, true);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handlePageHide();
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        lastTickRef.current = null;
      } else if (isPlayingRef.current && playerRef.current && !intervalRef.current) {
        lastTickRef.current = performance.now();
        intervalRef.current = setInterval(() => sample(playerRef.current), 1000);
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      handlePageHide();
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // Player lives for exactly one lesson; callbacks use refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!progressLoaded) {
    return (
      <div className="vp-loading" role="status">
        {bookmarkLoadError ? (
          <>
            <span>Chưa tải được vị trí xem tiếp.</span>
            <button type="button" onClick={() => setBookmarkAttempt((attempt) => attempt + 1)}>
              Thử lại
            </button>
          </>
        ) : (
          'Đang tải vị trí xem tiếp…'
        )}
      </div>
    );
  }

  if (youtubeId) {
    return (
      <>
        <YouTube
          videoId={youtubeId}
          opts={{
            width: '100%',
            height: '100%',
            playerVars: { rel: 0, modestbranding: 1 },
          }}
          onReady={(event) => onReady(event.target)}
          onStateChange={(event) => {
            if (event.data === 1) startTracking(event.target);
            else stopTracking(event.target);
          }}
          onError={() => setPlayerError(true)}
          className="video-player-container"
        />
        {playerError && <div className="vp-error">Không phát được video này.</div>}
      </>
    );
  }

  if (!url) return <div className="vp-loading">Bài học chưa có video.</div>;
  return (
    <video
      className="video-player-native"
      src={url}
      controls
      onLoadedMetadata={(event) => {
        const video = event.currentTarget;
        const player = {
          getCurrentTime: () => video.currentTime,
          getDuration: () => video.duration,
          seekTo: (seconds) => {
            video.currentTime = seconds;
          },
        };
        onReady(player);
        video._progressPlayer = player;
      }}
      onPlay={(event) => startTracking(event.currentTarget._progressPlayer)}
      onPause={(event) => stopTracking(event.currentTarget._progressPlayer)}
      onEnded={(event) => stopTracking(event.currentTarget._progressPlayer)}
    />
  );
};

export default VideoProgressPlayer;
