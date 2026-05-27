import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import type { ThemeConfig } from './ThemeEditor';

interface ThemeExportProps {
  config: ThemeConfig;
}

export const ThemeExport = ({ config }: ThemeExportProps) => {
  const intl = useIntl();

  const handleExport = () => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.replace(/\s+/g, '-').toLowerCase()}-theme.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Theme exported');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target?.result as string);
          if (!imported.colors || !imported.name) {
            toast.error('Invalid theme file');
            return;
          }
          localStorage.setItem('imported-theme', JSON.stringify(imported));
          window.location.reload();
        } catch {
          toast.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">
        {intl.formatMessage({ id: 'themeStudio.export' })}
      </h3>
      <div className="flex gap-3">
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          {intl.formatMessage({ id: 'themeStudio.export' })}
        </button>
        <button
          onClick={handleImport}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors text-sm"
        >
          {intl.formatMessage({ id: 'themeStudio.import' })}
        </button>
      </div>
    </div>
  );
};
