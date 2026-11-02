import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import '../styles/Lesson.css';
import '../../../components/ui/styles/LearningError.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  FileText,
  CheckCircle,
  Play,
  ArrowLeft as ArrowLeftIcon,
  Map,
  Clock,
  X,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/Api';
import InstructorNotes from '../components/InstructorNotes';
import HeartbeatLoader from '../../../components/ui/HeartbeatLoader';
import Dialog from '../../../components/ui/Dialog';
import errorIllustration from '../../../assets/images/fix1.webp';
import VideoProgressPlayer, { formatVideoTime } from '../components/VideoProgressPlayer';
import { storeTransitionEvent } from '../../courses/hooks/useLearningProgress';
import { useToast } from '../../../components/ui/Toast';

const PANEL_BREAKPOINT = 1280;

const getViewportWidth = () =>
  typeof window === 'undefined' ? PANEL_BREAKPOINT : window.innerWidth;

const formatLessonTitle = (value) => {
  const title = String(value || '').trim();
  if (!title) return 'Bài học';
  return title === title.toLocaleLowerCase('vi-VN')
    ? title.charAt(0).toLocaleUpperCase('vi-VN') + title.slice(1)
    : title;
};

const timestampToSeconds = (value) => {
  const parts = String(value || '')
    .split(':')
    .map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};

const loadModuleLessons = (module, token) => {
  const embedded = module.lessons;
  const hasContent =
    Array.isArray(embedded) &&
    embedded.every(
      (lesson) =>
        typeof lesson.title === 'string' &&
        (Object.hasOwn(lesson, 'videoUrl') || Object.hasOwn(lesson, 'contentHtml'))
    );
  return hasContent ? Promise.resolve(embedded) : api.getLessonsByModule(token, module.id);
};

// Explicit server permissions win. The fallback supports metadata-only lists
// and uses saved progress, never the current video playhead.
const canOpenLesson = (lessons, lessonId, progress = {}) => {
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return false;
  if (typeof lessons[index].canAccess === 'boolean') return lessons[index].canAccess;
  return lessons
    .slice(0, index)
    .every(
      (lesson) =>
        lesson.completed ||
        progress[lesson.id]?.completed ||
        ((lesson.hasVideo || lesson.videoUrl) &&
          Math.max(lesson.progressPercent || 0, progress[lesson.id]?.savedPercent || 0) >= 70)
    );
};
const lockedLessonError = (lesson) =>
  Object.assign(
    new Error(lesson?.lockedReason || 'Hoàn thành điều kiện của bài trước để mở bài học này.'),
    { code: 'LESSON_LOCKED', status: 403 }
  );

const Lesson = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('course');
  const { token, user } = useAuth();

  const [viewportWidth, setViewportWidth] = useState(getViewportWidth);
  const [leftOpen, setLeftOpen] = useState(() => getViewportWidth() >= PANEL_BREAKPOINT);
  const [rightOpen, setRightOpen] = useState(false);
  const setNoteEditor = useCallback((element) => {
    noteTextareaRef.current = element;
    if (element) element.setSelectionRange(element.value.length, element.value.length);
  }, []);

  const [course, setCourse] = useState(null);
  const { showToast, ToastComponent } = useToast();
  const [modules, setModules] = useState([]);
  const [activeModule, setActiveModule] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lessonError, setLessonError] = useState(null);
  const [accessRefreshFailed, setAccessRefreshFailed] = useState(false);
  const learningOwnerRef = useRef(null);
  learningOwnerRef.current = `${token || ''}:${courseId || ''}`;
  const activeModuleRef = useRef(null);
  const accessReadSeqRef = useRef(0);
  activeModuleRef.current = activeModule?.id;
  const [noteContent, setNoteContent] = useState('');
  const [noteLoad, setNoteLoad] = useState({ lessonId: null, status: 'loading' });
  const [noteAttempt, setNoteAttempt] = useState(0);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const debounceTimer = useRef(null);
  const currentLessonRef = useRef(selectedLessonId);
  const pendingNoteRef = useRef(null);
  const lastEnqueuedNoteRef = useRef(null);
  const noteWriteRef = useRef(Promise.resolve());
  const noteEditedRef = useRef(false);
  const noteTextareaRef = useRef(null);
  const curriculumToggleRef = useRef(null);
  const [seekRequest, setSeekRequest] = useState(null);

  const [lessonProgress, setLessonProgress] = useState({});
  const [videoMetrics, setVideoMetrics] = useState({});
  const [lessonSaveStatus, setLessonSaveStatus] = useState({});
  const lastSyncRef = useRef({});
  const progressRetryTimersRef = useRef({});

  const isCompact = viewportWidth < PANEL_BREAKPOINT;

  useEffect(() => {
    // Hàm cập nhật kích thước
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);

    // Đồng bộ ngay khi load trang
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Tự động đóng/mở sidebar khi thay đổi kích thước màn hình (chuyển breakpoint)
  useEffect(() => {
    if (isCompact) {
      setLeftOpen(false);
      setRightOpen(false);
    } else {
      setLeftOpen(true);
      setRightOpen(false);
    }
  }, [isCompact]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLessonError(null);
    setAccessRefreshFailed(false);
    accessReadSeqRef.current++;
    setCourse(null);
    setModules([]);
    setActiveModule(null);
    setLessons([]);
    setSelectedLessonId(null);
    setLessonProgress({});
    setVideoMetrics({});
    setLessonSaveStatus({});
    lastSyncRef.current = {};
    Object.values(progressRetryTimersRef.current).forEach(clearTimeout);
    Object.keys(progressRetryTimersRef.current).forEach((key) => {
      delete progressRetryTimersRef.current[key];
    });

    // Course metadata and personal progress must not delay the requested lesson.
    const catalog = api
      .getCourses(token)
      .then((courses) => {
        if (!cancelled) {
          setCourse(courseId ? courses?.find((item) => item.id === courseId) : courses?.[0]);
        }
        return courses;
      })
      .catch((error) => {
        if (!cancelled) console.error('Could not fetch course metadata:', error);
        return [];
      });

    if (token) {
      api
        .getUserProgress(token)
        .then((progress) => {
          if (cancelled) return;
          const initialProgress = {};
          (progress?._raw || []).forEach((item) => {
            if (!item.lessonId) return;
            initialProgress[item.lessonId] = {
              played: (item.progressPercent || 0) / 100,
              playedSeconds: 0,
              completed: item.status === 'COMPLETED',
              savedPercent: item.progressPercent || 0,
            };
            const current = lastSyncRef.current[item.lessonId];
            lastSyncRef.current[item.lessonId] = {
              time: 0,
              inFlight: false,
              pending: null,
              retries: 0,
              nextRetryAt: 0,
              ...current,
              percent: Math.max(current?.percent || 0, item.progressPercent || 0),
              completed: Boolean(current?.completed || item.status === 'COMPLETED'),
            };
          });
          setLessonProgress((current) => {
            const merged = { ...current };
            Object.entries(initialProgress).forEach(([id, saved]) => {
              merged[id] = {
                ...saved,
                ...current[id],
                played: Math.max(saved.played, current[id]?.played || 0),
                completed: Boolean(saved.completed || current[id]?.completed),
              };
            });
            return merged;
          });
        })
        .catch((error) => {
          if (!cancelled) console.warn('Could not fetch user progress:', error);
        });
    }

    const initLesson = async () => {
      try {
        const effectiveCourseId = courseId || (await catalog)?.[0]?.id;
        if (!effectiveCourseId || cancelled) return;
        const courseModules = await api.getModulesByCourse(token, effectiveCourseId);
        if (cancelled) return;
        if (Array.isArray(courseModules) && courseModules.length > 0) {
          // Check if a specific lesson is requested in URL
          const targetLessonParam = searchParams.get('lesson');
          let targetModule = courseModules[0];
          let targetLessonId = null;

          if (targetLessonParam) {
            const parsedLessonId = parseInt(targetLessonParam, 10);
            // Find module containing the lesson
            const foundModule = courseModules.find(
              (m) => m.lessons && m.lessons.some((l) => l.id === parsedLessonId)
            );
            if (foundModule) {
              targetModule = foundModule;
              targetLessonId = parsedLessonId;
            } else throw new Error('Không tìm thấy bài học trong khóa học này.');
          }

          if (targetModule.canAccess === false) throw lockedLessonError(targetModule);

          const moduleLessons = await loadModuleLessons(targetModule, token);
          if (cancelled) return;
          const initialId = targetLessonId || moduleLessons?.[0]?.id;
          if (initialId && !canOpenLesson(moduleLessons, initialId))
            throw lockedLessonError(moduleLessons.find((lesson) => lesson.id === initialId));
          setModules(courseModules);
          setActiveModule(targetModule);
          setLessons(moduleLessons || []);

          if (targetLessonId) {
            setSelectedLessonId(targetLessonId);
          } else if (Array.isArray(moduleLessons) && moduleLessons.length > 0) {
            setSelectedLessonId(moduleLessons[0].id);
          }
        }
      } catch (error) {
        if (!cancelled) setLessonError(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    initLesson();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, token]);

  // Đồng bộ lessonId ngược lại URL khi selectedLessonId thay đổi
  useEffect(() => {
    if (selectedLessonId && courseId) {
      navigate(`/lesson?course=${courseId}&lesson=${selectedLessonId}`, { replace: true });
    }
  }, [selectedLessonId, courseId, navigate]);

  // Lắng nghe sự thay đổi của tham số URL ?lesson để chuyển bài học (khi click từ ô tìm kiếm)
  useEffect(() => {
    let cancelled = false;
    const lessonParam = searchParams.get('lesson');
    if (!lessonParam || modules.length === 0) return;

    const parsedLessonId = parseInt(lessonParam, 10);
    if (selectedLessonId === parsedLessonId) return;

    // Tìm module chứa bài học này
    const foundModule = modules.find(
      (m) => m.lessons && m.lessons.some((l) => l.id === parsedLessonId)
    );

    if (foundModule) {
      const rejectLocked = (lesson) => {
        setLessonError(lockedLessonError(lesson));
        setSelectedLessonId(null);
      };
      if (
        foundModule.id === activeModule?.id &&
        lessons.some((item) => item.id === parsedLessonId)
      ) {
        if (!canOpenLesson(lessons, parsedLessonId, lessonProgress)) {
          rejectLocked(lessons.find((lesson) => lesson.id === parsedLessonId));
          return;
        }
        setLessonError(null);
        setSelectedLessonId(parsedLessonId);
        return;
      }
      const selectTargetLesson = async () => {
        try {
          setLoading(true);
          // Module permissions may change after completing the current one.
          // Revalidate cross-module URLs instead of trusting the initial list.
          const moduleLessons = await api.getLessonsByModule(token, foundModule.id);
          if (cancelled) return;
          if (!canOpenLesson(moduleLessons, parsedLessonId, lessonProgress)) {
            rejectLocked(moduleLessons.find((lesson) => lesson.id === parsedLessonId));
            return;
          }
          setLessonError(null);
          setActiveModule(foundModule);
          setLessons(moduleLessons);
          setSelectedLessonId(parsedLessonId);
        } catch (err) {
          if (!cancelled) {
            setLessonError(err);
            setSelectedLessonId(null);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      selectTargetLesson();
    } else {
      setLessonError(new Error('Không tìm thấy bài học trong khóa học này.'));
      setSelectedLessonId(null);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, modules, token]);

  const saveNoteSnapshot = useCallback(
    (snapshot, keepalive = false) => {
      if (!token || !snapshot) return Promise.resolve();
      if (lastEnqueuedNoteRef.current === snapshot) return noteWriteRef.current;
      lastEnqueuedNoteRef.current = snapshot;
      noteWriteRef.current = noteWriteRef.current
        .catch(() => {})
        .then(() => api.updateUserNote(token, snapshot, { keepalive }));
      noteWriteRef.current
        .then(() => {
          if (pendingNoteRef.current === snapshot) pendingNoteRef.current = null;
          if (currentLessonRef.current === snapshot.lessonId) setSaveStatus('saved');
        })
        .catch((error) => {
          lastEnqueuedNoteRef.current = null;
          if (currentLessonRef.current === snapshot.lessonId) setSaveStatus('error');
          console.error('[Lesson] Lỗi lưu ghi chú:', error);
        });
      return noteWriteRef.current;
    },
    [token]
  );

  // Tải ghi chú của đúng bài, không ghi đè nội dung vừa được người dùng nhập.
  useEffect(() => {
    if (!selectedLessonId) return;

    currentLessonRef.current = selectedLessonId;
    noteEditedRef.current = false;
    setNoteContent('');
    setSaveStatus('idle');
    if (!token) return;
    let active = true;
    setNoteLoad({ lessonId: selectedLessonId, status: 'loading' });

    const fetchNote = async () => {
      try {
        const content = await api.getUserNote(token, selectedLessonId);
        if (active && currentLessonRef.current === selectedLessonId && !noteEditedRef.current) {
          setNoteContent(content);
          setNoteLoad({ lessonId: selectedLessonId, status: 'ready' });
        }
      } catch (error) {
        if (active && currentLessonRef.current === selectedLessonId) {
          setNoteLoad({ lessonId: selectedLessonId, status: 'error' });
        }
        console.error('[Lesson] Lỗi tải ghi chú:', error);
      }
    };

    fetchNote();
    return () => {
      active = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (pendingNoteRef.current?.lessonId === selectedLessonId) {
        saveNoteSnapshot(pendingNoteRef.current, true);
      }
    };
  }, [selectedLessonId, token, saveNoteSnapshot, noteAttempt]);

  // Debounce khi nhập và gửi ngay phần chưa lưu khi đổi bài hoặc rời trang.
  const updateNoteContent = useCallback(
    (value) => {
      if (!token || noteLoad.lessonId !== selectedLessonId || noteLoad.status !== 'ready') return;
      setNoteContent(value);
      noteEditedRef.current = true;
      setSaveStatus('saving');
      const snapshot = { lessonId: selectedLessonId, content: value };
      pendingNoteRef.current = snapshot;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => saveNoteSnapshot(snapshot), 700);
    },
    [selectedLessonId, token, saveNoteSnapshot, noteLoad]
  );

  const handleNoteChange = useCallback(
    (event) => updateNoteContent(event.target.value),
    [updateNoteContent]
  );

  // Dọn timer hoàn thành bài khi rời trang.
  useEffect(() => {
    const retryTimers = progressRetryTimersRef.current;
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      Object.values(retryTimers).forEach(clearTimeout);
    };
  }, []);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId),
    [lessons, selectedLessonId]
  );
  const selectedLessonTitle = formatLessonTitle(selectedLesson?.title);
  const noteTimestamps = useMemo(() => {
    const timestamps = [];
    const seen = new Set();
    for (const match of noteContent.matchAll(/\[((?:\d{1,2}:)?\d{1,2}:\d{2})\]/g)) {
      const seconds = timestampToSeconds(match[1]);
      if (seconds === null || seen.has(seconds)) continue;
      seen.add(seconds);
      timestamps.push({ label: match[1], seconds });
    }
    return timestamps.sort((first, second) => first.seconds - second.seconds);
  }, [noteContent]);

  const completedCount = lessons.filter(
    (lesson) => lesson.completed || lessonProgress[lesson.id]?.completed
  ).length;
  const progressPercent = lessons.length ? (completedCount / lessons.length) * 100 : 0;

  const updateLessonCompletion = (lessonId, completed) => {
    setLessons((currentLessons) =>
      currentLessons.map((lesson) => (lesson.id === lessonId ? { ...lesson, completed } : lesson))
    );
  };

  const handleSelectLesson = (lessonId) => {
    if (!canOpenLesson(lessons, lessonId, lessonProgress)) return;
    setLessonError(null);
    setSelectedLessonId(lessonId);
    if (isCompact) {
      setLeftOpen(false);
    }
  };

  const refreshLessonAccess = async (moduleId = activeModule?.id) => {
    const owner = learningOwnerRef.current;
    const sequence = ++accessReadSeqRef.current;
    try {
      const updated = await api.getLessonsByModule(token, moduleId);
      if (
        learningOwnerRef.current !== owner ||
        activeModuleRef.current !== moduleId ||
        sequence !== accessReadSeqRef.current
      )
        return;
      if (Array.isArray(updated)) setLessons(updated);
      setAccessRefreshFailed(false);
    } catch {
      if (
        learningOwnerRef.current === owner &&
        activeModuleRef.current === moduleId &&
        sequence === accessReadSeqRef.current
      )
        setAccessRefreshFailed(true);
    }
  };

  const toggleLeftSidebar = () => {
    setLeftOpen((current) => {
      const next = !current;
      if (next && isCompact) {
        setRightOpen(false);
      }
      return next;
    });
  };

  const toggleRightSidebar = () => {
    setRightOpen((current) => {
      const next = !current;
      if (next && isCompact) {
        setLeftOpen(false);
      }
      return next;
    });
  };

  const handleVideoMetrics = (lessonId, patch) => {
    setVideoMetrics((current) => ({
      ...current,
      [lessonId]: { ...current[lessonId], ...patch },
    }));
    if (patch.serverCompleted) {
      setLessonProgress((current) => ({
        ...current,
        [lessonId]: { ...current[lessonId], completed: true },
      }));
      if (lastSyncRef.current[lessonId]) lastSyncRef.current[lessonId].completed = true;
      if (!lessonProgress[lessonId]?.completed) refreshLessonAccess();
    }
  };

  const scheduleProgressSync = (lessonId, state) => {
    if (!token || !(course?.id || courseId)) return;
    const scheduledOwner = learningOwnerRef.current;
    const sync = (lastSyncRef.current[lessonId] ||= {
      percent: 0,
      completed: false,
      time: 0,
      inFlight: false,
      pending: null,
      retries: 0,
      nextRetryAt: 0,
    });
    if (sync.completed) return;
    sync.pending = {
      percent: Math.max(sync.pending?.percent || 0, state.percent),
      completed: Boolean(sync.pending?.completed || state.completed),
    };

    const sendPending = () => {
      if (learningOwnerRef.current !== scheduledOwner) return;
      if (sync.inFlight || sync.completed || !sync.pending || Date.now() < sync.nextRetryAt) return;
      const pending = sync.pending;
      if (
        !pending.completed &&
        !(sync.percent < 70 && pending.percent >= 70) &&
        (pending.percent < sync.percent + 10 || Date.now() - sync.time < 5000)
      ) {
        return;
      }
      sync.pending = null;
      sync.inFlight = true;
      const owner = learningOwnerRef.current;
      setLessonSaveStatus((current) => ({ ...current, [lessonId]: 'saving' }));
      api
        .updateUserProgress(token, {
          courseId: course?.id || courseId,
          moduleId: activeModule?.id,
          lessonId,
          progressPercent: pending.percent,
          status: pending.completed ? 'COMPLETED' : 'ACTIVE',
        })
        .then((response) => {
          if (learningOwnerRef.current !== owner) return;
          const wasCompleted = sync.completed;
          const previousPercent = sync.percent;
          sync.percent = Math.max(sync.percent, response?.data?.progressPercent ?? 0);
          sync.completed = response?.data?.status === 'COMPLETED';
          sync.time = Date.now();
          sync.retries = 0;
          sync.nextRetryAt = 0;
          setLessonSaveStatus((current) => ({ ...current, [lessonId]: 'saved' }));
          setLessonProgress((current) => ({
            ...current,
            [lessonId]: { ...current[lessonId], savedPercent: sync.percent },
          }));
          if ((previousPercent < 70 && sync.percent >= 70) || (!wasCompleted && sync.completed))
            refreshLessonAccess();
          if (response?.transition?.changed) {
            storeTransitionEvent(response.transition, user?.id);
          }
          if (sync.completed) {
            setLessonProgress((current) => ({
              ...current,
              [lessonId]: { ...current[lessonId], completed: true },
            }));
            updateLessonCompletion(lessonId, true);
            if (!wasCompleted) showToast('Chúc mừng! Bạn đã hoàn thành bài học này.', 'success');
          }
        })
        .catch((error) => {
          if (learningOwnerRef.current !== owner) return;
          console.error('Không lưu được tiến độ bài học:', error);
          sync.pending = {
            percent: Math.max(sync.pending?.percent || 0, pending.percent),
            completed: Boolean(sync.pending?.completed || pending.completed),
          };
          sync.retries += 1;
          setLessonSaveStatus((current) => ({ ...current, [lessonId]: 'error' }));
          if (sync.retries <= 2) {
            const delay = sync.retries * 2000;
            sync.nextRetryAt = Date.now() + delay;
            progressRetryTimersRef.current[lessonId] = window.setTimeout(() => {
              sync.nextRetryAt = 0;
              sendPending();
            }, delay);
          } else {
            sync.nextRetryAt = Infinity;
          }
        })
        .finally(() => {
          sync.inFlight = false;
          if (sync.pending && sync.nextRetryAt === 0) sendPending();
        });
    };
    sendPending();
  };

  const handleProgress = (lessonId, state) => {
    const played = Math.max(0, Math.min(1, state.played || 0));
    setLessonProgress((current) => ({
      ...current,
      [lessonId]: {
        ...current[lessonId],
        played,
        playedSeconds: state.playedSeconds || 0,
        durationSeconds: state.loadedSeconds || 0,
        completed: Boolean(current[lessonId]?.completed || state.serverCompleted),
      },
    }));
    if (state.serverCompleted && lastSyncRef.current[lessonId]) {
      lastSyncRef.current[lessonId].completed = true;
    }
    scheduleProgressSync(lessonId, {
      percent: Math.floor(played * 100),
      completed: Boolean(state.eligibleCompletion),
    });
  };

  const retryProgressSave = (lessonId) => {
    const sync = lastSyncRef.current[lessonId];
    if (!sync?.pending) return;
    sync.retries = 0;
    sync.nextRetryAt = 0;
    scheduleProgressSync(lessonId, sync.pending);
  };

  // Logic điều hướng bài học
  const currentIndex = lessons.findIndex((l) => l.id === selectedLessonId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < lessons.length - 1;

  const currentProgress = lessonProgress[selectedLessonId]?.played || 0;
  const isNextDisabled =
    !hasNext || !canOpenLesson(lessons, lessons[currentIndex + 1]?.id, lessonProgress);
  const activeProgress = lessonProgress[selectedLessonId] || {};
  const activeMetrics = videoMetrics[selectedLessonId] || {};
  const displayedPosition = activeMetrics.playedSeconds ?? activeProgress.playedSeconds ?? 0;
  const displayedDuration = activeProgress.durationSeconds || activeMetrics.durationSeconds || 0;
  const displayedPercent =
    displayedDuration > 0
      ? Math.max(0, Math.min(100, Math.round((displayedPosition / displayedDuration) * 100)))
      : 0;
  const resumePosition = Math.max(0, activeMetrics.lastPosition || 0);
  const progressSaveFailed =
    activeMetrics.saveStatus === 'error' || lessonSaveStatus[selectedLessonId] === 'error';
  const nextDisabledReason = accessRefreshFailed
    ? 'Chưa cập nhật được quyền mở bài. Vui lòng thử lại.'
    : !hasNext
      ? 'Đây là bài cuối cùng trong chương.'
      : !lessonProgress[selectedLessonId]?.completed && !selectedLesson?.videoUrl
        ? 'Đánh dấu đã đọc xong để mở bài tiếp theo.'
        : !lessonProgress[selectedLessonId]?.completed && currentProgress < 0.7
          ? 'Xem ít nhất 70% video để mở bài tiếp theo.'
          : 'Đang xác nhận tiến độ để mở bài tiếp theo.';
  const progressStatusText = progressSaveFailed
    ? 'Lưu tiến độ chưa thành công.'
    : !token
      ? 'Đăng nhập để lưu tiến độ và ghi chú.'
      : activeMetrics.saveStatus === 'loading'
        ? 'Đang tải vị trí xem tiếp…'
        : activeMetrics.saveStatus === 'saving' || lessonSaveStatus[selectedLessonId] === 'saving'
          ? 'Đang lưu tiến độ…'
          : 'Đã bật tự động lưu tiến độ.';

  const seekVideoTo = (seconds) => {
    if (!selectedLesson?.videoUrl || !Number.isFinite(seconds)) return;
    setSeekRequest({ seconds, id: `${selectedLesson.id}-${seconds}-${Date.now()}` });
    const frame = document.querySelector('.lc-video-frame');
    frame?.scrollIntoView?.({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
  };

  const insertCurrentTimestamp = () => {
    if (!selectedLesson?.videoUrl || noteLoad.status !== 'ready') return;
    const label = formatVideoTime(displayedPosition);
    const marker = `[${label}] `;
    const textarea = noteTextareaRef.current;
    const start = textarea?.selectionStart ?? noteContent.length;
    const end = textarea?.selectionEnd ?? start;
    const prefix = noteContent.slice(0, start);
    const separator = prefix && !prefix.endsWith('\n') ? '\n' : '';
    const nextValue = `${prefix}${separator}${marker}${noteContent.slice(end)}`;
    const cursor = prefix.length + separator.length + marker.length;
    updateNoteContent(nextValue);
    const focusEditor = () => {
      noteTextareaRef.current?.focus();
      noteTextareaRef.current?.setSelectionRange(cursor, cursor);
    };
    if (window.requestAnimationFrame) window.requestAnimationFrame(focusEditor);
    else focusEditor();
  };

  const handleNext = () => {
    if (hasNext && !isNextDisabled) {
      const nextLesson = lessons[currentIndex + 1];
      handleSelectLesson(nextLesson.id);
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      const prevLesson = lessons[currentIndex - 1];
      handleSelectLesson(prevLesson.id);
    }
  };

  const CurriculumPanel = isCompact ? Dialog : 'aside';

  if (loading) {
    return <HeartbeatLoader label="Đang tải nội dung bài học..." />;
  }

  if (lessonError || !selectedLesson) {
    return (
      <div className="lesson-error-container">
        <div className="lesson-error-card">
          <div className="lesson-error-illustration">
            <img
              src={errorIllustration}
              alt="Không tìm thấy bài học"
              width={512}
              height={512}
              decoding="async"
            />
          </div>
          <h2 className="lesson-error-title">
            {lessonError?.status === 403 ? 'Bài học chưa được mở khóa' : 'Không tìm thấy bài học'}
          </h2>
          <p className="lesson-error-desc">
            {lessonError?.message || 'Nội dung bài học này chưa được cập nhật.'}
          </p>
          <div className="lesson-error-actions">
            <button className="btn-map-2" onClick={() => navigate('/roadmap')}>
              <Map size={20} />
              <span>Xem lộ trình</span>
            </button>
            <button className="btn-back-2" onClick={() => navigate(-1)}>
              <ArrowLeftIcon size={20} />
              <span>Quay lại</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-layout">
      {(!isCompact || leftOpen) && (
        <CurriculumPanel
          {...(isCompact
            ? {
                title: 'Nội dung chương',
                onClose: () => setLeftOpen(false),
                className: 'lesson-curriculum-dialog',
                animateExit: true,
              }
            : {
                className: 'lesson-sidebar',
                'aria-label': 'Nội dung chương',
                'aria-hidden': !leftOpen,
                'data-open': String(leftOpen),
                inert: leftOpen ? undefined : '',
              })}
        >
          <div
            className={`lesson-sidebar-content${isCompact ? '' : ' t-panel-slide'}`}
            data-open={String(leftOpen)}
          >
            {!isCompact && (
              <div className="ls-panel-heading">
                <h2>Nội dung chương</h2>
                <button
                  type="button"
                  onClick={() => {
                    setLeftOpen(false);
                    curriculumToggleRef.current?.focus();
                  }}
                  aria-label="Thu gọn nội dung chương"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="ls-header">
              <small className="ls-course-label">
                {course?.title || course?.code || 'Khóa học'}
              </small>
              <h3 className="ls-module-title">{activeModule?.title}</h3>
              <div className="ls-progress-summary">
                <span>Tiến độ chương</span>
                <strong>
                  {completedCount}/{lessons.length} bài
                </strong>
              </div>
              <div className="ls-progress-bg">
                <div className="ls-progress-bar" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>

            <div className="ls-section-list">
              {lessons.map((lesson) => {
                const isActive = lesson.id === selectedLessonId;
                const isLocked = !canOpenLesson(lessons, lesson.id, lessonProgress);
                const isCompleted = lesson.completed || lessonProgress[lesson.id]?.completed;
                const lessonDuration =
                  isActive && displayedDuration > 0
                    ? formatVideoTime(displayedDuration)
                    : lesson.videoDuration;

                return (
                  <div key={lesson.id} className="ls-section-item">
                    <button
                      type="button"
                      className={`ls-section-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectLesson(lesson.id)}
                      aria-current={isActive ? 'page' : undefined}
                      aria-disabled={isLocked}
                      aria-describedby={isLocked ? `lesson-lock-${lesson.id}` : undefined}
                      title={
                        isLocked
                          ? lesson.lockedReason || 'Hoàn thành điều kiện của bài trước.'
                          : undefined
                      }
                    >
                      <div className="ls-section-btn-icon">
                        {isLocked ? (
                          <Lock size={16} aria-hidden="true" />
                        ) : isCompleted ? (
                          <CheckCircle size={16} color="var(--color-success)" />
                        ) : isActive ? (
                          <Play size={16} fill="currentColor" />
                        ) : (
                          <div className="ls-section-btn-icon-empty"></div>
                        )}
                      </div>
                      <div className="ls-section-btn-content">
                        <span className={`ls-section-btn-text ${isActive ? 'active' : ''}`}>
                          {formatLessonTitle(lesson.title)}
                        </span>
                        <span className="ls-section-btn-meta">
                          Bài {lesson.sectionNumber || lesson.orderIndex}
                          {lessonDuration ? ` · ${lessonDuration}` : ''}
                        </span>
                      </div>
                    </button>
                    {isLocked && (
                      <span className="sr-only" id={`lesson-lock-${lesson.id}`}>
                        {lesson.lockedReason || 'Hoàn thành điều kiện của bài trước để mở bài này.'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CurriculumPanel>
      )}

      <div className="lesson-content">
        <div className="lc-topbar">
          <div className="lc-topbar-left">
            <nav className="lc-breadcrumb" aria-label="Đường dẫn bài học">
              {courseId && (
                <>
                  <button
                    type="button"
                    id="lesson-back-to-course"
                    onClick={() => navigate(`/course/${courseId}?from=lesson`)}
                  >
                    Khóa học
                  </button>
                  <span aria-hidden="true">›</span>
                </>
              )}
              <span>{course?.code || course?.title || 'Khóa học'}</span>
              <span aria-hidden="true">›</span>
              <span>{activeModule?.title || 'Chương'}</span>
              <span aria-hidden="true">›</span>
              <strong>Bài {selectedLesson.sectionNumber || selectedLesson.orderIndex}</strong>
            </nav>
          </div>
          <div className="lc-topbar-right">
            <button
              type="button"
              onClick={toggleRightSidebar}
              className="lc-topbar-doc-btn"
              aria-label="Mở hoặc đóng ghi chú bài học"
              aria-expanded={rightOpen}
            >
              <FileText size={20} />
              <span>Ghi chú</span>
            </button>
            <button
              type="button"
              onClick={toggleLeftSidebar}
              ref={curriculumToggleRef}
              className="lc-topbar-menu-btn"
              aria-label="Mở hoặc đóng nội dung chương"
              title="Nội dung chương"
              aria-expanded={leftOpen}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="lesson-main">
          <div className="lc-main-container">
            {selectedLesson.videoUrl && (
              <div className="lc-video-stage">
                <div className="lc-video-frame">
                  <VideoProgressPlayer
                    key={selectedLesson.id}
                    url={selectedLesson.videoUrl}
                    lessonId={selectedLesson.id}
                    token={token}
                    user={user}
                    seekRequest={seekRequest}
                    onProgressChange={(state) => handleProgress(selectedLesson.id, state)}
                    onMetricsChange={handleVideoMetrics}
                  />
                </div>
              </div>
            )}

            <div className="lc-lesson-body">
              <header className="lc-lesson-heading">
                <span className="lc-eyebrow">
                  Bài {selectedLesson.sectionNumber || selectedLesson.orderIndex || ''}
                </span>
                <h1 className="lc-title">{selectedLessonTitle}</h1>
                <p>
                  {selectedLesson.videoUrl
                    ? selectedLesson.contentHtml?.trim()
                      ? 'Tiến độ được lưu tự động khi bạn xem. Ghi chú giảng viên nằm bên dưới.'
                      : 'Tiến độ được lưu tự động khi bạn xem.'
                    : 'Đọc nội dung bài học bên dưới và đánh dấu đã đọc xong khi hoàn thành.'}
                </p>
              </header>

              {!selectedLesson.videoUrl && <InstructorNotes content={selectedLesson.contentHtml} />}
              {selectedLesson.videoUrl ? (
                <section className="lc-progress-card" aria-label="Tiến độ học bài">
                  <div className="lc-progress-head">
                    <div>
                      <span className="lc-progress-label">Tiến độ video</span>
                      <h2>
                        {formatVideoTime(displayedPosition)} /{' '}
                        {displayedDuration ? formatVideoTime(displayedDuration) : '—'}
                      </h2>
                    </div>
                    <span
                      className={
                        activeProgress.completed
                          ? 'lc-progress-badge completed'
                          : activeProgress.played
                            ? 'lc-progress-badge active'
                            : 'lc-progress-badge'
                      }
                    >
                      {activeProgress.completed
                        ? 'Hoàn thành'
                        : activeProgress.played
                          ? 'Đang học'
                          : 'Chưa bắt đầu'}
                    </span>
                  </div>
                  <div
                    className="lc-progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={displayedPercent}
                    aria-label="Mốc video đã phát"
                  >
                    <div className="lc-progress-fill" style={{ width: displayedPercent + '%' }} />
                  </div>
                  <div className="lc-progress-summary">
                    <div>
                      <strong>{displayedDuration ? `${displayedPercent}%` : '—'}</strong>
                      <span role="status">{progressStatusText}</span>
                    </div>
                    {resumePosition > 0 && (
                      <button
                        type="button"
                        className="lc-resume-btn"
                        onClick={() => seekVideoTo(resumePosition)}
                      >
                        <Play size={15} fill="currentColor" />
                        Tiếp tục từ {formatVideoTime(resumePosition)}
                      </button>
                    )}
                    {lessonSaveStatus[selectedLessonId] === 'error' && (
                      <button
                        type="button"
                        className="lc-progress-retry"
                        onClick={() => retryProgressSave(selectedLessonId)}
                      >
                        Thử lưu lại
                      </button>
                    )}
                  </div>
                </section>
              ) : (
                <section className="lc-progress-card" aria-label="Tiến độ bài đọc">
                  <div className="lc-progress-head">
                    <div>
                      <span className="lc-progress-label">Tiến độ bài đọc</span>
                      <h2>Bài đọc</h2>
                    </div>
                    <span
                      className={`lc-progress-badge ${activeProgress.completed ? 'completed' : ''}`}
                    >
                      {activeProgress.completed ? 'Hoàn thành' : 'Chưa hoàn thành'}
                    </span>
                  </div>
                  <p>Đánh dấu sau khi bạn đã đọc nội dung từ giảng viên.</p>
                  {!activeProgress.completed && (
                    <button
                      type="button"
                      className="lc-text-complete-btn"
                      onClick={() =>
                        scheduleProgressSync(selectedLesson.id, { percent: 100, completed: true })
                      }
                      disabled={!token || lessonSaveStatus[selectedLessonId] === 'saving'}
                    >
                      Đã đọc xong
                    </button>
                  )}
                  <div className="lc-progress-foot" role="status">
                    <span>
                      {!token
                        ? 'Đăng nhập để lưu tiến độ bài đọc.'
                        : lessonSaveStatus[selectedLessonId] === 'saving'
                          ? 'Đang lưu tiến độ…'
                          : lessonSaveStatus[selectedLessonId] === 'error'
                            ? 'Lưu tiến độ chưa thành công.'
                            : activeProgress.completed
                              ? 'Tiến độ đã được lưu.'
                              : 'Tiến độ được lưu khi bạn xác nhận đã đọc xong.'}
                    </span>
                    {lessonSaveStatus[selectedLessonId] === 'error' && (
                      <button type="button" onClick={() => retryProgressSave(selectedLessonId)}>
                        Thử lưu lại
                      </button>
                    )}
                  </div>
                </section>
              )}

              {selectedLesson.videoUrl && <InstructorNotes content={selectedLesson.contentHtml} />}
            </div>
          </div>
        </div>

        <nav className="lc-navigation" aria-label="Điều hướng bài học">
          <div className="lc-navigation-info">
            <strong>
              Bài {currentIndex + 1}/{lessons.length}
            </strong>
            {isNextDisabled && <span id="lc-next-help">{nextDisabledReason}</span>}
            {accessRefreshFailed && (
              <button type="button" onClick={() => refreshLessonAccess()}>
                Thử lại
              </button>
            )}
          </div>
          <button
            type="button"
            className="lc-btn-prev"
            onClick={handlePrev}
            disabled={!hasPrev}
            title={!hasPrev ? 'Đây là bài đầu tiên trong chương.' : undefined}
          >
            <ChevronLeft size={16} aria-hidden="true" /> Trước
          </button>
          <button
            type="button"
            className="lc-btn-next"
            onClick={handleNext}
            disabled={isNextDisabled}
            aria-describedby={isNextDisabled ? 'lc-next-help' : undefined}
          >
            Tiếp theo <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      </div>

      {rightOpen && (
        <Dialog
          title="Ghi chú bài học"
          onClose={() => setRightOpen(false)}
          className="lesson-notes-dialog"
          animateExit
        >
          <div className="rs-content">
            <div className="rs-note-toolbar">
              <span>Ghi chú cá nhân</span>
              <button
                type="button"
                onClick={insertCurrentTimestamp}
                disabled={
                  !token ||
                  !selectedLesson.videoUrl ||
                  noteLoad.lessonId !== selectedLessonId ||
                  noteLoad.status !== 'ready'
                }
              >
                <Clock size={14} /> Gắn mốc {formatVideoTime(displayedPosition)}
              </button>
            </div>
            {selectedLesson.videoUrl && noteTimestamps.length > 0 && (
              <div className="rs-note-timestamps" aria-label="Các mốc thời gian trong ghi chú">
                {noteTimestamps.map((timestamp) => (
                  <button
                    type="button"
                    key={timestamp.seconds}
                    onClick={() => seekVideoTo(timestamp.seconds)}
                  >
                    <Play size={12} fill="currentColor" /> {timestamp.label}
                  </button>
                ))}
              </div>
            )}
            <div className="rs-note-editor">
              <textarea
                ref={setNoteEditor}
                className="rs-textarea"
                aria-label="Ghi chú cá nhân cho bài học"
                placeholder={
                  token
                    ? 'Ví dụ: Kiểm tra bảng định tuyến bằng lệnh show ip route…'
                    : 'Vui lòng đăng nhập để viết và lưu ghi chú cá nhân...'
                }
                value={noteContent}
                onChange={handleNoteChange}
                onBlur={() => {
                  if (debounceTimer.current) clearTimeout(debounceTimer.current);
                  if (pendingNoteRef.current) saveNoteSnapshot(pendingNoteRef.current);
                }}
                disabled={
                  !token || noteLoad.lessonId !== selectedLessonId || noteLoad.status !== 'ready'
                }
                maxLength={10000}
              />
              <div className="rs-note-status" role="status">
                <span>
                  {token &&
                  (noteLoad.lessonId !== selectedLessonId || noteLoad.status === 'loading')
                    ? 'Đang tải ghi chú…'
                    : token && noteLoad.status === 'error'
                      ? 'Chưa tải được ghi chú. Nội dung đã lưu vẫn được giữ nguyên.'
                      : saveStatus === 'saving'
                        ? 'Đang lưu…'
                        : saveStatus === 'saved'
                          ? 'Đã lưu'
                          : saveStatus === 'error'
                            ? 'Lưu chưa thành công'
                            : token
                              ? 'Tự lưu khi bạn nhập'
                              : 'Cần đăng nhập'}
                </span>
                {token && noteLoad.lessonId === selectedLessonId && noteLoad.status === 'error' && (
                  <button type="button" onClick={() => setNoteAttempt((attempt) => attempt + 1)}>
                    Thử tải lại
                  </button>
                )}
                {saveStatus === 'error' && noteLoad.status === 'ready' && (
                  <button type="button" onClick={() => saveNoteSnapshot(pendingNoteRef.current)}>
                    Thử lại
                  </button>
                )}
              </div>
              <small>{noteContent.length.toLocaleString('vi-VN')} / 10.000 ký tự</small>
            </div>
          </div>
        </Dialog>
      )}
      {ToastComponent}
    </div>
  );
};

export default Lesson;
