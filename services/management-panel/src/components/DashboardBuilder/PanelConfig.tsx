import { X } from 'lucide-react';
import type { DashboardPanel, PanelDataSource } from '../../lib/types';

interface PanelConfigProps {
  panel: DashboardPanel;
  onChange: (updated: DashboardPanel) => void;
  onClose: () => void;
}

export function PanelConfig({ panel, onChange, onClose }: PanelConfigProps) {
  const update = (field: string, value: any) => {
    if (field.startsWith('datasource.')) {
      const dsField = field.replace('datasource.', '');
      onChange({
        ...panel,
        dataSource: { ...panel.dataSource, [dsField]: value },
      });
    } else {
      onChange({ ...panel, [field]: value });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Panel Configuration</h3>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Title</label>
          <input
            value={panel.title}
            onChange={e => update('title', e.target.value)}
            className="w-full bg-slate-800 text-white text-sm rounded px-3 py-1.5 border border-slate-700 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Data Source</label>
          <select
            value={panel.dataSource.type}
            onChange={e => update('datasource.type', e.target.value)}
            className="w-full bg-slate-800 text-white text-sm rounded px-3 py-1.5 border border-slate-700"
          >
            <option value="metrics">Metrics</option>
            <option value="logs">Logs</option>
            <option value="alerts">Alerts</option>
            <option value="backups">Backups</option>
            <option value="apps">Apps</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Aggregation</label>
            <select
              value={panel.dataSource.aggregation || 'avg'}
              onChange={e => update('datasource.aggregation', e.target.value)}
              className="w-full bg-slate-800 text-white text-sm rounded px-3 py-1.5 border border-slate-700"
            >
              <option value="avg">Average</option>
              <option value="sum">Sum</option>
              <option value="max">Max</option>
              <option value="min">Min</option>
              <option value="latest">Latest</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Period</label>
            <select
              value={panel.dataSource.period || '1h'}
              onChange={e => update('datasource.period', e.target.value)}
              className="w-full bg-slate-800 text-white text-sm rounded px-3 py-1.5 border border-slate-700"
            >
              <option value="5m">5 min</option>
              <option value="15m">15 min</option>
              <option value="30m">30 min</option>
              <option value="1h">1 hour</option>
              <option value="6h">6 hours</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Width (columns)</label>
            <input
              type="number"
              min={1}
              max={12}
              value={panel.position.w}
              onChange={e => update('position', { ...panel.position, w: parseInt(e.target.value) || 3 })}
              className="w-full bg-slate-800 text-white text-sm rounded px-3 py-1.5 border border-slate-700 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Height (rows)</label>
            <input
              type="number"
              min={1}
              max={12}
              value={panel.position.h}
              onChange={e => update('position', { ...panel.position, h: parseInt(e.target.value) || 2 })}
              className="w-full bg-slate-800 text-white text-sm rounded px-3 py-1.5 border border-slate-700 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {panel.type === 'stat' && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Format</label>
            <select
              value={panel.config.format || 'number'}
              onChange={e => update('config', { ...panel.config, format: e.target.value })}
              className="w-full bg-slate-800 text-white text-sm rounded px-3 py-1.5 border border-slate-700"
            >
              <option value="number">Number</option>
              <option value="percent">Percentage</option>
              <option value="bytes">Bytes</option>
              <option value="duration">Duration</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
