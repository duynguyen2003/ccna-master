import React, { useEffect } from 'react';
// Sử dụng HashRouter để dễ dàng chạy demo mà không cần cấu hình server
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import CSS toàn cục
import './App.css';
// Import các CSS trang chi tiết
import './css/Navbar.css';
import './css/TopHeader.css';
import './css/Home.css';
import './css/Roadmap.css';
import './css/Lesson.css';
import './css/Labs.css';
import './css/Exam.css';
import './css/ExamFlow.css'; // Phân hệ Kiểm tra & Đánh giá
import './css/Doc.css';
import './css/Profile.css';
import './css/Footer.css';
import './css/Auth/Auth.css'; // CSS cho trang Đăng ký / Đăng nhập
import './css/CourseDetail.css'; // CSS cho trang Chi tiết Khóa học
import './css/Tools/SubnetCalculator.css'; // CSS cho trang Subnet Calculator
import './css/Tools/VLSM_Calculator.css'; // CSS cho trang VLSM Calculator
import './css/Tools/PortLookup.css'; // CSS cho trang Port Lookup
import './css/Tools/CiscoCliLookup.css'; // CSS cho trang Cisco CLI Lookup

// Import Layout (Chứa Header và Footer)
import Layout from './components/Content/Layout';

// Import Admin Layout & Pages
import AdminLayout from './components/Admin/Layout/AdminLayout';
import AdminProtectedRoute from './components/Admin/AdminProtectedRoute';
import Dashboard from './components/Admin/Views/Dashboard';
import Users from './components/Admin/Views/Users';
import Courses from './components/Admin/Views/Courses';
import Exams from './components/Admin/Views/Exams';
import Labs from './components/Admin/Views/Labs';
import AdminCourseDetail from './components/Admin/Views/CourseDetail';
import AdminTools from './components/Admin/Views/Tools';
import AdminResources from './components/Admin/Views/Resources';

// Import các Trang nội dung (Content Pages)
import Home from './components/Content/Home.js';
import Roadmap from './components/Content/Roadmap.js';
import Lesson from './components/Content/Lesson.js';
import LabsView from './components/Content/Labs.js';
import Exam from './components/Content/Exam.js';
import Resources from './components/Content/Doc.js';
import Profile from './components/Content/Profile.js';
import CourseDetail from './components/Content/CourseDetail.js';

// Import Auth Pages
import Login from './components/Auth/Login.js';
import ForgotPassword from './components/Auth/ForgotPassword.js';
import Register from './components/Auth/Register.js';
import ResetPassword from './components/Auth/ResetPassword.js';
import ProtectedRoute from './components/Auth/ProtectedRoute.js';

// Import global Toast
import Toast from './components/Toast.js';
import { useAuth } from './context/AuthContext.js';

// Import Tools Pages
import SubnetCalculator from './components/Tools/SubnetCalculator.js';
import VLSMCalculator from './components/Tools/VLSM_Calculator.js';
import PortLookup from './components/Tools/PortLookup.js';
import CiscoCliLookup from './components/Tools/CiscoCliLookup.js';

function GlobalToastRenderer() {
  const { pendingToast, setPendingToast } = useAuth();
  const [systemToast, setSystemToast] = React.useState(null);

  useEffect(() => {
    if (pendingToast) {
      // Clear it after showing (the Toast component handles its own lifecycle)
      const timer = setTimeout(() => setPendingToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [pendingToast, setPendingToast]);

  useEffect(() => {
    const handleOffline = () => setSystemToast({ type: 'error', message: 'Mất kết nối mạng. Ứng dụng có thể không hoạt động chính xác.' });
    const handleOnline = () => setSystemToast({ type: 'success', message: 'Đã khôi phục kết nối mạng.' });
    const handleApiError = (e) => setSystemToast({ type: 'error', message: e.detail || 'Lỗi máy chủ.' });

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('api_error', handleApiError);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('api_error', handleApiError);
    };
  }, []);

  const currentToast = pendingToast || systemToast;

  if (!currentToast) return null;

  return (
    <Toast
      key={currentToast.message + Date.now()}
      message={currentToast.message}
      type={currentToast.type || 'success'}
      duration={3500}
      onClose={() => {
        if (pendingToast) setPendingToast(null);
        if (systemToast) setSystemToast(null);
      }}
    />
  );
}


function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        flexDirection: 'column',
        gap: '1rem',
        color: '#64748b',
        fontFamily: 'sans-serif'
      }}>
        <div className="acm-spin" style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid #e2e8f0', 
          borderTopColor: '#2563eb', 
          borderRadius: '50%' 
        }}></div>
        <p>Đang chuẩn bị dữ liệu...</p>
      </div>
    );
  }

  return (
    <Router>
      <GlobalToastRenderer />
      <Routes>
        {/* =========================================
            ADMIN ROUTES (Isolated Layout)
            ========================================= */}
        <Route path="/admin/*" element={
          <AdminProtectedRoute>
            <AdminLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="users" element={<Users />} />
                <Route path="courses" element={<Courses />} />
                <Route path="courses/:courseId" element={<AdminCourseDetail />} />
                <Route path="exams" element={<Exams />} />
                <Route path="labs" element={<Labs />} />
                <Route path="tools" element={<AdminTools />} />
                <Route path="resources" element={<AdminResources />} />
              </Routes>
            </AdminLayout>
          </AdminProtectedRoute>
        } />



        {/* =========================================
            USER/STUDENT ROUTES (With Layout)
            ========================================= */}
        <Route path="*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />

              {/* AUTH AS MODALS */}
              <Route path="/login" element={<><Home /><Login /></>} />
              <Route path="/register" element={<><Home /><Register /></>} />
              <Route path="/forgot-password" element={<><Home /><ForgotPassword /></>} />
              <Route path="/reset-password/:token" element={<><Home /><ResetPassword /></>} />

              {/* Trang bảo vệ */}
              <Route path="/roadmap" element={<Roadmap />} />
              <Route path="/course/:courseId" element={<CourseDetail />} />
              <Route path="/lesson" element={<Lesson />} />
              <Route path="/labs" element={<LabsView />} />
              <Route path="/exam/*" element={<Exam />} />
              <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/tools/subnet" element={<ProtectedRoute><SubnetCalculator /></ProtectedRoute>} />
              <Route path="/tools/vlsm" element={<ProtectedRoute><VLSMCalculator /></ProtectedRoute>} />
              <Route path="/tools/ports" element={<ProtectedRoute><PortLookup /></ProtectedRoute>} />
              <Route path="/tools/cli" element={<ProtectedRoute><CiscoCliLookup /></ProtectedRoute>} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;
