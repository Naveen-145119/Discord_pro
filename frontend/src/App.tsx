import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

import { MainLayout } from '@/components/layout/MainLayout';

import { CallProvider } from '@/providers/CallProvider';
import { RealtimeProvider } from '@/providers/RealtimeProvider';

import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { HomePage } from '@/pages/HomePage';
import { ServerPage } from '@/pages/ServerPage';
import { DMPage } from '@/pages/DMPage';

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background-tertiary">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-discord-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-text-muted text-sm">Loading Discord...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { checkSession, isLoading } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthRoute>
              <LoginPage />
            </AuthRoute>
          }
        />
        <Route
          path="/register"
          element={
            <AuthRoute>
              <RegisterPage />
            </AuthRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RealtimeProvider>
                <CallProvider>
                  <MainLayout />
                </CallProvider>
              </RealtimeProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="dm/:channelId" element={<DMPage />} />
          <Route path="servers/:serverId/*" element={<ServerPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
