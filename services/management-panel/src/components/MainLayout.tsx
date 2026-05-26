import { Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { clearAccessToken } from '../lib/auth';
import { useConfig } from '../lib/types';
import { Sidebar } from './Sidebar';
import DemoFlagBadge from './DemoFlagBadge';

export const MainLayout = () => {
  const navigate = useNavigate();
  const { mode } = useConfig();
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="flex min-h-screen bg-slate-950 dark:bg-slate-950">
      {/* Sidebar */}
      <Sidebar isMobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-slate-900 dark:bg-slate-900 border-b border-slate-800">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between gap-6">
              {/* Organization Selector & Search */}
              <div className="flex items-center gap-4 flex-1">
                <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" aria-label="Open sidebar">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer">
                  <span className="text-sm text-white">Acme Corp / Production</span>
                  <span className="text-slate-400">▼</span>
                </div>
                <div className="flex-1 max-w-md">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg focus-within:ring-1 focus-within:ring-blue-500">
                    <span className="text-slate-400">🔍</span>
                    <input
                      type="text"
                      placeholder="Search apps, containers, logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 outline-none"
                    />
                    <span className="text-xs text-slate-500">⌘K</span>
                  </div>
                </div>
              </div>

              {/* Right Section */}
              <div className="flex items-center gap-4">
                {/* Notifications */}
                <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors relative">
                  <span className="text-lg">🔔</span>
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                </button>

                {/* System Status */}
                <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                  <span className="text-lg">📊</span>
                </button>

                {/* Settings */}
                <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                  <span className="text-lg">⚙️</span>
                </button>

                {/* User Profile */}
                {user && (
                  <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{user.display_name || 'John Doe'}</p>
                      <p className="text-xs text-slate-400">{user.role || 'Admin'}</p>
                    </div>
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {(user.display_name || 'JD')
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="ml-2 p-1 hover:bg-slate-800 rounded transition-colors"
                      title="Logout"
                    >
                      <span className="text-sm text-slate-400 hover:text-white">✕</span>
                    </button>
                  </div>
                )}

                <DemoFlagBadge />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
