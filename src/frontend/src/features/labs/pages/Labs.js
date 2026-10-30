import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/Labs.css';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Download,
  Clock,
  Terminal,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  BookOpen,
  Network,
  Zap,
  AlertCircle,
  FileText,
  Laptop,
  Lock,
} from 'lucide-react';
import { api, BACKEND_URL } from '../../../services/Api.js';
import { useAuth } from '../../../context/AuthContext';
import Dialog from '../../../components/ui/Dialog';
import HeartbeatLoader from '../../../components/ui/HeartbeatLoader';
import { useToast } from '../../../components/ui/Toast';
import CliLabWorkspace from '../components/CliLabWorkspace';
import { prefersReducedMotion } from '../utils/labMotion';
import { storeTransitionEvent } from '../../courses/hooks/useLearningProgress';
import { sanitizeHtml } from '@ccna/shared/sanitizeHtml';

// Giải quyết URL file lab: local path hoặc Cloudinary URL
const getLabFileUrl = (fileUrl) => {
  if (!fileUrl || fileUrl === '#') return null;
  if (fileUrl.startsWith('http')) return fileUrl;
  // File local: trỏ tới backend server
  return `${BACKEND_URL}${fileUrl}`;
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button className="lab-copy-btn" onClick={handleCopy} title="Copy">
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
};

const LabGuideModal = ({ lab, onClose, onComplete, isGuestView, onGuestBlocked }) => {
  const [step, setStep] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimer = useRef(null);
  const dialogRef = useRef(null);
  const totalSteps = lab.steps?.length || 0;

  const requestClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    const delay = prefersReducedMotion() ? 0 : 220;
    closeTimer.current = window.setTimeout(onClose, delay);
  }, [isClosing, onClose]);

  const handleKey = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        if (isZoomed) {
          setIsZoomed(false);
        } else {
          requestClose();
        }
      }
    },
    [isZoomed, requestClose]
  );

  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    dialog.querySelector('button')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
      document.body.style.overflow = '';
    };
  }, []);

  // Đổi handler bàn phím khi bắt đầu animation không được hủy timer đóng.
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    []
  );

  const currentStep = lab.steps?.[step];

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Hướng dẫn lab: ${lab.title}`}
      className={`lab-guide-dialog lab-modal-overlay ${isClosing ? 'is-closing' : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        handleKey({ key: 'Escape' });
      }}
    >
      <div className="lab-guide-mobile-fallback" role="status">
        <div className="cli-mobile-fallback-card">
          <div className="cli-mobile-fallback-icon">
            <Laptop size={36} />
          </div>
          <h3>Chức năng này cần dùng trên Laptop</h3>
          <p>
            Hướng dẫn lab có sơ đồ, terminal và nhiều bước thao tác; hãy mở lại trên màn hình rộng
            hơn.
          </p>
          <button type="button" className="cli-mobile-fallback-btn" onClick={requestClose}>
            Quay lại danh sách bài học
          </button>
        </div>
      </div>
      <div
        className={`lab-modal ${isClosing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lab-modal-topbar">
          <div className="lab-modal-dots">
            <button
              type="button"
              className="dot-red"
              onClick={requestClose}
              title="Đóng"
              aria-label="Đóng hướng dẫn lab"
            />
            <span className="dot-yellow" />
            <span className="dot-green" />
          </div>
          <span className="lab-modal-title-bar">
            <Terminal size={13} style={{ marginRight: 6 }} />
            cisco-lab - {lab.title}
          </span>
          <button
            type="button"
            className="lab-modal-close"
            onClick={requestClose}
            aria-label="Đóng hướng dẫn lab"
          >
            <X size={16} />
          </button>
        </div>

        <div className="lab-modal-body">
          <div className="lab-modal-sidebar">
            <div className="lab-sidebar-section">
              <div className="lab-sidebar-label">
                <Network size={13} /> Sơ đồ mạng (Topology)
              </div>
              {lab.topologyImgUrl ? (
                <button
                  type="button"
                  aria-label="Phóng to sơ đồ mạng"
                  className="lab-topology-img-wrap"
                  style={{
                    marginTop: '8px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid #30363d',
                    cursor: 'zoom-in',
                  }}
                  onClick={() => setIsZoomed(true)}
                  title="Phóng to sơ đồ mạng"
                >
                  <img
                    src={lab.topologyImgUrl}
                    alt="Topology"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                    width={640}
                    height={360}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ) : (
                <pre className="lab-topology-pre">{lab.topology || 'Không có sơ đồ'}</pre>
              )}
            </div>

            <div className="lab-sidebar-section">
              <div className="lab-sidebar-label">
                <BookOpen size={13} /> Mục tiêu
              </div>
              <p className="lab-objective-text">{lab.objective || 'Chưa có mô tả mục tiêu'}</p>
            </div>

            {lab.guideContent && (
              <div className="lab-sidebar-section">
                <div className="lab-sidebar-label">
                  <FileText size={13} /> Nội dung hướng dẫn
                </div>
                <div
                  className="lab-guide-rich-text"
                  style={{
                    fontSize: '0.85rem',
                    color: '#c9d1d9',
                    marginTop: '8px',
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(lab.guideContent) }}
                />
              </div>
            )}

            <div className="lab-sidebar-section">
              <div className="lab-sidebar-label">
                <Zap size={13} /> Công cụ
              </div>
              <div className="lab-tool-tags">
                {lab.tools?.map((t) => (
                  <span key={t} className="lab-tool-tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="lab-step-dots">
              {lab.steps?.map((_, i) => (
                <button
                  key={i}
                  className={`lab-step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}
                  onClick={() => setStep(i)}
                  title={`Bước ${i + 1}`}
                />
              ))}
            </div>

            <div
              className="lab-sidebar-section"
              style={{
                background: 'rgba(56, 98, 152, 0.1)',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(56, 98, 152, 0.3)',
                marginTop: 'auto',
                marginBottom: '10px',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#58a6ff',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Check size={12} /> CHẤM ĐIỂM TỰ ĐỘNG
              </div>
              <p
                style={{
                  fontSize: '0.7rem',
                  color: '#8b949e',
                  margin: '4px 0 0 0',
                  lineHeight: 1.5,
                }}
              >
                {isGuestView
                  ? 'Đăng nhập để tải file và thực hành lab.'
                  : 'Thực hành trong file lab, rồi kiểm tra kết quả trước khi xác nhận hoàn thành.'}
              </p>
            </div>

            {isGuestView ? (
              <button type="button" className="lab-download-btn" onClick={onGuestBlocked}>
                <Download size={14} /> Tải file bài tập (.pka)
              </button>
            ) : getLabFileUrl(lab.fileUrl) ? (
              <a href={getLabFileUrl(lab.fileUrl)} className="lab-download-btn" download>
                <Download size={14} /> Tải file bài tập (.pka)
              </a>
            ) : (
              <button
                type="button"
                className="lab-download-btn"
                title="Bài lab này chưa có file đính kèm"
                style={{ opacity: 0.5, cursor: 'not-allowed' }}
                disabled
              >
                <Download size={14} /> Chưa có file (.pka)
              </button>
            )}
          </div>

          <div className="lab-modal-terminal">
            <div className="lab-step-header">
              <span className="lab-step-badge">
                Bước {step + 1}/{totalSteps}
              </span>
              <h3 className="lab-step-title">{currentStep?.title}</h3>
            </div>

            <div className="lab-cli-block">
              {currentStep?.commands?.map((cmd, i) => (
                <div key={i} className="lab-cli-line">
                  <span className="lab-cli-prompt">$</span>
                  <span className="lab-cli-cmd">{cmd}</span>
                  <CopyButton text={cmd} />
                </div>
              ))}
            </div>

            {currentStep?.note && (
              <div className="lab-step-note">
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{currentStep.note}</span>
              </div>
            )}

            <div className="lab-step-nav">
              <button
                className="lab-nav-btn"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                <ChevronLeft size={16} /> Bước trước
              </button>

              {step < totalSteps - 1 ? (
                <button className="lab-nav-btn primary" onClick={() => setStep((s) => s + 1)}>
                  Bước tiếp theo <ChevronRight size={16} />
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: '0.7rem', color: '#d29922', paddingBottom: '6px' }}>
                    * Đảm bảo bạn đã đạt 100% completion trước khi xác nhận.
                  </div>
                  <button
                    className="lab-nav-btn success"
                    onClick={() => (isGuestView ? onGuestBlocked() : onComplete(lab.id))}
                  >
                    <Check size={16} /> Xác nhận hoàn thành lab
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Zoom Overlay */}
      {isZoomed && (
        <Dialog title="Sơ đồ mạng" onClose={() => setIsZoomed(false)}>
          <img
            src={lab.topologyImgUrl}
            alt={`Sơ đồ mạng: ${lab.title}`}
            width={960}
            height={640}
            style={{ width: '100%', height: 'auto' }}
          />
        </Dialog>
      )}
    </dialog>
  );
};

const difficultyConfig = {
  EASY: { label: 'Dễ', cls: 'badge-easy' },
  MEDIUM: { label: 'Trung bình', cls: 'badge-medium' },
  HARD: { label: 'Khó', cls: 'badge-hard' },
  Easy: { label: 'Dễ', cls: 'badge-easy' },
  Medium: { label: 'Trung bình', cls: 'badge-medium' },
  Hard: { label: 'Khó', cls: 'badge-hard' },
};

export const LabCard = ({
  lab,
  isCompleted,
  onSelect,
  onStartCli,
  isGuestView,
  onGuestBlocked,
}) => {
  const diff = difficultyConfig[lab.difficulty] || { label: lab.difficulty, cls: 'badge-gray' };
  const isCliLab = lab.labType === 'CLI_SIMULATION';
  const locked = !isGuestView && lab.access?.canAccess === false;
  const prerequisite = lab.access?.unmetLessons?.[0];

  return (
    <div className="lab-card">
      <div className="lab-card-img-wrap">
        <img
          src={lab.imageUrl}
          alt={lab.title}
          className="lab-card-img"
          width={640}
          height={360}
          loading="lazy"
          decoding="async"
        />
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: '8px' }}>
          {isCompleted && (
            <span
              className="lab-badge badge-easy"
              style={{
                position: 'relative',
                top: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Check size={10} /> ĐÃ XONG
            </span>
          )}
          {isCliLab ? (
            <span
              className="lab-badge lab-badge-cli"
              style={{ position: 'relative', top: 0, right: 0 }}
            >
              WEB CLI
            </span>
          ) : null}
          <span
            className={`lab-badge ${diff.cls}`}
            style={{ position: 'relative', top: 0, right: 0 }}
          >
            {diff.label}
          </span>
        </div>
        <div className="lab-card-overlay" />
      </div>

      <div className="lab-card-body">
        <span className="lab-card-category">{lab.category}</span>
        <h3 className="lab-card-title">{lab.title}</h3>
        {lab.access?.mode === 'OPEN' && <small className="lab-access-mode">Tự luyện</small>}

        <div className="lab-card-meta">
          <span>
            <Clock size={13} /> {lab.duration}
          </span>
          <span>
            <Terminal size={13} /> {lab.tools?.join(', ')}
          </span>
        </div>

        <div className="lab-card-actions">
          {isCliLab ? (
            <button
              className="lab-btn-primary"
              disabled={locked}
              aria-describedby={locked ? `lab-lock-${lab.id}` : undefined}
              onClick={() => (isGuestView ? onGuestBlocked() : onStartCli(lab))}
            >
              {locked ? <Lock size={14} aria-hidden="true" /> : <Terminal size={14} />}{' '}
              {locked ? 'Chưa mở khóa' : 'Mở CLI Lab'}
            </button>
          ) : (
            <>
              {isGuestView ? (
                <button type="button" className="lab-btn-outline" onClick={onGuestBlocked}>
                  <Download size={14} /> Tải file
                </button>
              ) : !locked && getLabFileUrl(lab.fileUrl) ? (
                <a href={getLabFileUrl(lab.fileUrl)} className="lab-btn-outline" download>
                  <Download size={14} /> Tải file
                </a>
              ) : (
                <button
                  type="button"
                  className="lab-btn-outline"
                  title="Bài lab này chưa có file đính kèm"
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                  disabled
                >
                  <Download size={14} /> Chưa có file
                </button>
              )}

              <button className="lab-btn-primary" disabled={locked} onClick={() => onSelect(lab)}>
                <BookOpen size={14} /> Xem hướng dẫn
              </button>
            </>
          )}
        </div>
        {locked && (
          <div className="lab-access-lock" id={`lab-lock-${lab.id}`}>
            <p>{lab.access.lockedReason}</p>
            {prerequisite ? (
              <Link
                to={`/lesson?course=${encodeURIComponent(prerequisite.courseId)}&lesson=${prerequisite.id}`}
              >
                Học bài: {prerequisite.title} ({prerequisite.requiredPercent}%)
              </Link>
            ) : (
              <Link to="/roadmap">Xem lộ trình</Link>
            )}
            {lab.access.unmetLessons?.length > 1 && (
              <small>Còn {lab.access.unmetLessons.length} bài cần học.</small>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const Labs = () => {
  const { token, user, isAuthenticated } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const isGuest = !isAuthenticated;

  const [searchParams, setSearchParams] = useSearchParams();
  const labIdParam = searchParams.get('labId');

  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLab, setSelectedLab] = useState(null);
  const [selectedCliLab, setSelectedCliLab] = useState(null);
  const [completedLabs, setCompletedLabs] = useState([]);
  const [loadedToken, setLoadedToken] = useState(undefined);

  // Tự động mở bài Lab nếu có labIdParam trong URL
  useEffect(() => {
    if (loadedToken !== (token || null)) return;
    if (labs.length > 0 && labIdParam) {
      const foundLab = labs.find((l) => l.id.toString() === labIdParam);
      if (foundLab && foundLab.access?.canAccess !== false && isAuthenticated) {
        if (foundLab.labType === 'CLI_SIMULATION' && isAuthenticated) {
          setSelectedLab(null);
          setSelectedCliLab(foundLab);
        } else {
          setSelectedCliLab(null);
          setSelectedLab(foundLab);
        }
      } else {
        setSelectedLab(null);
        setSelectedCliLab(null);
      }
    } else {
      setSelectedLab(null);
      setSelectedCliLab(null);
    }
  }, [labs, labIdParam, isAuthenticated, token, loadedToken]);

  const openLab = (lab) => {
    if (!isAuthenticated) {
      setSelectedLab(lab);
      return;
    }
    if (lab.access?.canAccess === false) return;
    const params = new URLSearchParams(searchParams);
    params.set('labId', String(lab.id));
    setSearchParams(params);
  };
  const closeLab = () => {
    setSelectedLab(null);
    setSelectedCliLab(null);
    const params = new URLSearchParams(searchParams);
    params.delete('labId');
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        setLoading(true);
        setLoadError('');
        setLoadedToken(undefined);
        setSelectedLab(null);
        setSelectedCliLab(null);
        setLabs([]);
        setCompletedLabs([]);

        // Luôn tải danh sách lab (hỗ trợ cả tài khoản guest)
        const labsData = await api.getLabs(token);
        if (cancelled) return;
        setLabs(labsData);

        let done = [];
        // Chỉ tải tiến độ học tập nếu tài khoản đã đăng nhập
        if (token) {
          const progressMap = await api.getUserProgress(token);
          done = Object.entries(progressMap)
            .filter(([key, val]) => key.startsWith('lab_') && val.status === 'COMPLETED')
            .map(([key]) => key.replace('lab_', ''));
        }

        if (cancelled) return;
        setCompletedLabs(done);
        setLoadedToken(token || null);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load labs data', err);
        setLoadError(err.message || 'Không thể tải danh sách Lab.');
        setLoadedToken(token || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const allCategories = React.useMemo(() => {
    const list = ['All', 'Switching', 'Routing', 'Security', 'Services', 'Automation'];
    const set = new Set(list);
    labs.forEach((l) => {
      if (l.category) {
        const formatted = l.category.charAt(0).toUpperCase() + l.category.slice(1).toLowerCase();
        set.add(formatted);
      }
    });
    return Array.from(set);
  }, [labs]);

  const filteredLabs = labs.filter((lab) => {
    const matchCat =
      filter === 'All' || (lab.category && lab.category.toLowerCase() === filter.toLowerCase());
    const matchSearch = lab.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  const notifyGuestBlocked = useCallback(() => {
    showToast('Guest chỉ được xem thông tin lab. Vui lòng đăng nhập để thực hành.', 'info');
  }, [showToast]);

  return (
    <div className="labs-page">
      {ToastComponent}

      {/* Thông báo thiết bị di động */}
      <div className="lab-mobile-notice" role="note">
        <Laptop size={20} className="lab-mobile-notice-icon" />
        <div className="lab-mobile-notice-content">
          <div className="lab-mobile-notice-title">Chức năng này cần dùng trên Laptop</div>
          <p className="lab-mobile-notice-desc">
            Để gõ lệnh Cisco CLI và thao tác sơ đồ mạng topology mô phỏng chính xác nhất, bạn nên sử
            dụng máy tính hoặc Laptop.
          </p>
        </div>
      </div>

      <div className="labs-header">
        <div className="labs-header-text">
          <h1 className="labs-main-title">Phòng Lab Thực Hành</h1>
          <p className="labs-main-desc">
            Kho bài lab chuẩn Cisco - topology, CLI step-by-step, file Packet Tracer.
          </p>
        </div>

        <div className="labs-search-wrap">
          <Search size={16} className="labs-search-icon" />
          <input
            aria-label="Tìm bài lab"
            type="text"
            className="labs-search-input"
            placeholder="Tìm kiếm bài lab..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-bar">
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            aria-pressed={filter.toLowerCase() === cat.toLowerCase()}
            className={`filter-btn ${filter.toLowerCase() === cat.toLowerCase() ? 'active' : ''}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading || loadedToken !== (token || null) ? (
        <HeartbeatLoader label="Đang tải danh sách lab..." />
      ) : loadError ? (
        <div className="labs-empty" role="alert">
          <Terminal size={40} />
          <p>{loadError}</p>
          <button
            type="button"
            className="lab-btn-primary"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Thử tải lại
          </button>
        </div>
      ) : filteredLabs.length === 0 ? (
        <div className="labs-empty">
          <Terminal size={40} />
          <p>Không tìm thấy bài lab phù hợp.</p>
        </div>
      ) : (
        <div className="lab-grid">
          {filteredLabs.map((lab) => (
            <LabCard
              key={lab.id}
              lab={lab}
              isCompleted={completedLabs.includes(String(lab.id))}
              onSelect={openLab}
              onStartCli={openLab}
              isGuestView={isGuest}
              onGuestBlocked={notifyGuestBlocked}
            />
          ))}
        </div>
      )}

      {selectedLab && loadedToken === (token || null) && (
        <LabGuideModal
          lab={selectedLab}
          onClose={closeLab}
          onComplete={async (id) => {
            try {
              // Lưu vào cơ sở dữ liệu
              const res = await api.updateUserProgress(token, {
                labId: id,
                status: 'COMPLETED',
                progressPercent: 100,
                // Lấy courseId từ lab (nếu có) để cập nhật tiến độ tổng quát của khóa học
                courseId: selectedLab.courseId,
              });

              if (res?.transition?.changed) {
                storeTransitionEvent(res.transition, user?.id);
              }

              if (!completedLabs.includes(String(id))) {
                setCompletedLabs((prev) => [...prev, String(id)]);
              }
              showToast('Chúc mừng! Bạn đã hoàn thành bài thực hành.', 'success');
            } catch (err) {
              console.error('Failed to save lab progress', err);
              showToast('Không thể lưu tiến độ. Vui lòng thử lại sau.', 'error');
            }
            closeLab();
          }}
          isGuestView={isGuest}
          onGuestBlocked={notifyGuestBlocked}
        />
      )}

      {selectedCliLab && loadedToken === (token || null) ? (
        <CliLabWorkspace
          lab={selectedCliLab}
          onClose={closeLab}
          onPassed={(id) => {
            if (!completedLabs.includes(String(id)))
              setCompletedLabs((previous) => [...previous, String(id)]);
          }}
          onNotify={showToast}
        />
      ) : null}
    </div>
  );
};

export default Labs;
