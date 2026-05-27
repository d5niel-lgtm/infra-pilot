import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { apiClient } from '../../lib/api';
import type { ThemeConfig } from './ThemeEditor';

interface ThemeGalleryProps {
  onSelect: (theme: ThemeConfig) => void;
}

export const ThemeGallery = ({ onSelect }: ThemeGalleryProps) => {
  const intl = useIntl();
  const [themes, setThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      const data = await apiClient.listThemes();
      setThemes(data);
    } catch {
      toast.error('Failed to load themes');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <p className="text-slate-400">{intl.formatMessage({ id: 'common.loading' })}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        {intl.formatMessage({ id: 'themeStudio.gallery' })}
      </h3>
      {themes.length === 0 ? (
        <p className="text-slate-400 text-sm">No community themes available yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {themes.map((theme: any) => (
            <button
              key={theme.id}
              onClick={() => onSelect(theme.config as ThemeConfig)}
              className="text-left p-4 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              <p className="text-white font-medium text-sm">{theme.name}</p>
              <p className="text-slate-400 text-xs mt-1">{theme.author}</p>
              <div className="flex gap-1 mt-2">
                {Object.values(theme.config?.colors || {}).slice(0, 5).map((color: any, i: number) => (
                  <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
