import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Code2,
  Network,
  Router,
  Shield,
  TerminalSquare,
} from 'lucide-react';
import course1 from '../../image/course1.jpg';
import course2 from '../../image/course2.jpg';
import course3 from '../../image/course3.jpg';
import labPreview from '../../image/landing-lab.png';
import roadmapPreview from '../../image/landing-roadmap.png';
import examPreview from '../../image/landing-exam.png';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/Api';
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from '../../utils/homeMotion';

/* ===============================
   STATIC DATA
================================= */

const courseBackgrounds = [course1, course2, course3];

// Icon mapping theo code khóa học
const COURSE_ICONS = {
  ITN: Code2,
  SRW: Router,
  SRWE: Router,
  ENA: Shield,
  ENSA: Shield,
};
const FALLBACK_ICON = TerminalSquare;

// Tạo statusText từ progress
const getStatusText = (progress) => {
  if (progress === 100) return 'HOÀN THÀNH 100%';
  if (progress > 0) return `ĐANG HỌC ${progress}%`;
  return 'CHƯA BẮT ĐẦU';
};

const features = [
  {
    materialIcon: 'calculate',
    title: 'Trình tính toán Subnet',
    desc: 'Phân chia dải mạng, tính toán host và broadcast nhanh chóng.',
    to: '/tools/subnet',
  },
  {
    materialIcon: 'account_tree',
    title: 'VLSM Calculator',
    desc: 'Phân bổ mạng con theo VLSM, tối ưu không gian địa chỉ IP.',
    to: '/tools/vlsm',
  },
  {
    materialIcon: 'terminal',
    title: 'Tra cứu Cisco CLI',
    desc: 'Tra cứu các lệnh IOS thường dùng cho Router và Switch.',
    to: '/tools/cli',
  },
  {
    materialIcon: 'format_list_bulleted',
    title: 'Tra cứu Port & Giao thức',
    desc: 'Danh sách các cổng dịch vụ phổ biến (HTTP, SSH, Telnet...).',
    to: '/tools/ports',
  },
];

/* ===============================
   REUSABLE COMPONENTS
 ================================= */

const FeatureCard = ({ materialIcon, title, desc, to }) => (
  <Link to={to} className="feat-card">
    <div className="feat-icon-box">
      <span className="material-icons-round feat-icon">{materialIcon}</span>
    </div>
    <h3 className="feat-title">{title}</h3>
    <p className="feat-desc">{desc}</p>
    <span className="feat-explore-btn">
      Khám phá
      <span className="material-icons-round" style={{ fontSize: 16 }}>
        arrow_forward
      </span>
    </span>
  </Link>
);

/* ===============================
   HERO TYPEWRITER CONFIG
 ================================= */
const HERO_PREFIX = 'Học CCNA theo lộ trình.';
const HERO_HIGHLIGHT_PHRASES = [
  'Thực hành mạng ngay khi học.',
  'Làm lab cấu hình Cisco thực tế.',
  'Luyện thi chứng chỉ CCNA 200-301.',
  'Tự tin làm chủ hạ tầng mạng.',
];

/* ===============================
   MAIN COMPONENT
 ================================= */

export const Home = () => {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const resumeCourse = courses.find((c) => c.progress > 0 && c.progress < 100) || null;

  // Hiệu ứng chữ chạy từng chữ một (Typewriter effect) hiện đại cho tiêu đề banner
  const isReducedMotion = prefersReducedMotion();
  const [prefixText, setPrefixText] = useState(isReducedMotion ? HERO_PREFIX : '');
  const [highlightText, setHighlightText] = useState(isReducedMotion ? HERO_HIGHLIGHT_PHRASES[0] : '');
  const [isPrefixDone, setIsPrefixDone] = useState(isReducedMotion);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isReducedMotion) return;

    // 1. Chạy gõ dòng prefix lần đầu
    if (!isPrefixDone) {
      if (prefixText.length < HERO_PREFIX.length) {
        const timeout = setTimeout(() => {
          setPrefixText(HERO_PREFIX.slice(0, prefixText.length + 1));
        }, 36);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsPrefixDone(true);
        }, 120);
        return () => clearTimeout(timeout);
      }
    }

    // 2. Chạy gõ / xóa cụm từ highlight
    const currentFullPhrase = HERO_HIGHLIGHT_PHRASES[phraseIndex];

    if (!isDeleting) {
      if (highlightText.length < currentFullPhrase.length) {
        const timeout = setTimeout(() => {
          setHighlightText(currentFullPhrase.slice(0, highlightText.length + 1));
        }, 46);
        return () => clearTimeout(timeout);
      } else {
        // Dừng 2.4s để người dùng đọc câu trọn vẹn
        const timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2400);
        return () => clearTimeout(timeout);
      }
    } else {
      if (highlightText.length > 0) {
        const timeout = setTimeout(() => {
          setHighlightText(highlightText.slice(0, -1));
        }, 22);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % HERO_HIGHLIGHT_PHRASES.length);
        }, 180);
        return () => clearTimeout(timeout);
      }
    }
  }, [prefixText, highlightText, isPrefixDone, isDeleting, phraseIndex, isReducedMotion]);

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  useEffect(() => {
    if (new URLSearchParams(location.search).get('section') === 'faq') {
      document.getElementById('home-faq')?.scrollIntoView({ block: 'start' });
    } else if (location.hash) {
      const targetId = location.hash.replace('#', '');
      setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        });
      }, 100);
    }
  }, [location.search, location.hash]);

  // Lấy dữ liệu khóa học thực từ API và tiến độ người dùng
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [data, progressMap] = await Promise.all([
          api.getCourses(token),
          isAuthenticated && token ? api.getUserProgress(token) : Promise.resolve({}),
        ]);
        if (!isMounted) return;
        const mapped = data.map((c, idx) => {
          // Lấy progress đã tính toán từ Backend
          const progress = c.progress || 0;

          // Tìm bài học chưa hoàn thành đầu tiên
          let nextLessonTitle = '';
          if (c.modules) {
            let foundNext = false;
            for (const mod of c.modules) {
              if (foundNext) break;
              if (mod.lessons) {
                for (const lesson of mod.lessons) {
                  const lessonProg = progressMap[`lesson_${lesson.id}`];
                  if (
                    !lessonProg ||
                    (lessonProg.percent < 100 && lessonProg.status !== 'COMPLETED')
                  ) {
                    nextLessonTitle = `Bài học tiếp theo: ${lesson.title}`;
                    foundNext = true;
                    break;
                  }
                }
              }
            }
          }
          if (!nextLessonTitle) {
            nextLessonTitle = 'Bài học tiếp theo: Tiếp tục lộ trình hiện tại';
          }

          return {
            id: c.id, // Dùng ID thật từ DB
            courseId: c.id,
            icon: COURSE_ICONS[c.code] || FALLBACK_ICON,
            title: c.title,
            desc: c.description,
            progress: progress,
            statusText: getStatusText(progress),
            backgroundImage:
              courseBackgrounds[idx] || courseBackgrounds[courseBackgrounds.length - 1],
            nextLessonTitle,
          };
        });
        setCourses(mapped);
      } catch (err) {
        console.error('Home: không thể tải dữ liệu', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [token, isAuthenticated]);

  // Các phần giới thiệu là nội dung tĩnh: animate ngay, không đợi API khóa học.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const fadeOnScroll = (selector, trigger, stagger = 0) => {
        if (!containerRef.current?.querySelector(selector)) return;

        gsap.fromTo(
          selector,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            stagger,
            ease: 'power2.out',
            scrollTrigger: {
              trigger,
              start: 'top 88%',
              end: 'bottom 12%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      };

      fadeOnScroll('.landing-steps .landing-section-heading', '.landing-steps');
      fadeOnScroll('.landing-step-card', '.landing-steps__grid', 0.08);
      fadeOnScroll('.landing-faq .landing-section-heading', '.landing-faq');
      fadeOnScroll('.landing-faq__list', '.landing-faq');
      fadeOnScroll('.landing-final-cta', '.landing-final-cta');
      ScrollTrigger.refresh();
    },
    { scope: containerRef }
  );

  // Tự động chạy GSAP timeline & ScrollTrigger (fade in khi cuộn xuống, fade out khi cuộn ngược lên)
  useGSAP(
    () => {
      if (loading || prefersReducedMotion()) return;

      // Giữ một hiệu ứng xuất hiện cho hero, không gắn scrub khi cuộn.
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      tl.fromTo(
        '.landing-hero',
        { opacity: 0, y: -16 },
        { opacity: 1, y: 0, duration: 0.45, clearProps: 'opacity,transform' }
      );

      // 2. Continue learning section (nếu có bài học đang dở)
      if (containerRef.current?.querySelector('.continue-learning')) {
        gsap.fromTo(
          '.continue-learning',
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: '.continue-learning',
              start: 'top 90%',
              end: 'bottom 10%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      }

      // 3. Lộ trình khóa học: Fade in khi cuộn vào tầm nhìn, Fade out khi cuộn ngược lên
      if (containerRef.current?.querySelector('.curriculum')) {
        gsap.fromTo(
          '.curriculum .section-header',
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: '.curriculum',
              start: 'top 85%',
              end: 'bottom 15%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );

        if (containerRef.current?.querySelector('.course-card')) {
          gsap.fromTo(
            '.curriculum .course-card',
            { opacity: 0, y: 28 },
            {
              opacity: 1,
              y: 0,
              stagger: 0.08,
              duration: 0.45,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: '.course-grid-container',
                start: 'top 85%',
                end: 'bottom 15%',
                toggleActions: 'play reverse play reverse',
              },
            }
          );
        }
      }

      // 4. Công cụ hỗ trợ: Fade in khi cuộn vào tầm nhìn, Fade out khi cuộn ngược lên
      if (containerRef.current?.querySelector('.features')) {
        gsap.fromTo(
          '.features .section-header',
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: '.features',
              start: 'top 85%',
              end: 'bottom 15%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );

        gsap.fromTo(
          '.feat-card',
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.06,
            duration: 0.4,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: '.features-grid',
              start: 'top 85%',
              end: 'bottom 15%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      }

      ScrollTrigger.refresh();
    },
    { dependencies: [loading], scope: containerRef }
  );

  const handleResumeLearning = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (resumeCourse) {
      navigate(`/lesson?course=${resumeCourse.courseId}`);
    }
  };

  const resumeNextLessonText = resumeCourse ? resumeCourse.nextLessonTitle : '';
  const ResumeIcon = resumeCourse?.icon || FALLBACK_ICON;

  return (
    <div className="home-wrapper" ref={containerRef}>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__content">
          <p className="landing-eyebrow">NETMASTERY · HỌC VÀ LUYỆN THI CCNA</p>
          <h1
            id="landing-title"
            aria-label="Học CCNA theo lộ trình. Thực hành mạng ngay khi học."
          >
            <span className="hero-title-prefix">{prefixText}</span>
            {!isPrefixDone && (
              <span
                className="hero-typewriter-cursor hero-typewriter-cursor--prefix"
                aria-hidden="true"
              />
            )}
            {' '}
            <span className="hero-title-highlight">
              {highlightText}
              {isPrefixDone && (
                <span className="hero-typewriter-cursor" aria-hidden="true" />
              )}
            </span>
          </h1>
          <p className="landing-hero__description">
            Từ bài học nền tảng đến lab cấu hình và bài thi thử, bạn có thể học và tự kiểm tra
            trong cùng một nền tảng. Phù hợp cho người mới bắt đầu học mạng.
          </p>
          <div className="landing-hero__actions">
            <Link to="/roadmap" className="landing-button landing-button--primary">
              Xem lộ trình học <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="landing-button landing-button--secondary"
              onClick={() => scrollToSection('home-how-it-works')}
            >
              Xem cách học
            </button>
          </div>
        </div>

        <div className="landing-hero__journey" aria-label="Ba phần trong hành trình học CCNA">
          <div className="landing-journey__heading">
            <span>Hành trình học CCNA</span>
            <span>CCNA 200-301</span>
          </div>
          <ol className="landing-journey__list">
            <li>
              <span className="landing-journey__icon"><BookOpen size={19} aria-hidden="true" /></span>
              <span><strong>Học kiến thức nền tảng</strong><small>Theo từng khóa học và bài học</small></span>
              <span className="landing-journey__number">01</span>
            </li>
            <li>
              <span className="landing-journey__icon"><Network size={19} aria-hidden="true" /></span>
              <span><strong>Thực hành cấu hình</strong><small>Áp dụng kiến thức trong bài lab</small></span>
              <span className="landing-journey__number">02</span>
            </li>
            <li>
              <span className="landing-journey__icon"><ClipboardCheck size={19} aria-hidden="true" /></span>
              <span><strong>Tự kiểm tra</strong><small>Luyện tập với bài thi thử</small></span>
              <span className="landing-journey__number">03</span>
            </li>
          </ol>
          <div className="landing-journey__footer">Học theo nhịp độ phù hợp với bạn</div>
        </div>
      </section>

      {/* Khóa học đang dở cần xuất hiện trước nội dung giới thiệu cho học viên. */}
      {isAuthenticated && resumeCourse && (
        <section className="continue-learning">
          <div className="continue-learning-inner">
            <div className="continue-learning-icon-wrap">
              <div className="continue-learning-icon-box" aria-hidden="true">
                <ResumeIcon size={26} strokeWidth={1.8} />
              </div>
            </div>

            <div className="continue-learning-content">
              <h2 className="continue-learning-title">
                {resumeCourse.title.replace(/\s*\(Updated\)/gi, '')}
              </h2>
              <p className="continue-learning-next-lesson">{resumeNextLessonText}</p>
              <div className="continue-learning-progress-wrap">
                <div className="continue-learning-progress-track">
                  <div
                    className="continue-learning-progress-fill"
                    style={{ width: `${resumeCourse.progress}%` }}
                  />
                </div>
                <p className="continue-learning-progress-label">
                  Đang học {resumeCourse.progress}%
                </p>
              </div>
            </div>

            <div className="continue-learning-actions">
              <button
                type="button"
                className="continue-learning-btn primary"
                onClick={handleResumeLearning}
              >
                Tiếp tục bài học
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      )}


      <section id="home-how-it-works" className="landing-steps" aria-labelledby="landing-steps-title">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">MỘT LỘ TRÌNH, BA CÁCH HỌC</p>
          <h2 id="landing-steps-title">Đi từ hiểu kiến thức đến làm được bài tập</h2>
          <p>Mỗi bước có một nơi để học, thực hành và kiểm tra kết quả.</p>
        </div>
        <div className="landing-steps__grid">
          <article className="landing-step-card">
            <span className="landing-step-card__number">01</span>
            <BookOpen size={28} aria-hidden="true" />
            <img
              className="landing-step-card__image landing-step-card__image--roadmap"
              src={roadmapPreview}
              alt="Giao diện lộ trình học CCNA với ba chặng kiến thức"
              loading="lazy"
            />
            <h3>Học theo lộ trình</h3>
            <p>Bắt đầu từ kiến thức mạng nền tảng và theo dõi phần đã hoàn thành.</p>
            <Link to="/roadmap">Xem lộ trình <ArrowRight size={16} aria-hidden="true" /></Link>
          </article>
          <article className="landing-step-card">
            <span className="landing-step-card__number">02</span>
            <Network size={28} aria-hidden="true" />
            <img
              className="landing-step-card__image landing-step-card__image--lab"
              src={labPreview}
              alt="Giao diện xem trước lab với sơ đồ mạng và danh sách nhiệm vụ"
              loading="lazy"
            />
            <h3>Làm lab thực hành</h3>
            <p>Chọn bài lab để luyện thao tác cấu hình và xử lý tình huống mạng.</p>
            <Link to="/labs">Khám phá lab <ArrowRight size={16} aria-hidden="true" /></Link>
          </article>
          <article className="landing-step-card">
            <span className="landing-step-card__number">03</span>
            <ClipboardCheck size={28} aria-hidden="true" />
            <img
              className="landing-step-card__image landing-step-card__image--exam"
              src={examPreview}
              alt="Giao diện trung tâm kiểm tra với các bài thi thử CCNA"
              loading="lazy"
            />
            <h3>Luyện thi và xem lại</h3>
            <p>Làm bài kiểm tra, xem kết quả và ôn lại nội dung cần cải thiện.</p>
            <Link to="/exam/testing-center">Xem bài kiểm tra <ArrowRight size={16} aria-hidden="true" /></Link>
          </article>
        </div>
      </section>

      {/* ================= Curriculum ================= */}
      <section id="home-courses" className="curriculum">
        <div className="section-header">
          <h2 className="section-title">Lộ trình học CCNA chuẩn Cisco</h2>
          <p className="section-desc">Đi từ nền tảng đến sẵn sàng thi CCNA 200-301.</p>
        </div>

        <div className="course-grid-container">
          <div className="course-grid-line"></div>
          {loading && <p className="home-course-status" role="status">Đang tải khóa học...</p>}
          {!loading && courses.length === 0 && (
            <div className="home-course-status" role="status">
              <p>Chưa hiển thị được danh sách khóa học.</p>
              <Link to="/roadmap">
                Xem lộ trình học <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
          <div className="course-grid">
            {courses.map((course) => {
              const Icon = course.icon;
              const isStarted = course.progress > 0;
              const showAsActive = !isAuthenticated || isStarted;
              const numberClass = showAsActive ? 'active' : 'inactive';
              const cardClass = showAsActive ? 'course-card active' : 'course-card inactive';

              return (
                <Link
                  key={course.id}
                  to={`/course/${course.courseId}?from=home`}
                  className={`${cardClass} with-bg`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.42), rgba(15, 23, 42, 0.74)), url(${course.backgroundImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    '--course-bg-image': `url(${course.backgroundImage})`,
                  }}
                  id={`home-course-card-${course.courseId}`}
                >
                  <div className={`course-number ${numberClass}`}>{course.id}</div>
                  <div className="icon-box">
                    <Icon size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="course-title">
                    {course.title.replace(' (Updated)', '').replace(/,/g, ', ')}
                  </h3>
                  <p className="course-desc">{course.desc}</p>

                  {isAuthenticated && (
                    <div className="course-progress-section">
                      <div
                        className="progress-bar-bg"
                        style={{
                          height: '6px',
                          background: '#e2e8f0',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${course.progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                            transition: 'width 0.5s ease-out',
                          }}
                        />
                      </div>
                      <p
                        className={`progress-text ${course.progress === 0 ? 'inactive' : ''}`}
                        style={{ marginTop: '6px', fontSize: '0.75rem', fontWeight: 600 }}
                      >
                        {course.progress > 0 ? `Tiến độ: ${course.progress}%` : 'Chưa bắt đầu'}
                      </p>
                    </div>
                  )}

                  <span className={`course-detail-btn ${showAsActive ? 'active' : 'inactive'}`}>
                    Xem chi tiết
                    <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= Features ================= */}
      <section id="home-tools" className="features">
        <div className="section-header">
          <h2 className="section-title">Công cụ hỗ trợ học tập</h2>
          <p>Các tiện ích giúp bạn tối ưu hóa quá trình học tập và thực hành mạng.</p>
        </div>

        <div className="features-grid">
          {features.map((item, i) => (
            <FeatureCard key={i} {...item} />
          ))}
        </div>
      </section>

      <section id="home-faq" className="landing-faq" aria-labelledby="landing-faq-title">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">CÂU HỎI THƯỜNG GẶP</p>
          <h2 id="landing-faq-title">Bắt đầu học thế nào?</h2>
        </div>
        <div className="landing-faq__list">
          <details>
            <summary>Tôi mới học mạng, nên bắt đầu ở đâu?</summary>
            <p>Bạn có thể mở lộ trình học để xem các chặng và chọn bài học nền tảng trước.</p>
          </details>
          <details>
            <summary>Có thể xem nội dung trước khi đăng ký không?</summary>
            <p>Bạn có thể xem lộ trình và danh sách lab. Để lưu tiến độ và bắt đầu thực hành, hãy đăng nhập.</p>
          </details>
          <details>
            <summary>Tôi có thể tự kiểm tra sau khi học không?</summary>
            <p>Có. Mục Kiểm tra có các bài thi thử và phần xem lại kết quả để bạn tiếp tục ôn tập.</p>
          </details>
        </div>
      </section>

      <section className="landing-final-cta" aria-labelledby="landing-final-title">
        <div>
          <p className="landing-eyebrow">BẮT ĐẦU TỪ BƯỚC ĐẦU TIÊN</p>
          <h2 id="landing-final-title">Sẵn sàng học CCNA theo lộ trình của bạn?</h2>
          <p>Xem các chặng học, chọn bài phù hợp và bắt đầu thực hành khi bạn sẵn sàng.</p>
        </div>
        <Link to={isAuthenticated ? '/roadmap' : '/register'} className="landing-button landing-button--light">
          {isAuthenticated ? 'Mở lộ trình học' : 'Tạo tài khoản'} <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
};
export default Home;
