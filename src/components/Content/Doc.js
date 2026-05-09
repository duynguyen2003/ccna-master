import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import api, { API_URL } from "../../services/Api";
import { 
  FileText, 
  Download, 
  Search, 
  Pin, 
  Video, 
  Monitor, 
  Cpu,
  Sparkles,
  Loader
} from "lucide-react";
export const Resources = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Tất cả");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { token } = useAuth();

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter]);
  useEffect(() => {
    const fetchResources = async () => {
      try {
        const res = await api.getResources(token);
        if (res && res.data) {
          setResources(res.data);
        }
      } catch (error) {
        console.error("Error fetching resources:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchResources();
  }, [token]);

  const getFileUrl = (item) => {
    if (!item || !item.id) return "#";
    // File lưu local: dùng backend proxy download để đặt tên đúng
    return `${API_URL}/learning/resources/${item.id}/download?token=${token}`;
  };

  // Hàm lấy Icon tương ứng với loại tài liệu
  const getIcon = (type) => {
    const t = type.toLowerCase();
    if (t.includes("pdf")) return <FileText color="#ef4444" size={20} />;
    if (t.includes("packet") || t.includes("pkt") || t.includes("lab")) return <Cpu color="#3b82f6" size={20} />;
    if (t.includes("slide") || t.includes("ppt")) return <Monitor color="#f59e0b" size={20} />;
    if (t.includes("video") || t.includes("mp4")) return <Video color="#10b981" size={20} />;
    return <FileText color="#6b7280" size={20} />;
  };

  // Hàm định dạng ngày tháng
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hôm nay";
    if (diffDays === 1) return "Hôm qua";
    if (diffDays < 30) return `${diffDays} ngày trước`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} tháng trước`;
  };

  // Lọc dữ liệu
  const filteredResources = resources.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === "Tất cả") return matchesSearch;
    if (activeFilter === "PDF") return matchesSearch && item.type.toLowerCase().includes("pdf");
    if (activeFilter === "Packet Tracer") return matchesSearch && (item.type.toLowerCase().includes("packet") || item.type.toLowerCase().includes("pkt"));
    if (activeFilter === "Slides") return matchesSearch && (item.type.toLowerCase().includes("slide") || item.type.toLowerCase().includes("ppt"));
    if (activeFilter === "Video") return matchesSearch && (item.type.toLowerCase().includes("video") || item.type.toLowerCase().includes("mp4"));
    
    return matchesSearch;
  });

  // Phân trang
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredResources.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredResources.length / itemsPerPage);

  // Lấy 2 tài liệu ghim (giả định là 2 tài liệu đầu tiên)
  const pinnedResources = filteredResources.slice(0, 2);

  if (loading) {
    return (
      <div className="doc-loading">
        <Loader className="spinner" size={40} />
        <p>Đang tải tài liệu...</p>
      </div>
    );
  }

  return (
    <div className="doc-container">
      {/* Header */}
      <div className="doc-header">
        <h1>Thư viện Tinh gọn</h1>
        <p>Tài nguyên học tập CCNA chọn lọc và tối giản.</p>
      </div>

      {/* Search & Filters */}
      <div className="doc-controls">
        <div className="doc-search-wrapper">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Tìm kiếm tài liệu..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="doc-filters">
          {["Tất cả", "PDF", "Packet Tracer", "Slides", "Video"].map((filter) => (
            <button 
              key={filter}
              className={`filter-btn ${activeFilter === filter ? "active" : ""}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Pinned Section */}
      {pinnedResources.length > 0 && activeFilter === "Tất cả" && (
        <div className="doc-section">
          <h3 className="section-title">
            <Pin size={16} className="pin-icon" /> TÀI LIỆU GHIM
          </h3>
          <div className="pinned-grid">
            {pinnedResources.map((item) => (
              <div className="pinned-card" key={`pinned-${item.id}`}>
                <div className="pinned-info">
                  <Sparkles size={18} color="#3b82f6" className="sparkle-icon" />
                  <span className="pinned-name">{item.title}</span>
                </div>
                <div className="pinned-actions">
                  <span className="pinned-size">{item.size || "Unknown"}</span>
                  <a href={getFileUrl(item)} target="_blank" rel="noreferrer" className="download-btn-icon">
                    <Download size={16} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Resources List */}
      <div className="doc-section">
        <div className="section-header-row">
          <h3 className="section-title">TẤT CẢ TÀI LIỆU</h3>
          <span className="item-count">Hiển thị {filteredResources.length} tài liệu</span>
        </div>

        <div className="doc-list-container">
          <div className="list-header">
            <div className="col-name">TÊN TÀI LIỆU</div>
            <div className="col-size">DUNG LƯỢNG</div>
          </div>

          {filteredResources.length === 0 ? (
            <div className="empty-state">Không tìm thấy tài liệu nào.</div>
          ) : (
            <div className="list-body">
              {currentItems.map((item) => (
                <div className="list-row" key={item.id}>
                  <div className="col-name cell-flex">
                    <div className="type-icon-wrapper">
                      {getIcon(item.type)}
                    </div>
                    <div className="item-details">
                      <span className="item-title">{item.title}</span>
                      <span className="item-meta">
                        {item.type} • {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="col-size cell-flex-end">
                    <span className="item-size">{item.size || "N/A"}</span>
                    <a href={getFileUrl(item)} target="_blank" rel="noreferrer" className="row-download-btn">
                      <Download size={18} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="doc-pagination">
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="pagination-btn"
            >
              Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`pagination-btn ${currentPage === page ? "active" : ""}`}
              >
                {page}
              </button>
            ))}
            <button 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="pagination-btn"
            >
              Sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Resources;
