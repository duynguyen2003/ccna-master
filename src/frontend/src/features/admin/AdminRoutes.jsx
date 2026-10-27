import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './layout/AdminLayout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Courses from './pages/Courses';
import Exams from './pages/exams';
import Labs from './pages/Labs';
import CourseDetail from './pages/CourseDetail';
import Tools from './pages/Tools';
import Resources from './pages/Resources';

export default function AdminRoutes() {
  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:courseId" element={<CourseDetail />} />
        <Route path="exams" element={<Exams />} />
        <Route path="labs" element={<Labs />} />
        <Route path="tools" element={<Tools />} />
        <Route path="resources" element={<Resources />} />
      </Routes>
    </AdminLayout>
  );
}
