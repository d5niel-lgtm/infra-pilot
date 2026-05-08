import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { DockerApp, useConfig } from '../lib/types';
import { toast } from 'sonner';
import { MetricCard } from '../components/MetricCard';
import { SystemOverview } from '../components/SystemOverview';
import { ResourceDistribution } from '../components/ResourceDistribution';
import { LiveLogs } from '../components/LiveLogs';
import { AppCard } from '../components/AppCard';

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

  const runningApps = apps.filter((a) => a.status === 'running').length;
  const stoppedApps = apps.filter((a) => a.status === 'stopped').length;
  const errorApps = apps.filter((a) => a.status === 'error').length;
  const uptime = 99.98;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-400">Overview of your infrastructure and applications</p>
        </div>
        <button
          onClick={handleCreateApp}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>Create New App</span>
        </button>
      </div>

      {/* Key Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Key Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <MetricCard
            icon="📊"
            label="Total Apps"
            value={apps.length}
            change={{ value: 12, type: 'up', timeframe: 'last 7d' }}
            accentColor="blue"
          />
          <MetricCard
            icon="▶️"
            label="Running Containers"
            value={runningApps}
            change={{ value: 8, type: 'up', timeframe: 'last 7d' }}
            accentColor="green"
          />
          <MetricCard
            icon="⏹️"
            label="Stopped Containers"
            value={stoppedApps}
            change={{ value: 4, type: 'down', timeframe: 'last 7d' }}
            accentColor="red"
          />
          <MetricCard
            icon="⚠️"
            label="Errors"
            value={errorApps}
            change={{ value: 50, type: 'down', timeframe: 'last 7d' }}
            accentColor="orange"
          />
          <MetricCard
            icon="✓"
            label="Uptime"
            value={`${uptime}%`}
            change={{ value: 0.01, type: 'neutral', timeframe: 'last 7d' }}
            accentColor="cyan"
          />
          <MetricCard
            icon="👥"
            label="Active Customers"
            value={128}
            change={{ value: 15, type: 'up', timeframe: 'last 7d' }}
            accentColor="purple"
          />
        </div>
      </div>

      {/* Applications Section */}
      {!loading && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Applications</h2>
            <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View all
            </button>
          </div>

          {apps.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
              <p className="text-slate-400 mb-4">No applications yet</p>
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
                <AppCard
                  key={app.id}
                  id={app.id}
                  name={app.name}
                  image={app.image}
                  status={app.status}
                  cpu={Math.floor(Math.random() * 50) + 5}
                  memory={Math.floor(Math.random() * 512) + 128}
                  uptime="3d 14h"
                  ports={app.ports}
                  onClick={() => navigate(`/apps/${app.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* System Overview and Resource Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <SystemOverview />
        </div>
        <div>
          <ResourceDistribution />
        </div>
      </div>

      {/* Live Logs */}
      <LiveLogs />
    </div>
  );
};
