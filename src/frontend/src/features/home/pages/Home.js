import AppIcon from '../../../components/ui/AppIcon';
import LearningResumeBanner from '../../../components/learning/LearningResumeBanner';
import HeroTopology from '../components/HeroTopology';
import HeroTerminalPreview from '../components/HeroTerminalPreview';
import useReducedMotion from '../../../hooks/useReducedMotion';
import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import '../styles/Home.css';
import { Link, useLocation } from 'react-router-dom';
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
import course1 from '../../../assets/images/course1.jpg';
import course2 from '../../../assets/images/course2.jpg';
import course3 from '../../../assets/images/course3.jpg';
import labPreview from '../../../assets/images/landing-lab.png';
import roadmapPreview from '../../../assets/images/landing-roadmap.png';
import examPreview from '../../../assets/images/landing-exam.png';
import { useAuth } from '../../../context/AuthContext';
import api, { BACKEND_URL } from '../../../services/Api';
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from '../utils/homeMotion';

/* ===============================
   STATIC DATA
================================= */

const COURSE_BACKGROUNDS = {
  ITN: course1,
  SRW: course2,
  SRWE: course2,
  ENA: course3,
  ENSA: course3,
};

const getCourseBackground = ({ code, thumbnailUrl }) => {
  if (!thumbnailUrl) return COURSE_BACKGROUNDS[code] || course3;
  if (/^https?:\/\//i.test(thumbnailUrl)) return thumbnailUrl;
  return `${BACKEND_URL}/${thumbnailUrl.replace(/^\/+/, '')}`;
};

// Icon mapping theo code khóa học
const COURSE_ICONS = {
  ITN: Code2,
  SRW: Router,
  SRWE: Router,
  ENA: Shield,
  ENSA: Shield,
};
const FALLBACK_ICON = TerminalSquare;
const COURSE_SKELETON_COUNT = 3;

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
      <AppIcon name={materialIcon} className="app-icon feat-icon" />
    </div>
    <h3 className="feat-title">{title}</h3>
    <p className="feat-desc">{desc}</p>
    <span className="feat-explore-btn">
      Khám phá
      <AppIcon name={'arrow_forward'} className="app-icon" style={{ fontSize: 16 }} />
    </span>
  </Link>
);

const CourseCardSkeleton = () => (
  <div className="course-card course-card-skeleton" aria-hidden="true">
    <div className="course-skeleton-number skeleton-shimmer" />
    <div className="course-skeleton-icon skeleton-shimmer" />
    <div className="course-skeleton-title skeleton-shimmer" />
    <div className="course-skeleton-line skeleton-shimmer" />
    <div className="course-skeleton-line short skeleton-shimmer" />
    <div className="course-skeleton-button skeleton-shimmer" />
  </div>
);

/* ===============================
   HERO TYPEWRITER CONFIG
 ================================= */

/* ===============================
   MAIN COMPONENT
 ================================= */

const HERO_PREFIX = 'Học CCNA theo lộ trình.';
const HERO_HIGHLIGHT_PHRASES = [
  'Thực hành mạng ngay khi học.',
  'Làm lab cấu hình Cisco thực tế.',
  'Luyện thi chứng chỉ CCNA 200-301.',
  'Tự tin làm chủ hạ tầng mạng.',
];

const HeroTerminal = lazy(() => import('../components/HeroTerminal'));

export const Home = () => {
  const reducedMotion = useReducedMotion();
  const [demoOpen, setDemoOpen] = useState(false);
  const { token, isAuthenticated } = useAuth();
  const location = useLocation();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);

  // Hiệu ứng chữ chạy từng chữ một (Typewriter effect) hiện đại cho tiêu đề banner

  const isReducedMotion = reducedMotion;
  const [prefixText, setPrefixText] = useState(isReducedMotion ? HERO_PREFIX : '');
  const [highlightText, setHighlightText] = useState(
    isReducedMotion ? HERO_HIGHLIGHT_PHRASES[0] : ''
  );
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
        }, 55);
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
        }, 55);
        return () => clearTimeout(timeout);
      } else {
        // Dừng khoảng 1.1 giây để người dùng đọc câu trọn vẹn.
        const timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 1100);
        return () => clearTimeout(timeout);
      }
    } else {
      if (highlightText.length > 0) {
        const timeout = setTimeout(() => {
          setHighlightText(highlightText.slice(0, -1));
        }, 30);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % HERO_HIGHLIGHT_PHRASES.length);
        }, 180);
        return () => clearTimeout(timeout);
      }
    }
  }, [
    prefixText,
    highlightText,
    isPrefixDone,
    isDeleting,
    phraseIndex,
    isReducedMotion,
    isAuthenticated,
  ]);

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

  // Endpoint summary đã trả sẵn tiến độ và bài học tiếp theo để Home chỉ cần một request nhẹ.
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const data = await api.getCourseSummaries(token);
        if (!isMounted) return;
        const mapped = data.map((c) => {
          const progress = c.progress ?? 0;

          return {
            id: c.id, // Dùng ID thật từ DB
            courseId: c.id,
            icon: COURSE_ICONS[c.code] || FALLBACK_ICON,
            title: c.title,
            desc: c.description,
            progress: progress,
            backgroundImage: getCourseBackground(c),
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

      fadeOnScroll('.home-learning-resume', '.home-learning-resume');
      fadeOnScroll('.landing-steps .landing-section-heading', '.landing-steps');
      fadeOnScroll('.landing-step-card', '.landing-steps__grid', 0.08);
      fadeOnScroll('.landing-faq .landing-section-heading', '.landing-faq');
      fadeOnScroll('.landing-faq__list', '.landing-faq');
      fadeOnScroll('.landing-final-cta', '.landing-final-cta');
      ScrollTrigger.refresh();
    },
    { dependencies: [isAuthenticated, reducedMotion], scope: containerRef, revertOnUpdate: true }
  );

  // Tự động chạy GSAP timeline & ScrollTrigger (fade in khi cuộn xuống, fade out khi cuộn ngược lên)
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      // Giữ một hiệu ứng xuất hiện cho hero, không gắn scrub khi cuộn.
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      tl.fromTo(
        '.landing-hero',
        { opacity: 0, y: -16 },
        { opacity: 1, y: 0, duration: 0.45, clearProps: 'opacity,transform' }
      );

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
    { dependencies: [isAuthenticated, reducedMotion], scope: containerRef, revertOnUpdate: true }
  );

  // Fade course card nhanh khi vào viewport và đảo chiều khi rời viewport.
  // Không dịch chuyển hoặc delay theo API nên không tạo lại cảm giác tải chậm.
  useGSAP(
    () => {
      if (loading || prefersReducedMotion()) return;

      const courseCards = gsap.utils.toArray(
        '.curriculum .course-card:not(.course-card-skeleton)',
        containerRef.current
      );
      if (!courseCards.length) return;

      gsap.fromTo(
        courseCards,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          duration: 0.22,
          stagger: 0.02,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: '.course-grid-container',
            start: 'top 88%',
            end: 'bottom 12%',
            toggleActions: 'play reverse play reverse',
          },
        }
      );
    },
    {
      dependencies: [isAuthenticated, loading, reducedMotion],
      scope: containerRef,
      revertOnUpdate: true,
    }
  );

  // Nội dung course thay skeleton nhưng giữ nguyên kích thước; chỉ refresh vị trí ScrollTrigger.
  useEffect(() => {
    if (loading) return undefined;
    const frameId = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frameId);
  }, [loading]);
  return (
    <div className="home-wrapper" ref={containerRef}>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__content">
          <p className="landing-eyebrow">NETMASTER · HỌC VÀ LUYỆN THI CCNA</p>
          <div className="hero-title-slot">
            {HERO_HIGHLIGHT_PHRASES.map((phrase) => (
              <span className="hero-title-reserve" aria-hidden="true" key={phrase}>
                {HERO_PREFIX} {phrase}
              </span>
            ))}
            <h1
              id="landing-title"
              aria-label="Học CCNA theo lộ trình. Thực hành mạng ngay khi học."
            >
              <span className="hero-title-prefix">
                {isReducedMotion ? HERO_PREFIX : prefixText}
              </span>
              {!isReducedMotion && !isPrefixDone && (
                <span
                  className="hero-typewriter-cursor hero-typewriter-cursor--prefix"
                  aria-hidden="true"
                />
              )}{' '}
              <span className="hero-title-highlight">
                {isReducedMotion ? HERO_HIGHLIGHT_PHRASES[0] : highlightText}
                {!isReducedMotion && isPrefixDone && (
                  <span className="hero-typewriter-cursor" aria-hidden="true" />
                )}
              </span>
            </h1>
          </div>
          <p className="landing-hero__description">
            Từ bài học nền tảng đến lab cấu hình và bài thi thử. Phù hợp cho người mới bắt đầu học
            mạng.
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

        <div className="landing-hero__visual">
          <HeroTopology />
          <div className="landing-hero__journey hero-terminal-card" aria-label="Terminal minh họa">
            <div className="hero-terminal-heading">
              <div className="hero-terminal-heading__title">
                <span className="hero-terminal-lights" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span>R1 · Terminal minh họa</span>
              </div>
              <span>CCNA</span>
            </div>
            <div className="hero-terminal-body">
              {demoOpen ? (
                <Suspense fallback={<p>Đang mở terminal…</p>}>
                  <HeroTerminal />
                </Suspense>
              ) : (
                <>
                  <HeroTerminalPreview />
                  <button
                    type="button"
                    className="hero-demo-button"
                    onClick={() => setDemoOpen(true)}
                  >
                    Thử CLI
                  </button>
                </>
              )}
            </div>
            <Link to="/exam/testing-center" className="hero-exam-badge">
              <ClipboardCheck size={17} aria-hidden="true" />
              Luyện thi CCNA
            </Link>
          </div>
        </div>
      </section>
      {isAuthenticated && (
        <div className="home-learning-resume">
          <LearningResumeBanner />
        </div>
      )}

      <section
        id="home-how-it-works"
        className="landing-steps"
        aria-labelledby="landing-steps-title"
      >
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
              width={1440}
              height={900}
              decoding="async"
            />
            <h3>Học theo lộ trình</h3>
            <p>Bắt đầu từ kiến thức mạng nền tảng và theo dõi phần đã hoàn thành.</p>
            <Link to="/roadmap">
              Xem lộ trình <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
          <article className="landing-step-card">
            <span className="landing-step-card__number">02</span>
            <Network size={28} aria-hidden="true" />
            <img
              className="landing-step-card__image landing-step-card__image--lab"
              src={labPreview}
              alt="Giao diện xem trước lab với sơ đồ mạng và danh sách nhiệm vụ"
              loading="lazy"
              width={1440}
              height={900}
              decoding="async"
            />
            <h3>Làm lab thực hành</h3>
            <p>Chọn bài lab để luyện thao tác cấu hình và xử lý tình huống mạng.</p>
            <Link to="/labs">
              Khám phá lab <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
          <article className="landing-step-card">
            <span className="landing-step-card__number">03</span>
            <ClipboardCheck size={28} aria-hidden="true" />
            <img
              className="landing-step-card__image landing-step-card__image--exam"
              src={examPreview}
              alt="Giao diện trung tâm kiểm tra với các bài thi thử CCNA"
              loading="lazy"
              width={1440}
              height={900}
              decoding="async"
            />
            <h3>Luyện thi và xem lại</h3>
            <p>Làm bài kiểm tra, xem kết quả và ôn lại nội dung cần cải thiện.</p>
            <Link to="/exam/testing-center">
              Xem bài kiểm tra <ArrowRight size={16} aria-hidden="true" />
            </Link>
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
          {loading && (
            <div className="course-grid" aria-busy="true">
              {Array.from({ length: COURSE_SKELETON_COUNT }, (_, index) => (
                <CourseCardSkeleton key={`course-skeleton-${index}`} />
              ))}
            </div>
          )}
          {!loading && courses.length === 0 && (
            <div className="home-course-status" role="status">
              <p>Chưa hiển thị được danh sách khóa học.</p>
              <Link to="/roadmap">
                Xem lộ trình học <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
          {!loading && courses.length > 0 && (
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
                      '--course-bg-image': `url(${JSON.stringify(course.backgroundImage)})`,
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
                            background: 'var(--color-muted)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${course.progress}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #386298, #4d74a2)',
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
          )}
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
            <p>
              Bạn có thể xem lộ trình và danh sách lab. Để lưu tiến độ và bắt đầu thực hành, hãy
              đăng nhập.
            </p>
          </details>
          <details>
            <summary>Tôi có thể tự kiểm tra sau khi học không?</summary>
            <p>
              Có. Mục Kiểm tra có các bài thi thử và phần xem lại kết quả để bạn tiếp tục ôn tập.
            </p>
          </details>
        </div>
      </section>

      <section className="landing-final-cta" aria-labelledby="landing-final-title">
        <div>
          <p className="landing-eyebrow">BẮT ĐẦU TỪ BƯỚC ĐẦU TIÊN</p>
          <h2 id="landing-final-title">Sẵn sàng học CCNA theo lộ trình của bạn?</h2>
          <p>Xem các chặng học, chọn bài phù hợp và bắt đầu thực hành khi bạn sẵn sàng.</p>
        </div>
        <Link
          to={isAuthenticated ? '/roadmap' : '/register'}
          className="landing-button landing-button--light"
        >
          {isAuthenticated ? 'Mở lộ trình học' : 'Tạo tài khoản'}{' '}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
};
export default Home;
