import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Import các màn hình trong phân hệ Kiểm tra & Đánh giá
import TestingCenter from './exam/TestingCenter';
import TakeExam from './exam/TakeExam';
import ExamResult from './exam/ExamResult';
import ReviewExam from './exam/ReviewExam';

/**
 * Exam.js
 * Quản lý định tuyến (Routing) cho toàn bộ phân hệ "Kiểm tra & Đánh giá"
 *
 * Mặc định endpoint sẽ là /exam/*
 */
const Exam = () => {
   return (
      <Routes>
         {/* Chuyển hướng mặc định khi truy cập /exam */}
         <Route path="/" element={<Navigate to="testing-center" replace />} />

         {/* Màn hình 1: Trung tâm Kiểm tra & Đánh giá */}
         <Route path="testing-center" element={<TestingCenter />} />

         {/* Màn hình 2: Làm bài thi (Focus Mode) */}
         <Route path="take/:examId" element={<TakeExam />} />

         {/* Màn hình 3: Kết quả thi */}
         <Route path="result/:resultId" element={<ExamResult />} />

         {/* Màn hình 4: Xem lại & chữa bài */}
         <Route path="review/:examId" element={<ReviewExam />} />
      </Routes>
   );
};

export default Exam;