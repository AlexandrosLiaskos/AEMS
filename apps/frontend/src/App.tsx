import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Layout components
import { AppLayout } from './components/layout/app-layout';
import { AuthLayout } from './components/layout/auth-layout';
import { LoadingSpinner } from './components/ui/loading-spinner';

// Auth components
import { ProtectedRoute } from './components/auth/protected-route';
import { PublicRoute } from './components/auth/public-route';

// Lazy load pages for better performance
const LoginPage = lazy(() => import('./pages/auth/login-page'));
const SetupPage = lazy(() => import('./pages/setup-page'));
const DashboardPage = lazy(() => import('./pages/dashboard/dashboard-page'));
const EmailsPage = lazy(() => import('./pages/emails/emails-page'));
const EmailDetailPage = lazy(() => import('./pages/emails/email-detail-page'));
const ClassificationsPage = lazy(() => import('./pages/classifications/classifications-page'));
const ExtractionsPage = lazy(() => import('./pages/extractions/extractions-page'));
const NotificationsPage = lazy(() => import('./pages/notifications/notifications-page'));
const SettingsPage = lazy(() => import('./pages/settings/settings-page'));
const ProfilePage = lazy(() => import('./pages/profile/profile-page'));
const NotFoundPage = lazy(() => import('./pages/error/not-found-page'));

/**
 * @component App
 * @purpose Main application component with routing
 */
function App() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <AuthLayout>
                  <LoginPage />
                </AuthLayout>
              </PublicRoute>
            }
          />

          <Route
            path="/setup"
            element={
              <PublicRoute>
                <AuthLayout>
                  <SetupPage />
                </AuthLayout>
              </PublicRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Emails */}
            <Route path="emails" element={<EmailsPage />} />
            <Route path="emails/:id" element={<EmailDetailPage />} />

            {/* AI Processing */}
            <Route path="classifications" element={<ClassificationsPage />} />
            <Route path="extractions" element={<ExtractionsPage />} />

            {/* Notifications */}
            <Route path="notifications" element={<NotificationsPage />} />

            {/* User */}
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* 404 page */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
