import { useState, useEffect } from 'react';
import { Settings, GripHorizontal, X } from 'lucide-react';
import type { DashboardPanel } from '../../lib/types';

interface PanelRendererProps {
  panel: DashboardPanel;
  data: any;
  onConfigure: () => void;
  onRemove: () => void;
}

export function PanelRenderer({ panel, data, onConfigure, onRemove }: PanelRendererProps) {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (data?.data) {
      setChartData(Array.isArray(data.data) ? data.data : []);
    }
  }, [data]);

  const renderTimeSeries = () => (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-end gap-1 pb-2">
        {chartData.length === 0 ? (
          <div className="w-full text-center text-xs text-slate-500 self-center">No data</div>
        ) : (
          chartData.slice(-30).map((point: any, i: number) => {
            const val = point.cpu_percent || point.memory_used_mb || 0;
            const max = Math.max(...chartData.map((p: any) => p.cpu_percent || p.memory_used_mb || 0), 1);
            const h = (val / max) * 100;
            return (
              <div
                key={i}
                className="flex-1 bg-blue-500/60 rounded-t hover:bg-blue-400 transition-colors relative group"
                style={{ height: `${Math.max(h, 2)}%` }}
                title={`${val.toFixed(1)}`}
              />
            );
          })
        )}
      </div>
      <div className="text-xs text-slate-500 text-center border-t border-slate-700 pt-1">
        {chartData.length} data points
      </div>
    </div>
  );

  const renderStat = () => {
    const latest = chartData.length > 0 ? chartData[chartData.length - 1] : null;
    const value = latest ? (latest.cpu_percent || latest.memory_used_mb || 0) : 0;
    const fmt = panel.config.format || 'number';
    const display = fmt === 'percent' ? `${value.toFixed(1)}%` :
      fmt === 'bytes' ? `${(value / 1024).toFixed(1)} GB` :
      fmt === 'duration' ? `${value.toFixed(0)}ms` :
      value.toLocaleString();
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{display}</span>
        <span className="text-xs text-slate-500 mt-1">Latest value</span>
      </div>
    );
  };

  const renderLogList = () => (
    <div className="h-full overflow-y-auto space-y-1">
      {chartData.length === 0 ? (
        <div className="text-center text-xs text-slate-500 pt-4">No logs</div>
      ) : chartData.slice(0, 20).map((log: any, i: number) => (
        <div key={i} className="text-xs text-slate-300 truncate px-1 py-0.5 hover:bg-slate-800 rounded">
          <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
            log.level === 'ERROR' ? 'bg-red-500' :
            log.level === 'WARN' ? 'bg-amber-500' : 'bg-slate-500'
          }`} />
          {log.message || JSON.stringify(log)}
        </div>
      ))}
    </div>
  );

  const renderAlertList = () => (
    <div className="h-full overflow-y-auto space-y-1">
      {chartData.length === 0 ? (
        <div className="text-center text-xs text-slate-500 pt-4">No alerts</div>
      ) : chartData.slice(0, 20).map((alert: any, i: number) => (
        <div key={i} className="flex items-center gap-2 px-1 py-1 text-xs hover:bg-slate-800 rounded">
          <span className={`w-1.5 h-1.5 rounded-full ${alert.acknowledged ? 'bg-slate-600' : 'bg-red-500'}`} />
          <span className="text-slate-300 truncate">{alert.metric_type || 'Alert'}</span>
          <span className="ml-auto text-slate-500">{new Date(alert.triggered_at || alert.timestamp).toLocaleTimeString()}</span>
        </div>
      ))}
    </div>
  );

  const renderPanel = () => {
    switch (panel.type) {
      case 'time-series': return renderTimeSeries();
      case 'stat': return renderStat();
      case 'log-list': return renderLogList();
      case 'alert-list': return renderAlertList();
      default: return <div className="text-xs text-slate-500 text-center pt-4">Unknown panel type</div>;
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden h-full flex flex-col group">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-3.5 h-3.5 text-slate-500 cursor-move" />
          <span className="text-sm font-medium text-slate-200">{panel.title}</span>
          <span className="text-xs text-slate-500">{panel.dataSource.type}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onConfigure} className="p-1 text-slate-400 hover:text-white transition-colors" title="Configure">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRemove} className="p-1 text-slate-400 hover:text-red-400 transition-colors" title="Remove">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 p-3 overflow-hidden">
        {renderPanel()}
      </div>
    </div>
  );
}
