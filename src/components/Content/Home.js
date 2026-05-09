import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Code2, Router, Shield, TerminalSquare } from 'lucide-react';
import { A1, A5, A4 } from '../../image';
import course1 from '../../image/course1.jpg';
import course2 from '../../image/course2.jpg';
import course3 from '../../image/course3.jpg';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/Api';

/* ===============================
   STATIC DATA
================================= */

const bannerData = [
  {
    image: A1,
    title: "Chinh phục CCNA 200-301 cùng chúng tôi",
    subtitle: "Bắt đầu hành trình trở thành Network Engineer chuyên nghiệp.",
    link: "/roadmap"
  },
  {
    image: A5,
    title: "Hệ thống luyện thi trắc nghiệm thông minh",
    subtitle: "Ngân hàng câu hỏi cập nhật liên tục, sát với đề thi thực tế.",
    link: "/exam"
  },
  {
    image: A4,
    title: "Thực hành Lab không giới hạn",
    subtitle: "Rèn luyện kỹ năng cấu hình thực tế với hàng trăm bài Lab chất lượng.",
    link: "/labs"
  }
];
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

const NEXT_LESSON_BY_COURSE = {
  c1: 'Bài học tiếp theo: Subnetting cơ bản',
  c2: 'Bài học tiếp theo: Cấu hình OSPF cơ bản',
  c3: 'Bài học tiếp theo: Giới thiệu WAN doanh nghiệp',
};

// Tạo statusText từ progress
const getStatusText = (progress) => {
  if (progress === 100) return 'HOÀN THÀNH 100%';
  if (progress > 0) return `ĐANG HỌC ${progress}%`;
  return 'CHƯA BẮT ĐẦU';
};

const features = [
  {
    materialIcon: "calculate",
    title: "Trình tính toán Subnet",
    desc: "Phân chia dải mạng, tính toán host và broadcast nhanh chóng.",
    to: "/tools/subnet",
  },
  {
    materialIcon: "account_tree",
    title: "VLSM Calculator",
    desc: "Phân bổ mạng con theo VLSM, tối ưu không gian địa chỉ IP.",
    to: "/tools/vlsm",
  },
  {
    materialIcon: "terminal",
    title: "Tra cứu Cisco CLI",
    desc: "Từ điển lệnh IOS đầy đủ cho Router và Switch.",
    to: "/tools/cli",
  },
  {
    materialIcon: "format_list_bulleted",
    title: "Tra cứu Port & Giao thức",
    desc: "Danh sách các cổng dịch vụ phổ biến (HTTP, SSH, Telnet...).",
    to: "/tools/ports",
  },
];

/* ===============================
   HOOKS
 ================================= */

/**
 * Counts from 0 → target over `duration` ms, then resets and repeats every `interval` ms.
 */
const useCountUp = (target, duration = 1500, interval = 3000) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frameId;
    let startTime = null;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setCount(Math.floor(eased * target));

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);

    // reset & repeat every `interval` ms
    const repeater = setInterval(() => {
      startTime = null;
      cancelAnimationFrame(frameId);
      setCount(0);
      frameId = requestAnimationFrame(animate);
    }, interval);

    return () => {
      cancelAnimationFrame(frameId);
      clearInterval(repeater);
    };
  }, [target, duration, interval]);

  return count;
};

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
      <span className="material-icons-round" style={{ fontSize: 16 }}>arrow_forward</span>
    </span>
  </Link>
);

const StatsSection = () => {
  const count120 = useCountUp(120);
  const count50 = useCountUp(50);
  const count1000 = useCountUp(1000);

  return (
    <section className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon icon-blue">
          <span className="material-icons-round">play_circle</span>
        </div>
        <div className="stat-info">
          <h3>{count120}+</h3>
          <p>Giờ học video</p>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon icon-indigo">
          <span className="material-icons-round">terminal</span>
        </div>
        <div className="stat-info">
          <h3>{count50}+</h3>
          <p>Bài lab thực hành</p>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon icon-purple">
          <span className="material-icons-round">fact_check</span>
        </div>
        <div className="stat-info">
          <h3>{count1000}+</h3>
          <p>Câu hỏi ôn thi</p>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon icon-emerald">
          <span className="material-icons-round">support_agent</span>
        </div>
        <div className="stat-info">
          <div className="stat-value-row">
            <h3>24/7</h3>
            <span className="online-dot" title="Đang online"></span>
          </div>
          <p>Hỗ trợ cộng đồng</p>
        </div>
      </div>
    </section>
  );
};

/* ===============================
   MAIN COMPONENT
 ================================= */

export const Home = () => {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [courses, setCourses] = useState([]);
  const resumeCourse = courses.find((c) => c.progress > 0 && c.progress < 100) || null;

  // Tự động chuyển banner
  useEffect(() => {
    const timer = setInterval(
      () => setCurrent((prev) => (prev + 1) % bannerData.length),
      5000
    );
    return () => clearInterval(timer);
  }, []);

  // Lấy dữ liệu khóa học thực từ API và tiến độ người dùng
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [data, progressMap] = await Promise.all([
          api.getCourses(token),
          isAuthenticated && token ? api.getUserProgress(token) : Promise.resolve({})
        ]);
        const mapped = data.map((c, idx) => {
          // Lấy progress đã tính toán từ Backend
          const progress = c.progress || 0;
          return {
            id: c.id, // Dùng ID thật từ DB
            courseId: c.id,
            icon: COURSE_ICONS[c.code] || FALLBACK_ICON,
            title: c.title,
            desc: c.description,
            progress: progress,
            statusText: getStatusText(progress),
            backgroundImage: courseBackgrounds[idx] || courseBackgrounds[courseBackgrounds.length - 1],
          };
        });
        setCourses(mapped);
      } catch (err) {
        console.error('Home: không thể tải dữ liệu', err);
      }
    };
    fetchData();
  }, [token, isAuthenticated]);

  const next = () =>
    setCurrent((prev) => (prev + 1) % bannerData.length);

  const prev = () =>
    setCurrent((prev) =>
      (prev - 1 + bannerData.length) % bannerData.length
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

  const resumeNextLessonText = resumeCourse
    ? (NEXT_LESSON_BY_COURSE[resumeCourse.courseId] || 'Bài học tiếp theo: Tiếp tục lộ trình hiện tại')
    : '';
  const ResumeIcon = resumeCourse?.icon || FALLBACK_ICON;

  return (
    <div className="home-wrapper">
      {/* ================= Banner ================= */}
      <section className="banner-section">
        <div className="banner-container">
          <button className="nav-btn prev" onClick={prev}>
            <ChevronLeft size={24} />
          </button>

          <button className="nav-btn next" onClick={next}>
            <ChevronRight size={24} />
          </button>

          {bannerData.map((slide, i) => (
            <div
              key={i}
              className={`banner-slide ${i === current ? "active" : ""}`}
            >
              <div className="banner-text-content">
                <h1 className="banner-title">
                  {slide.title}
                </h1>
                <p className="banner-subtitle">{slide.subtitle}</p>
                <Link to={slide.link} className="btn-primary-compact">
                  Bắt đầu ngay <ArrowRight size={18} style={{ marginLeft: '8px' }} />
                </Link>
              </div>
              <div
                className="banner-image-content"
                style={{ backgroundImage: `url(${slide.image})` }}
              ></div>
            </div>
          ))}

          <div className="banner-indicators">
            {bannerData.map((_, i) => (
              <button
                key={i}
                className={`indicator-dot ${i === current ? "active" : ""}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ================= Stats ================= */}
      <StatsSection />

      {/* ================= Continue Learning ================= */}
      {isAuthenticated && resumeCourse && (
        <section className="continue-learning">
          <div className="continue-learning-inner">
            <div className="continue-learning-icon-wrap">
              <div className="continue-learning-icon-box" aria-hidden="true">
                <ResumeIcon size={26} strokeWidth={1.8} />
              </div>
            </div>

            <div className="continue-learning-content">
              <h2 className="continue-learning-title">{resumeCourse.title}</h2>
              <p className="continue-learning-next-lesson">{resumeNextLessonText}</p>
              <div className="continue-learning-progress-wrap">
                <div className="continue-learning-progress-track">
                  <div
                    className="continue-learning-progress-fill"
                    style={{ width: `${resumeCourse.progress}%` }}
                  />
                </div>
                <p className="continue-learning-progress-label">Đang học {resumeCourse.progress}%</p>
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

      {/* ================= Curriculum ================= */}
      <section className="curriculum">
        <div className="section-header">
          <h2 className="section-title">Lộ trình học CCNA chuẩn Cisco</h2>
          <p className="section-desc">Đi từ nền tảng đến sẵn sàng thi CCNA 200-301.</p>
        </div>

        <div className="course-grid-container">
          <div className="course-grid-line"></div>
          <div className="course-grid">
            {courses.map((course) => {
              const Icon = course.icon;
              const isStarted = course.progress > 0;
              const showAsActive = !isAuthenticated || isStarted;
              const numberClass = showAsActive ? 'active' : 'inactive';
              const cardClass = showAsActive ? 'course-card active' : 'course-card inactive';

              return (
                <div
                  key={course.id}
                  className={`${cardClass} with-bg`}
                  style={{
                    cursor: 'pointer',
                    textDecoration: 'none',
                    color: 'inherit',
                    '--course-bg-image': `url(${course.backgroundImage})`,
                  }}
                  onClick={() => isAuthenticated
                    ? navigate(`/course/${course.courseId}?from=home`)
                    : navigate(`/course/${course.courseId}?from=home`)
                  }
                  id={`home-course-card-${course.courseId}`}
                >
                  <div className={`course-number ${numberClass}`}>{course.id}</div>
                  <div className="icon-box">
                    <Icon size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="course-title">{course.title}</h3>
                  <p className="course-desc">{course.desc}</p>

                  {isAuthenticated && (
                    <div className="course-progress-section">
                      <div className="progress-bar-bg" style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          className="progress-bar-fill"
                          style={{ 
                            width: `${course.progress}%`, 
                            height: '100%',
                            background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                            transition: 'width 0.5s ease-out'
                          }}
                        />
                      </div>
                      <p className={`progress-text ${course.progress === 0 ? 'inactive' : ''}`} style={{ marginTop: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {course.progress > 0 ? `Tiến độ: ${course.progress}%` : 'Chưa bắt đầu'}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    className={`course-detail-btn ${showAsActive ? 'active' : 'inactive'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isAuthenticated) {
                        navigate(`/course/${course.courseId}?from=home`);
                      } else {
                        navigate(`/course/${course.courseId}?from=home`);
                      }
                    }}
                  >
                    Xem chi tiết
                    <ArrowRight size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= Features ================= */}
      <section className="features">
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

    </div>
  );
};
export default Home;
