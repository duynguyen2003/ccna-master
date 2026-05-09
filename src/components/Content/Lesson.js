import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
   ChevronLeft, ChevronRight, Menu, FileText,
   AlertCircle, CheckCircle, Play, ArrowLeft as ArrowLeftIcon, Map
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/Api';
import MarkdownRenderer from '../Common/MarkdownRenderer';
import errorIllustration from '../../image/fix1.png';

const MOBILE_BREAKPOINT = 1024;
const RESOURCE_BREAKPOINT = 1280;

const getViewportWidth = () => (
   typeof window === 'undefined' ? RESOURCE_BREAKPOINT : window.innerWidth
);


/** Trích xuất YouTube video ID từ mọi dạng URL */
const getYoutubeVideoId = (url) => {
   if (!url) return null;
   const patterns = [
      /youtu\.be\/([^?&]+)/,
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtube\.com\/embed\/([^?&]+)/,
   ];
   for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
   }
   // Thử parse bằng URL API
   try {
      const u = new URL(url.trim());
      if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
      if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
   } catch { /* ignore */ }
   return null;
};

/** Component video: dùng YouTube IFrame API cho YouTube, <video> cho file */
const VideoPlayer = ({ url, lessonId, courseId, moduleId, token, onProgressChange }) => {
   const playerRef = useRef(null);  // YouTube Player instance
   const intervalRef = useRef(null);  // setInterval reference
   const lastSavedRef = useRef(0);     // Thời điểm save cuối (tránh trùng)
   const maxWatchedRef = useRef(0);     // Thời điểm xem xa nhất
   const containerRef = useRef(null);  // div chứa player
   const videoRef = useRef(null);  // video element cho file .mp4

   const [localProgress, setLocalProgress] = useState({ percentage: 0, watchedTime: 0, status: 'Chưa học' });
   const youtubeId = getYoutubeVideoId(url);

   // ── Khởi tạo YouTube Player ───────────────────────────────────────────────
   useEffect(() => {
      if (!youtubeId || !containerRef.current) return;

      // Tạo div target mới mỗi lần (để tránh xung đột ID)
      const divId = `yt-player-${lessonId || 'main'}`;
      let targetDiv = document.getElementById(divId);
      if (!targetDiv) {
         targetDiv = document.createElement('div');
         targetDiv.id = divId;
         containerRef.current.appendChild(targetDiv);
      }

      const initPlayer = () => {
         if (playerRef.current) {
            try { playerRef.current.destroy(); } catch (e) { /* ignore */ }
         }
         playerRef.current = new window.YT.Player(divId, {
            videoId: youtubeId,
            width: '100%',
            height: '100%',
            playerVars: { rel: 0, modestbranding: 1 },
            events: {
               onReady: (event) => {
                  // Seek về vị trí đã xem trước
                  if (maxWatchedRef.current > 0) {
                     event.target.seekTo(maxWatchedRef.current, true);
                  }
               },
               onStateChange: (event) => {
                  if (event.data === window.YT.PlayerState.PLAYING) {
                     startTracking();
                  } else if (
                     event.data === window.YT.PlayerState.PAUSED ||
                     event.data === window.YT.PlayerState.ENDED
                  ) {
                     stopTracking();
                     saveProgress();
                  }
               },
            },
         });
      };

      if (window.YT && window.YT.Player) {
         initPlayer();
      } else {
         const prevCallback = window.onYouTubeIframeAPIReady;
         window.onYouTubeIframeAPIReady = () => {
            if (prevCallback) prevCallback();
            initPlayer();
         };
      }

      return () => {
         stopTracking();
         saveProgress();
         if (playerRef.current) {
            try { playerRef.current.destroy(); } catch (e) { /* ignore */ }
            playerRef.current = null;
         }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [youtubeId, lessonId]);

   // ── Tracking mỗi 1 giây ──────────────────────────────────────────────────
   const startTracking = () => {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
         if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;

         const currentTime = playerRef.current.getCurrentTime() || 0;
         const duration = playerRef.current.getDuration() || 1;
         const percent = Math.min((currentTime / duration) * 100, 100);

         if (currentTime > maxWatchedRef.current) {
            maxWatchedRef.current = currentTime;
         }

         const status = percent >= 90 ? 'Hoàn thành' : percent > 0 ? 'Đang học' : 'Chưa học';
         const newProgress = { percentage: Math.round(percent), watchedTime: Math.floor(currentTime), status };

         setLocalProgress(newProgress);
         // Thông báo lên component cha để cập nhật UI nút "Tiếp theo"
         onProgressChange && onProgressChange({
            played: percent / 100,
            playedSeconds: currentTime,
            loaded: 1,
            loadedSeconds: duration,
         });

         // Lưu DB mỗi 10 giây
         const floorTime = Math.floor(currentTime);
         if (floorTime % 10 === 0 && floorTime !== lastSavedRef.current && floorTime > 0) {
            lastSavedRef.current = floorTime;
            saveProgressToServer(currentTime, percent, status);
         }
      }, 1000);
   };

   const stopTracking = () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
   };

   const saveProgress = () => {
      if (maxWatchedRef.current > 0 && localProgress.percentage > 0) {
         saveProgressToServer(maxWatchedRef.current, localProgress.percentage, localProgress.status);
      }
   };

   const saveProgressToServer = (watchedTime, percentage, status) => {
      if (!lessonId || !token) return;
      const progressStatus = status === 'Hoàn thành' ? 'COMPLETED' : 'ACTIVE';
      api.updateUserProgress(token, {
         courseId: courseId,
         moduleId: moduleId,
         lessonId,
         progressPercent: Math.round(percentage),
         status: progressStatus,
      }).catch(err => console.error('[VideoPlayer] Lỗi lưu tiến độ:', err));
   };

   // Lưu khi rời trang (F5, Đóng tab, hoặc chuyển trang bằng Menu)
   useEffect(() => {
      const forceSave = () => {
         if (playerRef.current && playerRef.current.getCurrentTime && playerRef.current.getDuration) {
            const currentTime = playerRef.current.getCurrentTime();
            const duration = playerRef.current.getDuration();
            if (duration > 0) {
               const percent = (currentTime / duration) * 100;
               const status = percent >= 90 ? 'Hoàn thành' : percent > 0 ? 'Đang học' : 'Chưa học';
               saveProgressToServer(currentTime, percent, status);
            }
         }
      };

      window.addEventListener('beforeunload', forceSave);
      return () => {
         window.removeEventListener('beforeunload', forceSave);
         forceSave(); // Kích hoạt lưu ngay khi component bị hủy (người dùng chuyển trang)
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [lessonId, courseId, moduleId, token]);

   // ── Tracking cho video file .mp4 ─────────────────────────────────────────
   const handleVideoTimeUpdate = () => {
      const video = videoRef.current;
      if (!video || video.duration <= 0) return;
      const played = video.currentTime / video.duration;
      const percent = Math.round(played * 100);
      const status = percent >= 90 ? 'Hoàn thành' : percent > 0 ? 'Đang học' : 'Chưa học';
      setLocalProgress({ percentage: percent, watchedTime: Math.floor(video.currentTime), status });
      onProgressChange && onProgressChange({
         played,
         playedSeconds: video.currentTime,
         loaded: video.buffered.length > 0 ? video.buffered.end(0) / video.duration : 0,
         loadedSeconds: video.buffered.length > 0 ? video.buffered.end(0) : 0,
      });
   };

   // ── Render ────────────────────────────────────────────────────────────────
   if (youtubeId) {
      return (
         <div ref={containerRef}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
         />
      );
   }

   if (!url) {
      return (
         <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b'
         }}>
            Chưa có video cho bài học này
         </div>
      );
   }

   return (
      <video
         ref={videoRef}
         src={url}
         controls
         style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
         onTimeUpdate={handleVideoTimeUpdate}
      />
   );
};



const Lesson = () => {
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const courseId = searchParams.get('course');
   const { token } = useAuth();

   const [viewportWidth, setViewportWidth] = useState(getViewportWidth);
   const [leftOpen, setLeftOpen] = useState(() => getViewportWidth() >= MOBILE_BREAKPOINT);
   const [rightOpen, setRightOpen] = useState(() => getViewportWidth() >= RESOURCE_BREAKPOINT);

   const [course, setCourse] = useState(null);
   const [, setModules] = useState([]);
   const [activeModule, setActiveModule] = useState(null);
   const [lessons, setLessons] = useState([]);
   const [selectedLessonId, setSelectedLessonId] = useState(null);
   const [loading, setLoading] = useState(true);
   const [noteContent, setNoteContent] = useState('');
   const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
   const debounceTimer = useRef(null);
   const currentLessonRef = useRef(selectedLessonId);

   const [lessonProgress, setLessonProgress] = useState({});

   const isMobile = viewportWidth < MOBILE_BREAKPOINT;
   const isCompact = viewportWidth < RESOURCE_BREAKPOINT;

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
      if (isMobile) {
         setLeftOpen(false);
         setRightOpen(false);
      } else if (isCompact) {
         setLeftOpen(true);
         setRightOpen(false);
      } else {
         setLeftOpen(true);
         setRightOpen(true);
      }
   }, [isMobile, isCompact]);

   useEffect(() => {
      const initLesson = async () => {
         if (!courseId || !token) {
            setLoading(false);
            return;
         }
         try {
            setLoading(true);
            // 1. Fetch Course & Modules
            const courses = await api.getCourses(token);
            const currentCourse = courses.find(c => c.id === courseId);
            setCourse(currentCourse);

            const courseModules = await api.getModulesByCourse(token, courseId);
            setModules(courseModules);

            // 2. Fetch User Progress for this course
            const progress = await api.getUserProgress(token);
            const initialProgress = {};
            (progress._raw || []).forEach(p => {
               if (p.lessonId) {
                  initialProgress[p.lessonId] = {
                     played: (p.progressPercent || 0) / 100,
                     playedSeconds: 0,
                     completed: p.status === 'COMPLETED'
                  };
               }
            });
            setLessonProgress(initialProgress);

            if (courseModules.length > 0) {
               const firstModule = courseModules[0];
               setActiveModule(firstModule);

               // 3. Fetch Lessons for the first module
               const moduleLessons = await api.getLessonsByModule(token, firstModule.id);
               setLessons(moduleLessons);

               if (moduleLessons.length > 0) {
                  setSelectedLessonId(moduleLessons[0].id);
               }
            }
         } catch (error) {
            console.error("Error initializing lesson view:", error);
         } finally {
            setLoading(false);
         }
      };
      initLesson();
   }, [courseId, token]);

   // 1. Fetch note mỗi khi đổi lesson
   useEffect(() => {
      if (!selectedLessonId) return;

      currentLessonRef.current = selectedLessonId;
      setNoteContent('');
      setSaveStatus('idle');

      // Hủy debounce đang pending của lesson cũ
      if (debounceTimer.current) {
         clearTimeout(debounceTimer.current);
      }

      const fetchNote = async () => {
         try {
            const content = await api.getUserNote(token, selectedLessonId);
            // Chỉ set nếu user chưa chuyển sang lesson khác
            if (currentLessonRef.current === selectedLessonId) {
               setNoteContent(content);
            }
         } catch (error) {
            console.error("[Lesson] Lỗi tải ghi chú:", error);
         }
      };

      fetchNote();
   }, [selectedLessonId, token]);

   // 2. Auto-save với debounce 700ms
   const handleNoteChange = useCallback((e) => {
      const value = e.target.value;
      setNoteContent(value);
      setSaveStatus('saving');

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(async () => {
         // Chỉ save nếu vẫn đang ở đúng lesson
         if (currentLessonRef.current !== selectedLessonId) return;

         try {
            await api.updateUserNote(token, {
               lessonId: selectedLessonId,
               content: value
            });
            setSaveStatus('saved');
            // Sau 2s thì reset status về idle để sạch giao diện
            setTimeout(() => setSaveStatus('idle'), 2000);
         } catch (error) {
            setSaveStatus('error');
            console.error("[Lesson] Lỗi lưu ghi chú:", error);
         }
      }, 700);
   }, [selectedLessonId, token]);

   // 3. Cleanup khi unmount
   useEffect(() => {
      return () => {
         if (debounceTimer.current) clearTimeout(debounceTimer.current);
      };
   }, []);

   const lastSyncRef = React.useRef({});

   const selectedLesson = useMemo(
      () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0],
      [lessons, selectedLessonId]
   );

   const completedCount = lessons.filter((lesson) => lessonProgress[lesson.id]?.completed).length;
   const progressPercent = lessons.length ? (completedCount / lessons.length) * 100 : 0;
   const showOverlay = (isMobile && leftOpen) || (isCompact && rightOpen);

   const updateLessonCompletion = (lessonId, completed) => {
      setLessons((currentLessons) =>
         currentLessons.map((lesson) =>
            lesson.id === lessonId ? { ...lesson, completed } : lesson
         )
      );
   };

   const closePanels = () => {
      if (isMobile) {
         setLeftOpen(false);
      }
      if (isCompact) {
         setRightOpen(false);
      }
   };

   const handleSelectLesson = (lessonId) => {
      setSelectedLessonId(lessonId);
      if (isMobile) {
         setLeftOpen(false);
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
         if (next && isMobile) {
            setLeftOpen(false);
         }
         return next;
      });
   };


   const handleProgress = (lessonId, state) => {
      const playedRatio = state.played || 0;
      const loadedRatio = state.loaded || 0;

      // Guard: nếu video chưa load thực sự (loaded=0) thì bỏ qua
      // ReactPlayer có thể báo played=1 khi video source lỗi/rỗng
      if (loadedRatio === 0 && playedRatio >= 0.95) return;
      if (state.playedSeconds < 1 && playedRatio >= 0.95) return;

      const completed = playedRatio >= 0.95 && state.playedSeconds > 10;

      setLessonProgress((currentProgress) => ({
         ...currentProgress,
         [lessonId]: {
            ...currentProgress[lessonId],
            ...state,
            completed
         }
      }));

      if (completed) {
         updateLessonCompletion(lessonId, true);
      }

      // Sync to backend every 10% or when completed, with at least 5s between syncs
      const lastSync = lastSyncRef.current[lessonId] || { percent: 0, time: 0 };
      const currentPercent = Math.round(playedRatio * 100);
      const now = Date.now();

      if (
         (currentPercent >= lastSync.percent + 10 || (completed && !lastSync.completed)) &&
         (now - lastSync.time > 5000)
      ) {
         lastSyncRef.current[lessonId] = { percent: currentPercent, time: now, completed };
         api.updateUserProgress(token, {
            courseId,
            moduleId: activeModule?.id,
            lessonId,
            progressPercent: currentPercent,
            status: completed ? 'COMPLETED' : 'ACTIVE'
         }).catch(err => console.error("Failed to sync progress:", err));
      }
   };

   // Logic điều hướng bài học
   const currentIndex = lessons.findIndex(l => l.id === selectedLessonId);
   const hasPrev = currentIndex > 0;
   const hasNext = currentIndex < lessons.length - 1;

   const currentProgress = lessonProgress[selectedLessonId]?.played || 0;
   const isNextDisabled = !hasNext || currentProgress < 0.7;

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

   if (loading) {
      return <div className="lesson-loading">Đang tải nội dung bài học...</div>;
   }

   if (!selectedLesson) {
      return (
         <div className="lesson-error-container">
            <div className="lesson-error-card">
               <div className="lesson-error-illustration">
                  <img src={errorIllustration} alt="Không tìm thấy bài học" />
               </div>
               <h2 className="lesson-error-title">Không tìm thấy bài học</h2>
               <p className="lesson-error-desc">
                  Xin lỗi, chúng tôi không thể tìm thấy nội dung bài học này hoặc bài học chưa được cập nhật.
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
         {showOverlay && (
            <button
               type="button"
               className="lesson-overlay"
               onClick={closePanels}
               aria-label="Close lesson panels"
            ></button>
         )}

         <div className="lesson-sidebar" style={{ display: leftOpen ? 'block' : 'none' }}>
            <div className="ls-header">
               <small className="ls-course-label">{course?.code} Course</small>
               <h3 className="ls-module-title">{activeModule?.title}</h3>
               <div className="ls-progress-bg">
                  <div
                     className="ls-progress-bar"
                     style={{ width: `${progressPercent}%` }}
                  ></div>
               </div>
            </div>

            <div className="ls-section-list">
               {lessons.map((lesson) => {
                  const isActive = lesson.id === selectedLessonId;
                  const isCompleted = lessonProgress[lesson.id]?.completed;

                  return (
                     <div key={lesson.id} className="ls-section-item">
                        <div className="ls-section-label">Section {lesson.sectionNumber || lesson.orderIndex}</div>
                        <button
                           type="button"
                           className={`ls-section-btn ${isActive ? 'active' : ''}`}
                           onClick={() => handleSelectLesson(lesson.id)}
                        >
                           <div className="ls-section-btn-icon">
                              {isCompleted ? <CheckCircle size={16} color="#22c55e" /> :
                                 isActive ? <Play size={16} fill="currentColor" /> :
                                    <div className="ls-section-btn-icon-empty"></div>}
                           </div>
                           <div className="ls-section-btn-content">
                              <span className={`ls-section-btn-text ${isActive ? 'active' : ''}`}>
                                 {lesson.title}
                              </span>
                              {lesson.videoDuration && (
                                 <span className="ls-section-btn-duration">{lesson.videoDuration}</span>
                              )}
                           </div>
                        </button>
                     </div>
                  );
               })}
            </div>
         </div>

         <div className="lesson-content">
            <div className="lc-topbar">
               <div className="lc-topbar-left">
                  <button
                     type="button"
                     onClick={toggleLeftSidebar}
                     className="lc-topbar-menu-btn"
                     aria-label="Toggle lesson navigation"
                     aria-expanded={leftOpen}
                  >
                     <Menu size={20} />
                  </button>
                  {/* Breadcrumb */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: '#64748b', minWidth: 0, flex: 1 }}>
                     {courseId && (
                        <>
                           <button
                              type="button"
                              id="lesson-back-to-course"
                              onClick={() => navigate(`/course/${courseId}?from=lesson`)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', padding: 0, flexShrink: 0 }}
                           >
                              <ArrowLeftIcon size={14} /> Khóa học
                           </button>
                           <span style={{ color: '#cbd5e1', flexShrink: 0 }}>/</span>
                        </>
                     )}
                     <span style={{ fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedLesson?.sectionNumber ? `Section ${selectedLesson.sectionNumber}` : `Lesson ${selectedLesson?.orderIndex || ''}`} — {selectedLesson?.title || ''}
                     </span>
                  </div>
               </div>
               <div className="lc-topbar-right">
                  <button
                     type="button"
                     onClick={toggleRightSidebar}
                     className="lc-topbar-doc-btn"
                     aria-label="Toggle lesson resources"
                     aria-expanded={rightOpen}
                  >
                     <FileText size={20} />
                  </button>
                  <button
                     type="button"
                     className="btn lc-btn-prev"
                     onClick={handlePrev}
                     disabled={!hasPrev}
                     style={{ opacity: hasPrev ? 1 : 0.5, cursor: hasPrev ? 'pointer' : 'not-allowed' }}
                  >
                     <ChevronLeft size={16} className="icon-mr-4" /> Trước
                  </button>
                  <button
                     type="button"
                     className={`btn btn-primary lc-btn-next ${isNextDisabled ? 'disabled' : ''}`}
                     onClick={handleNext}
                     disabled={isNextDisabled}
                     title={!hasNext ? "Hết bài học" : (currentProgress < 0.7 ? "Bạn cần học ít nhất 70% để tiếp tục" : "")}
                  >
                     Tiếp theo <ChevronRight size={16} className="icon-ml-4" />
                  </button>
               </div>
            </div>

            <div className="lesson-main">
               <div className="lc-main-container">
                  <div
                     className="video-placeholder"
                     style={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: '56.25%',
                        borderRadius: '0.75rem',
                        overflow: 'hidden',
                        marginBottom: '2rem',
                        background: '#000'
                     }}
                  >
                     {selectedLesson ? (
                        <VideoPlayer
                           url={selectedLesson.videoUrl}
                           lessonId={selectedLesson.id}
                           courseId={courseId}
                           moduleId={activeModule?.id}
                           token={token}
                           onProgressChange={(state) => handleProgress(selectedLesson.id, state)}
                        />
                     ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                           Đang chuẩn bị video...
                        </div>
                     )}
                  </div>

                  <h1 className="lc-title">{selectedLesson?.title || ''}</h1>

                  <div className="lc-alert-box" style={{ marginTop: 0 }}>
                     <h4 className="lc-alert-title">
                        <AlertCircle size={20} className="icon-mr-8" />
                        Tiến độ video
                     </h4>
                     <p className="lc-alert-text">
                        Đã xem: {Math.round((lessonProgress[selectedLesson.id]?.played ?? 0) * 100)}% | Thời gian xem: {Math.round(lessonProgress[selectedLesson.id]?.playedSeconds ?? 0)}s | Trạng thái: {lessonProgress[selectedLesson.id]?.completed ? 'Hoàn thành' : 'Đang học'}
                     </p>
                  </div>

                  <div className="lc-text-content">
                     {selectedLesson.contentHtml ? (
                        <MarkdownRenderer content={selectedLesson.contentHtml} />
                     ) : (
                        <p className="lc-paragraph">Chưa có nội dung văn bản cho bài học này.</p>
                     )}
                  </div>
               </div>
            </div>
         </div>

         <div className="lesson-sidebar-right" style={{ display: rightOpen ? 'flex' : 'none' }}>
            <div className="rs-header">Tài nguyên & Ghi chú</div>

            <div className="rs-content">
               <div>
                  <h4 className="rs-section-title">Tài liệu đính kèm</h4>
                  <div className="rs-resource-list">
                     <p style={{ fontSize: '0.85rem', color: '#64748b', padding: '0.5rem' }}>
                        Chưa có tài liệu cho bài học này.
                     </p>
                  </div>
               </div>

               <div>
                  <h4 className="rs-section-title">Ghi chú cá nhân</h4>
                  <textarea
                     className="rs-textarea"
                     placeholder="Viết ghi chú tại đây... (được lưu tự động)"
                     value={noteContent}
                     onChange={handleNoteChange}
                     maxLength={10000}
                  ></textarea>
                  <div className="rs-note-status" style={{ fontSize: '0.75rem', marginTop: '4px', textAlign: 'right', minHeight: '1.2em' }}>
                     {saveStatus === 'saving' && <span style={{ color: '#64748b' }}> đang lưu...</span>}
                     {saveStatus === 'saved' && <span style={{ color: '#16a34a' }}>Đã lưu ✓</span>}
                     {saveStatus === 'error' && <span style={{ color: '#dc2626' }}>Lỗi lưu, thử lại sau.</span>}
                  </div>
               </div>

               <div className="rs-discussion-box">
                  <h4 className="rs-discussion-title">
                     <span style={{ marginRight: '0.5rem' }}>💬</span> Thảo luận bài học
                  </h4>
                  <p className="rs-discussion-text">Bắt đầu thảo luận về bài học này.</p>
                  <button type="button" className="rs-discussion-btn">
                     Gửi câu hỏi
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
};

export default Lesson;
