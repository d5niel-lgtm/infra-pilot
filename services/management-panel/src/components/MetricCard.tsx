interface MetricCardProps {
  icon: string;
  label: string;
  value: number | string;
  change?: {
    value: number;
    type: 'up' | 'down' | 'neutral';
    timeframe: string;
  };
  trend?: 'up' | 'down' | 'stable';
  accentColor?: string;
}

export const MetricCard = ({
  icon,
  label,
  value,
  change,
  trend = 'stable',
  accentColor = 'blue',
}: MetricCardProps) => {
  const getAccentColor = () => {
    switch (accentColor) {
      case 'green':
        return 'from-green-500 to-green-600';
      case 'red':
        return 'from-red-500 to-red-600';
      case 'orange':
        return 'from-orange-500 to-orange-600';
      case 'purple':
        return 'from-purple-500 to-purple-600';
      case 'cyan':
        return 'from-cyan-500 to-cyan-600';
      default:
        return 'from-blue-500 to-blue-600';
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-400';
      case 'down':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '→';
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-12 h-12 bg-gradient-to-br ${getAccentColor()} rounded-lg flex items-center justify-center text-xl`}
        >
          {icon}
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-sm font-semibold ${getTrendColor()}`}>
            {getTrendIcon()}
          </span>
          {change && (
            <span className="text-xs text-slate-400">
              {change.type === 'down' && change.value > 0 ? '▼' : '▲'}
              {' '}{Math.abs(change.value)}% vs {change.timeframe}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-400 mb-2">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
};
