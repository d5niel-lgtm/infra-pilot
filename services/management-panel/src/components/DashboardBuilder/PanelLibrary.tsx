import { BarChart3, Activity, Bell, Database, AppWindow } from 'lucide-react';
import type { PanelType, PanelDataSource } from '../../lib/types';

interface PanelTemplate {
  type: PanelType;
  title: string;
  description: string;
  icon: React.ReactNode;
  defaultDataSource: PanelDataSource;
}

const templates: PanelTemplate[] = [
  {
    type: 'time-series',
    title: 'Time Series',
    description: 'CPU, memory, TPS over time',
    icon: <BarChart3 className="w-5 h-5" />,
    defaultDataSource: { type: 'metrics', aggregation: 'avg', period: '1h' },
  },
  {
    type: 'stat',
    title: 'Stat',
    description: 'Single metric value',
    icon: <Activity className="w-5 h-5" />,
    defaultDataSource: { type: 'metrics', aggregation: 'latest' },
  },
  {
    type: 'log-list',
    title: 'Log List',
    description: 'Recent application logs',
    icon: <Database className="w-5 h-5" />,
    defaultDataSource: { type: 'logs', period: '1h' },
  },
  {
    type: 'alert-list',
    title: 'Alert List',
    description: 'Recent alerts',
    icon: <Bell className="w-5 h-5" />,
    defaultDataSource: { type: 'alerts', period: '24h' },
  },
];

interface PanelLibraryProps {
  onAddPanel: (template: PanelTemplate) => void;
}

export function PanelLibrary({ onAddPanel }: PanelLibraryProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Panel Library</h3>
      <div className="grid grid-cols-2 gap-2">
        {templates.map(t => (
          <button
            key={t.type}
            onClick={() => onAddPanel(t)}
            className="flex flex-col items-center gap-2 p-3 bg-slate-800 border border-slate-700 rounded-lg hover:border-blue-500/50 hover:bg-slate-700 transition-all text-center group"
          >
            <div className="text-slate-400 group-hover:text-blue-400 transition-colors">
              {t.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">{t.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export type { PanelTemplate };
