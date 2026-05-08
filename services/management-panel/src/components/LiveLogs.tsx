import { useState, useEffect } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  app: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  status?: 'success' | 'failed';
}

interface LiveLogsProps {
  logs?: LogEntry[];
  isLive?: boolean;
  maxHeight?: string;
}

export const LiveLogs = ({
  logs = [
    {
      id: '1423',
      timestamp: '2024-05-14T18:15:23.123Z',
      app: 'web-frontend',
      level: 'INFO',
      message: 'GET /api/v1/users 200 45ms',
      status: 'success',
    },
    {
      id: '1424',
      timestamp: '2024-05-14T18:15:24.456Z',
      app: 'api-gateway',
      level: 'INFO',
      message: 'Request processesI successfully',
      status: 'success',
    },
    {
      id: '1425',
      timestamp: '2024-05-14T18:15:25.789Z',
      app: 'worker',
      level: 'WARN',
      message: 'Job queue size high: 1850',
      status: 'failed',
    },
    {
      id: '1426',
      timestamp: '2024-05-14T18:15:26.012Z',
      app: 'mail-service',
      level: 'ERROR',
      message: 'Failed to connect to SMTP server',
      status: 'failed',
    },
    {
      id: '1427',
      timestamp: '2024-05-14T18:15:26.345Z',
      app: 'postgres-db',
      level: 'INFO',
      message: 'Checkpoint completed',
      status: 'success',
    },
    {
      id: '1428',
      timestamp: '2024-05-14T18:15:27.678Z',
      app: 'redis-cache',
      level: 'INFO',
      message: 'Key expired: session:abc123',
      status: 'success',
    },
  ],
  isLive = true,
  maxHeight = 'max-h-96',
}: LiveLogsProps) => {
  const [isPaused, setIsPaused] = useState(false);
  const [displayLogs, setDisplayLogs] = useState(logs);

  useEffect(() => {
    setDisplayLogs(logs);
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'INFO':
        return 'text-blue-400';
      case 'WARN':
        return 'text-yellow-400';
      case 'ERROR':
        return 'text-red-400';
      case 'DEBUG':
        return 'text-gray-400';
      default:
        return 'text-slate-400';
    }
  };

  const getLevelBackground = (level: string) => {
    switch (level) {
      case 'INFO':
        return 'bg-blue-500/10 text-blue-400';
      case 'WARN':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'ERROR':
        return 'bg-red-500/10 text-red-400';
      case 'DEBUG':
        return 'bg-gray-500/10 text-gray-400';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Live Logs (All Containers)</h3>
          {isLive && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Live
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              isPaused
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="px-3 py-1.5 text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 rounded transition-colors">
            🗑 Clear
          </button>
          <button className="px-3 py-1.5 text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 rounded transition-colors">
            ⛶ Fullscreen
          </button>
        </div>
      </div>

      {/* Logs Container */}
      <div className={`${maxHeight} overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg`}>
        <div className="font-mono text-xs">
          {displayLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 px-4 py-2 border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
            >
              {/* Timestamp */}
              <span className="text-slate-500 flex-shrink-0 w-20">
                {log.id}
              </span>

              {/* Timestamp */}
              <span className="text-slate-500 flex-shrink-0 w-32">
                {formatTime(log.timestamp)}
              </span>

              {/* Level */}
              <span
                className={`${getLevelBackground(log.level)} px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 w-16`}
              >
                {log.level}
              </span>

              {/* App */}
              <span className="text-blue-400 flex-shrink-0 w-24">{log.app}:</span>

              {/* Message */}
              <span className="text-slate-300 flex-1">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
