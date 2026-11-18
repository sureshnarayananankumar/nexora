import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './stores/auth';
import { applyTheme, useUi } from './stores/ui';
import { refreshSession } from './api/client';
import { PageLoader, Toasts } from './components/ui';
import { AppShell } from './layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectPage = lazy(() => import('./pages/project/ProjectPage'));
const WorkflowsPage = lazy(() => import('./pages/workflows/WorkflowsPage'));
const WorkflowBuilderPage = lazy(() => import('./pages/workflows/WorkflowBuilderPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

export function App() {
  const status = useAuth((s) => s.status);
  const theme = useUi((s) => s.theme);

  // Restore the session from the HttpOnly refresh cookie on first load.
  useEffect(() => {
    if (status === 'loading') void refreshSession().then((ok) => !ok && useAuth.getState().clear());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq?.addEventListener('change', onChange);
    return () => mq?.removeEventListener('change', onChange);
  }, [theme]);

  return (
    <>
      <Routes>
        <Route path="/" element={status === 'authenticated' ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/dashboard" element={<Lazy><DashboardPage /></Lazy>} />
          <Route path="/projects" element={<Lazy><ProjectsPage /></Lazy>} />
          <Route path="/projects/:projectId/:tab?" element={<Lazy><ProjectPage /></Lazy>} />
          <Route path="/workflows" element={<Lazy><WorkflowsPage /></Lazy>} />
          <Route path="/workflows/new" element={<Lazy><WorkflowBuilderPage /></Lazy>} />
          <Route path="/workflows/:workflowId" element={<Lazy><WorkflowBuilderPage /></Lazy>} />
          <Route path="/team" element={<Lazy><TeamPage /></Lazy>} />
          <Route path="/calendar" element={<Lazy><CalendarPage /></Lazy>} />
          <Route path="/analytics" element={<Lazy><AnalyticsPage /></Lazy>} />
          <Route path="/notifications" element={<Lazy><NotificationsPage /></Lazy>} />
          <Route path="/settings" element={<Lazy><SettingsPage /></Lazy>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}
