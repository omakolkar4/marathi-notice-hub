import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { NoticeApprovalPage } from './pages/admin/NoticeApprovalPage';
import { AdminNoticeCreate } from './pages/admin/AdminNoticeCreate';
import { FacultyManagement } from './pages/admin/FacultyManagement';
import { DepartmentManagement } from './pages/admin/DepartmentManagement';
import { DistributionReports } from './pages/admin/DistributionReports';
import { ExaminationManagement } from './pages/admin/ExaminationManagement';
import { AdminManagement } from './pages/admin/AdminManagement';
import { ProfileSettings } from './pages/common/ProfileSettings';

// Faculty Pages
import { FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { RelevantNotices } from './pages/faculty/RelevantNotices';
import { FacultyNoticeCreate } from './pages/faculty/FacultyNoticeCreate';
import { MySubmissions } from './pages/faculty/MySubmissions';
import { ExaminationDuties } from './pages/faculty/ExaminationDuties';

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return user.role === 'Admin' ? (
    <Navigate to="/admin" replace />
  ) : (
    <Navigate to="/faculty" replace />
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Root Redirect based on role */}
          <Route path="/" element={<RootRedirect />} />

          {/* Admin Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/approvals" element={<NoticeApprovalPage />} />
              <Route path="/admin/create-notice" element={<AdminNoticeCreate />} />
              <Route path="/admin/faculty" element={<FacultyManagement />} />
              <Route path="/admin/admins" element={<AdminManagement />} />
              <Route path="/admin/departments" element={<DepartmentManagement />} />
              <Route path="/admin/reports" element={<DistributionReports />} />
              <Route path="/admin/examinations" element={<ExaminationManagement />} />
              <Route path="/admin/settings" element={<ProfileSettings />} />
            </Route>
          </Route>

          {/* Faculty Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['Faculty']} />}>
            <Route element={<AppLayout />}>
              <Route path="/faculty" element={<FacultyDashboard />} />
              <Route path="/faculty/notices" element={<RelevantNotices />} />
              <Route path="/faculty/exam-duties" element={<ExaminationDuties />} />
              <Route path="/faculty/create-notice" element={<FacultyNoticeCreate />} />
              <Route path="/faculty/my-submissions" element={<MySubmissions />} />
              <Route path="/faculty/settings" element={<ProfileSettings />} />
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
