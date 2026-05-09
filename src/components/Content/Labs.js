import React, { useState, useEffect, useCallback } from "react";
import {
  Download, Clock, Terminal, Search, Loader2,
  X, ChevronLeft, ChevronRight, Copy, Check,
  BookOpen, Network, Zap, AlertCircle
} from "lucide-react";
import { api } from "../../services/Api.js";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast";

// Giải quyết URL file lab: local path hoặc Cloudinary URL
const getLabFileUrl = (fileUrl) => {
  if (!fileUrl || fileUrl === '#') return '#';
  if (fileUrl.startsWith('http')) return fileUrl;
  // File local: trỏ tới backend server
  return `http://localhost:5000${fileUrl}`;
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
  const totalSteps = lab.steps?.length || 0;

  const handleKey = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  const currentStep = lab.steps?.[step];

  return (
    <div className="lab-modal-overlay" onClick={onClose}>
      <div className="lab-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lab-modal-topbar">
          <div className="lab-modal-dots">
            <span className="dot-red" onClick={onClose} title="Đóng" />
            <span className="dot-yellow" />
            <span className="dot-green" />
          </div>
          <span className="lab-modal-title-bar">
            <Terminal size={13} style={{ marginRight: 6 }} />
            cisco-lab - {lab.title}
          </span>
          <button className="lab-modal-close" onClick={onClose}>
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
                <div className="lab-topology-img-wrap" style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #30363d' }}>
                  <img src={lab.topologyImgUrl} alt="Topology" style={{ width: '100%', display: 'block' }} />
                </div>
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

            <div className="lab-sidebar-section">
              <div className="lab-sidebar-label">
                <Zap size={13} /> Công cụ
              </div>
              <div className="lab-tool-tags">
                {lab.tools?.map((t) => (
                  <span key={t} className="lab-tool-tag">{t}</span>
                ))}
              </div>
            </div>

            <div className="lab-step-dots">
              {lab.steps?.map((_, i) => (
                <button
                  key={i}
                  className={`lab-step-dot ${i === step ? "active" : i < step ? "done" : ""}`}
                  onClick={() => setStep(i)}
                  title={`Bước ${i + 1}`}
                />
              ))}
            </div>

            <div
              className="lab-sidebar-section"
              style={{
                background: "rgba(37,99,235,0.1)",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid rgba(37,99,235,0.3)",
                marginTop: "auto",
                marginBottom: "10px"
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#58a6ff", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" }}>
                <Check size={12} /> CHẤM ĐIỂM TỰ ĐỘNG
              </div>
              <p style={{ fontSize: "0.7rem", color: "#8b949e", margin: "4px 0 0 0", lineHeight: 1.5 }}>
                Guest chỉ được xem thông tin hướng dẫn. Đăng nhập để tải file và thực hành lab.
              </p>
            </div>

            {isGuestView ? (
              <button type="button" className="lab-download-btn" onClick={onGuestBlocked}>
                <Download size={14} /> Tải file bài tập (.pka)
              </button>
            ) : (
              <a href={getLabFileUrl(lab.fileUrl)} className="lab-download-btn" download>
                <Download size={14} /> Tải file bài tập (.pka)
              </a>
            )}
          </div>

          <div className="lab-modal-terminal">
            <div className="lab-step-header">
              <span className="lab-step-badge">Bước {step + 1}/{totalSteps}</span>
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <div style={{ fontSize: "0.7rem", color: "#d29922", paddingBottom: "6px" }}>
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
    </div>
  );
};

const difficultyConfig = {
  EASY: { label: "Dễ", cls: "badge-easy" },
  MEDIUM: { label: "Trung bình", cls: "badge-medium" },
  HARD: { label: "Khó", cls: "badge-hard" },
  Easy: { label: "Dễ", cls: "badge-easy" },
  Medium: { label: "Trung bình", cls: "badge-medium" },
  Hard: { label: "Khó", cls: "badge-hard" }
};

const LabCard = ({ lab, isCompleted, onSelect, isGuestView, onGuestBlocked }) => {
  const diff = difficultyConfig[lab.difficulty] || { label: lab.difficulty, cls: "badge-gray" };

  return (
    <div className="lab-card">
      <div className="lab-card-img-wrap">
        <img src={lab.imageUrl} alt={lab.title} className="lab-card-img" />
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: "8px" }}>
          {isCompleted && (
            <span className="lab-badge badge-easy" style={{ position: "relative", top: 0, right: 0, display: "flex", alignItems: "center", gap: "4px" }}>
              <Check size={10} /> ĐÃ XONG
            </span>
          )}
          <span className={`lab-badge ${diff.cls}`} style={{ position: "relative", top: 0, right: 0 }}>
            {diff.label}
          </span>
        </div>
        <div className="lab-card-overlay" />
      </div>

      <div className="lab-card-body">
        <span className="lab-card-category">{lab.category}</span>
        <h3 className="lab-card-title">{lab.title}</h3>

        <div className="lab-card-meta">
          <span><Clock size={13} /> {lab.duration}</span>
          <span><Terminal size={13} /> {lab.tools?.join(", ")}</span>
        </div>

        <div className="lab-card-actions">
          {isGuestView ? (
            <button type="button" className="lab-btn-outline" onClick={onGuestBlocked}>
              <Download size={14} /> Tải file
            </button>
          ) : (
            <a href={getLabFileUrl(lab.fileUrl)} className="lab-btn-outline" download>
              <Download size={14} /> Tải file
            </a>
          )}

          <button className="lab-btn-primary" onClick={() => onSelect(lab)}>
            <BookOpen size={14} /> Xem hướng dẫn
          </button>
        </div>
      </div>
    </div>
  );
};

const CATEGORIES = ["All", "Switching", "Routing", "Security", "Services", "Automation"];

export const Labs = () => {
  const { isAuthenticated } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const isGuest = !isAuthenticated;

  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLab, setSelectedLab] = useState(null);
  const [completedLabs, setCompletedLabs] = useState([]);

  const { token } = useAuth();

  useEffect(() => {
    api.getLabs(token)
      .then((data) => setLabs(data))
      .catch((err) => console.error("Failed to load labs", err))
      .finally(() => setLoading(false));
  }, [token]);

  const filteredLabs = labs.filter((lab) => {
    const matchCat = filter === "All" || lab.category === filter;
    const matchSearch = lab.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  const notifyGuestBlocked = useCallback(() => {
    showToast("Guest chỉ được xem thông tin lab. Vui lòng đăng nhập để thực hành.", "info");
  }, [showToast]);

  return (
    <div className="labs-page">
      {ToastComponent}

      <div className="labs-header">
        <div className="labs-header-text">
          <h1 className="labs-main-title">Phòng Lab Thực Hành</h1>
          <p className="labs-main-desc">Kho bài lab chuẩn Cisco - topology, CLI step-by-step, file Packet Tracer.</p>
        </div>

        <div className="labs-search-wrap">
          <Search size={16} className="labs-search-icon" />
          <input
            type="text"
            className="labs-search-input"
            placeholder="Tìm kiếm bài lab..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-bar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`filter-btn ${filter === cat ? "active" : ""}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="labs-loading">
          <Loader2 className="labs-spinner" size={32} />
          <p>Đang tải danh sách lab...</p>
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
              isCompleted={completedLabs.includes(lab.id)}
              onSelect={setSelectedLab}
              isGuestView={isGuest}
              onGuestBlocked={notifyGuestBlocked}
            />
          ))}
        </div>
      )}

      {selectedLab && (
        <LabGuideModal
          lab={selectedLab}
          onClose={() => setSelectedLab(null)}
          onComplete={(id) => {
            if (!completedLabs.includes(id)) {
              setCompletedLabs((prev) => [...prev, id]);
            }
            setSelectedLab(null);
          }}
          isGuestView={isGuest}
          onGuestBlocked={notifyGuestBlocked}
        />
      )}
    </div>
  );
};

export default Labs;
