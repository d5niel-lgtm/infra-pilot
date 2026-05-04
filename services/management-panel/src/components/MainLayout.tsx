import { Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';
import { clearAccessToken } from '../../lib/auth';
import BrandLogo from '../../../../branding/BrandLogo';
import { featureGates } from '../lib/types';
import { useConfig } from '../lib/types';
import DemoFlagBadge from './DemoFlagBadge';

export const MainLayout = () => {
  const navigate = useNavigate();
  const { mode } = useConfig();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await apiClient.getUser();
        setUser(userData);
      } catch (error) {
        console.error('Failed to load user');
      }
    };
    loadUser();
  }, []);

  const handleLogout = () => {
    clearAccessToken();
    apiClient.clearToken();
    navigate('/setup');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
              <BrandLogo size={40} />
              <span className="text-xl font-semibold text-slate-900 dark:text-white">Docker Panel</span>
            </div>
              <div className="flex items-center gap-6">
                {user && (
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {user.display_name || user.email}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Logout
                    </button>
                    <DemoFlagBadge />
                  </div>
                )}
              </div>
          </div>
        </div>
      </header>

      {/* Main Navigation */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-16 z-9">
        <div className="max-w-7xl mx-auto px-8">
          <nav className="flex gap-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="py-3 px-2 border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 font-medium"
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/apps/new')}
              className="py-3 px-2 border-b-2 border-transparent text-slate-600 dark:text-slate-400 hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
            >
              New App
            </button>
            {featureGates.canManageCustomers(mode) && (
              <button
                onClick={() => navigate('/customers')}
                className="py-3 px-2 border-b-2 border-transparent text-slate-600 dark:text-slate-400 hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
              >
                Customers
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};
