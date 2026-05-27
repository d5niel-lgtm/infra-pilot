import { useState } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';

export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    accent: string;
    bgPrimary: string;
    bgSecondary: string;
    bgCard: string;
    textPrimary: string;
    textSecondary: string;
    borderColor: string;
  };
  font: string;
  borderRadius: number;
  spacing: number;
}

interface ThemeEditorProps {
  config: ThemeConfig;
  onChange: (config: ThemeConfig) => void;
}

const FONTS = [
  'Inter Variable',
  'ui-sans-serif, system-ui',
  'Georgia, serif',
  'Courier New, monospace',
];

export const ThemeEditor = ({ config, onChange }: ThemeEditorProps) => {
  const intl = useIntl();

  const updateColor = (key: keyof ThemeConfig['colors'], value: string) => {
    onChange({ ...config, colors: { ...config.colors, [key]: value } });
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-6">
      <h3 className="text-lg font-semibold text-white">
        {intl.formatMessage({ id: 'themeStudio.editor' })}
      </h3>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Theme Name</label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => onChange({ ...config, name: e.target.value })}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white outline-none focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(config.colors).map(([key, value]) => (
          <div key={key}>
            <label className="block text-sm text-slate-400 mb-1 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={value}
                onChange={(e) => updateColor(key as keyof ThemeConfig['colors'], e.target.value)}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border border-slate-600"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => updateColor(key as keyof ThemeConfig['colors'], e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Font Family</label>
        <select
          value={config.font}
          onChange={(e) => onChange({ ...config, font: e.target.value })}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white outline-none focus:border-blue-500"
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">
          Border Radius: {config.borderRadius}px
        </label>
        <input
          type="range"
          min="0"
          max="24"
          value={config.borderRadius}
          onChange={(e) => onChange({ ...config, borderRadius: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">
          Spacing Unit: {config.spacing}px
        </label>
        <input
          type="range"
          min="2"
          max="12"
          step="2"
          value={config.spacing}
          onChange={(e) => onChange({ ...config, spacing: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>
    </div>
  );
};

export const defaultTheme: ThemeConfig = {
  name: 'Default Dark',
  colors: {
    primary: '#6C5CE7',
    primaryDark: '#5A46CD',
    secondary: '#EC4899',
    accent: '#22D3EE',
    bgPrimary: '#0f172a',
    bgSecondary: '#1e293b',
    bgCard: '#1e293b',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    borderColor: '#334155',
  },
  font: 'Inter Variable',
  borderRadius: 8,
  spacing: 4,
};
