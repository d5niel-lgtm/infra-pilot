import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { DockerApp } from '../../lib/types';
import { useConfig } from '../../lib/types';
import { toast } from 'sonner';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { mode } = useConfig();
  const [apps, setApps] = useState<DockerApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [appsData, userData] = await Promise.all([
        apiClient.listApps(),
        apiClient.getUser(),
      ]);
      setApps(appsData);
      setUser(userData);
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApp = () => {
    navigate('/apps/new');
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'stopped':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      case 'restarting':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
          Dashboard
        </h1>
        <p className="text-slate-600 dark:text-slate-300">
          {user && `Welcome back, ${user.display_name}`}
          <span className="ml-4 inline-block px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
            {mode === 'personal' ? '🏠 Personal Mode' : '🚀 Business Mode'}
          </span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Apps</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{apps.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Running</p>
          <p className="text-3xl font-bold text-green-600">
            {apps.filter((a) => a.status === 'running').length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Stopped</p>
          <p className="text-3xl font-bold text-gray-600">
            {apps.filter((a) => a.status === 'stopped').length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Errors</p>
          <p className="text-3xl font-bold text-red-600">
            {apps.filter((a) => a.status === 'error').length}
          </p>
        </div>
      </div>

      {/* Apps Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Your Apps</h2>
          <button
            onClick={handleCreateApp}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            + New App
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-300">Loading...</p>
          </div>
        ) : apps.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
            <p className="text-slate-600 dark:text-slate-300 mb-4">No apps yet</p>
            <button
              onClick={handleCreateApp}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors inline-block"
            >
              Create Your First App
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => (
              <div
                key={app.id}
                onClick={() => navigate(`/apps/${app.id}`)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{app.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {app.image}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                      app.status
                    )}`}
                  >
                    {app.status}
                  </span>
                </div>

                {app.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{app.description}</p>
                )}

                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <p>Created: {new Date(app.created_at).toLocaleDateString()}</p>
                  {app.started_at && (
                    <p>Started: {new Date(app.started_at).toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
