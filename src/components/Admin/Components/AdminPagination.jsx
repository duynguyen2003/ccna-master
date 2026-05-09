import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const AdminPagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  totalItems,
  pageSize 
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          className={`admin-pagination-btn ${currentPage === i ? 'active' : ''}`}
          onClick={() => onPageChange(i)}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <div className="admin-pagination-container">
      <div className="admin-pagination-info">
        Hiển thị <strong>{startItem}-{endItem}</strong> trong tổng số <strong>{totalItems}</strong> mục
      </div>
      
      <div className="admin-pagination-controls">
        <button 
          className="admin-pagination-arrow" 
          onClick={() => onPageChange(1)} 
          disabled={currentPage === 1}
          title="Trang đầu"
        >
          <ChevronsLeft size={16} />
        </button>
        
        <button 
          className="admin-pagination-arrow" 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1}
          title="Trang trước"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="admin-pagination-pages">
          {renderPageNumbers()}
        </div>

        <button 
          className="admin-pagination-arrow" 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage === totalPages || totalPages === 0}
          title="Trang sau"
        >
          <ChevronRight size={16} />
        </button>

        <button 
          className="admin-pagination-arrow" 
          onClick={() => onPageChange(totalPages)} 
          disabled={currentPage === totalPages || totalPages === 0}
          title="Trang cuối"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default AdminPagination;
