import React, { useEffect } from 'react';
// Sử dụng HashRouter để dễ dàng chạy demo mà không cần cấu hình server
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import CSS toàn cục
import './App.css';
import './components/ui/styles/UiControls.css';
// Import các CSS trang chi tiết
import './components/layout/styles/Navbar.css';
import './components/layout/styles/TopHeader.css';
import './features/home/styles/Home.css';
import './features/courses/styles/Roadmap.css';
import './features/lessons/styles/Lesson.css';
import './features/labs/styles/Labs.css';
import './features/exams/styles/Exam.css';
import './features/exams/styles/ExamFlow.css'; // Phân hệ Kiểm tra & Đánh giá
import './features/resources/styles/Resources.css';
import './features/profile/styles/Profile.css';
import './components/layout/styles/Footer.css';
import './features/auth/styles/Auth.css'; // CSS cho trang Đăng ký / Đăng nhập
import './features/courses/styles/CourseDetail.css'; // CSS cho trang Chi tiết Khóa học
import './features/tools/styles/SubnetCalculator.css'; // CSS cho trang Subnet Calculator
import './features/tools/styles/VLSM_Calculator.css'; // CSS cho trang VLSM Calculator
import './features/tools/styles/PortLookup.css'; // CSS cho trang Port Lookup
import './features/tools/styles/CiscoCliLookup.css'; // CSS cho trang Cisco CLI Lookup

// Import Layout (Chứa Header và Footer)
import Layout from './components/layout/Layout';

// Import Admin Layout & Pages
import AdminLayout from './features/admin/layout/AdminLayout';
import AdminProtectedRoute from './features/admin/components/AdminProtectedRoute';
import Dashboard from './features/admin/pages/Dashboard';
import Users from './features/admin/pages/Users';
import Courses from './features/admin/pages/Courses';
import Exams from './features/admin/pages/exams';
import Labs from './features/admin/pages/Labs';
import AdminCourseDetail from './features/admin/pages/CourseDetail';
import AdminTools from './features/admin/pages/Tools';
import AdminResources from './features/admin/pages/Resources';

// Import các Trang nội dung (Content Pages)
import Home from './features/home/pages/Home.js';
import Roadmap from './features/courses/pages/Roadmap.js';
import Lesson from './features/lessons/pages/Lesson.js';
import LabsView from './features/labs/pages/Labs.js';
import Exam from './features/exams/pages/Exam.js';
import Resources from './features/resources/pages/Resources.js';
import Profile from './features/profile/pages/Profile.js';
import CourseDetail from './features/courses/pages/CourseDetail.js';

// Import Auth Pages
import Login from './features/auth/pages/Login.js';
import ForgotPassword from './features/auth/pages/ForgotPassword.js';
import Register from './features/auth/pages/Register.js';
import ResetPassword from './features/auth/pages/ResetPassword.js';
import ProtectedRoute from './features/auth/components/ProtectedRoute.js';

// Import global Toast
import Toast from './components/ui/Toast.js';
import { useAuth } from './context/AuthContext.js';
import HeartbeatLoader from './components/ui/HeartbeatLoader';

// Import Tools Pages
import SubnetCalculator from './features/tools/pages/SubnetCalculator.js';
import VLSMCalculator from './features/tools/pages/VLSM_Calculator.js';
import PortLookup from './features/tools/pages/PortLookup.js';
import CiscoCliLookup from './features/tools/pages/CiscoCliLookup.js';

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
    const handleOffline = () =>
      setSystemToast({
        type: 'error',
        message: 'Mất kết nối mạng. Ứng dụng có thể không hoạt động chính xác.',
      });
    const handleOnline = () =>
      setSystemToast({ type: 'success', message: 'Đã khôi phục kết nối mạng.' });
    const handleApiError = (e) =>
      setSystemToast({ type: 'error', message: e.detail || 'Lỗi máy chủ.' });

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
    return <HeartbeatLoader fullScreen label="Đang chuẩn bị dữ liệu..." />;
  }

  return (
    <Router>
      <GlobalToastRenderer />
      <Routes>
        {/* =========================================
            ADMIN ROUTES (Isolated Layout)
            ========================================= */}
        <Route
          path="/admin/*"
          element={
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
          }
        />

        {/* =========================================
            USER/STUDENT ROUTES (With Layout)
            ========================================= */}
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />

                {/* AUTH AS MODALS */}
                <Route
                  path="/login"
                  element={
                    <>
                      <Home />
                      <Login />
                    </>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <>
                      <Home />
                      <Register />
                    </>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <>
                      <Home />
                      <ForgotPassword />
                    </>
                  }
                />
                <Route
                  path="/reset-password/:token"
                  element={
                    <>
                      <Home />
                      <ResetPassword />
                    </>
                  }
                />

                {/* Trang bảo vệ */}
                <Route path="/roadmap" element={<Roadmap />} />
                <Route path="/course/:courseId" element={<CourseDetail />} />
                <Route path="/lesson" element={<Lesson />} />
                <Route path="/labs" element={<LabsView />} />
                <Route path="/exam/*" element={<Exam />} />
                <Route
                  path="/resources"
                  element={
                    <ProtectedRoute>
                      <Resources />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tools/subnet"
                  element={
                    <ProtectedRoute>
                      <SubnetCalculator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tools/vlsm"
                  element={
                    <ProtectedRoute>
                      <VLSMCalculator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tools/ports"
                  element={
                    <ProtectedRoute>
                      <PortLookup />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tools/cli"
                  element={
                    <ProtectedRoute>
                      <CiscoCliLookup />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
