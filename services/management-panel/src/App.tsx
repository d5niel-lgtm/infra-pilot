import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { apiClient } from './lib/api';
import { getAccessToken, setAccessToken } from './lib/auth';
import { ConfigContext, SetupMode } from './lib/types';
import { Setup } from './pages/Setup';
import { Dashboard } from './pages/Dashboard';
import { AppForm } from './pages/AppForm';
import { AppDetail } from './pages/AppDetail';
import { MainLayout } from './components/MainLayout';
import BrandLogo from '../../branding/BrandLogo';

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<SetupMode>('personal');
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // Check setup status
        const status = await apiClient.getSetupStatus();

        if (!status.initialized) {
          setInitialized(false);
        } else {
          setInitialized(true);
          setMode(status.mode as SetupMode);

          // If we have a token, set it
          const token = getAccessToken();
          if (token) {
            apiClient.setToken(token);
            setAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('Failed to check setup status:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <BrandLogo size={64} />
          <p className="text-slate-600 dark:text-slate-300 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={{ mode, loading: false }}>
      <BrowserRouter>
        <Routes>
          {!initialized ? (
            <Route path="*" element={<Setup />} />
          ) : !authenticated ? (
            <Route path="*" element={<Navigate to="/setup" replace />} />
          ) : (
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/apps/new" element={<AppForm />} />
              <Route path="/apps/:appId" element={<AppDetail />} />
              <Route path="/apps/:appId/edit" element={<AppForm />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          )}
        </Routes>
      </BrowserRouter>
      <Toaster />
    </ConfigContext.Provider>
  );
}
