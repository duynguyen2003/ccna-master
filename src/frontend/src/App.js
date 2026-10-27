import React, { lazy, useEffect } from 'react';
// The host serves index.html for application paths; legacy hash links are upgraded at boot.
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import CSS toàn cục
import './App.css';
import './styles/theme.css';
import './components/ui/styles/UiControls.css';

// Import Layout (Chứa Header và Footer)
import Layout from './components/layout/Layout';

import AdminProtectedRoute from './features/admin/components/AdminProtectedRoute';
import RouteContent from './components/routing/RouteContent';
import RouteMetadata from './components/routing/RouteMetadata';
import { routerBasename } from './components/routing/legacyRoutes';
import { ThemeProvider } from './context/ThemeContext';

// Import các Trang nội dung (Content Pages)
import Home from './features/home/pages/Home.js';
import ProtectedRoute from './features/auth/components/ProtectedRoute.js';

// Import global Toast
import Toast from './components/ui/Toast.js';
import { useAuth } from './context/AuthContext.js';

// Keep the landing page eager; other pages load when their route is rendered.
const AdminRoutes = lazy(() => import('./features/admin/AdminRoutes'));
const Roadmap = lazy(() => import('./features/courses/pages/Roadmap'));
const CourseDetail = lazy(() => import('./features/courses/pages/CourseDetail'));
const Lesson = lazy(() => import('./features/lessons/pages/Lesson'));
const LabsView = lazy(() => import('./features/labs/pages/Labs'));
const Exam = lazy(() => import('./features/exams/pages/Exam'));
const Resources = lazy(() => import('./features/resources/pages/Resources'));
const Profile = lazy(() => import('./features/profile/pages/Profile'));
const Login = lazy(() => import('./features/auth/pages/Login'));
const Register = lazy(() => import('./features/auth/pages/Register'));
const ForgotPassword = lazy(() => import('./features/auth/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./features/auth/pages/ResetPassword'));
const SubnetCalculator = lazy(() => import('./features/tools/pages/SubnetCalculator'));
const VLSMCalculator = lazy(() => import('./features/tools/pages/VLSM_Calculator'));
const PortLookup = lazy(() => import('./features/tools/pages/PortLookup'));
const CiscoCliLookup = lazy(() => import('./features/tools/pages/CiscoCliLookup'));

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
  return (
    <ThemeProvider>
      <Router basename={routerBasename}>
        <RouteMetadata />
        <GlobalToastRenderer />
        <Routes>
          {/* =========================================
            ADMIN ROUTES (Isolated Layout)
            ========================================= */}
          <Route
            path="/admin/*"
            element={
              <AdminProtectedRoute>
                <RouteContent>
                  <AdminRoutes />
                </RouteContent>
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
                <RouteContent>
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
                </RouteContent>
              </Layout>
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
