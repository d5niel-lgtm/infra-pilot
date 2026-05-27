import { useIntl } from 'react-intl';
import type { ThemeConfig } from './ThemeEditor';

interface ThemePreviewProps {
  config: ThemeConfig;
}

export const ThemePreview = ({ config }: ThemePreviewProps) => {
  const intl = useIntl();
  const previewStyle: React.CSSProperties = {
    '--brand-primary': config.colors.primary,
    '--brand-primary-dark': config.colors.primaryDark,
    '--brand-secondary': config.colors.secondary,
    '--brand-accent': config.colors.accent,
    '--bg-primary': config.colors.bgPrimary,
    '--bg-secondary': config.colors.bgSecondary,
    '--bg-card': config.colors.bgCard,
    '--text-primary': config.colors.textPrimary,
    '--text-secondary': config.colors.textSecondary,
    '--border-color': config.colors.borderColor,
    '--spacing-unit': `${config.spacing}px`,
    '--border-radius': `${config.borderRadius}px`,
    fontFamily: config.font,
  } as React.CSSProperties;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        {intl.formatMessage({ id: 'themeStudio.preview' })}
      </h3>
      <div
        className="rounded-lg p-6 space-y-4"
        style={{
          ...previewStyle,
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: `1px solid var(--border-color)`,
          borderRadius: 'var(--border-radius)',
        }}
      >
        <div
          className="p-4 space-y-3"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: `1px solid var(--border-color)`,
            borderRadius: 'var(--border-radius)',
          }}
        >
          <h4 style={{ color: 'var(--text-primary)', fontSize: '1.125rem', fontWeight: 600 }}>
            Sample Card
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            This is a preview of how your theme will look. The colors, fonts, spacing and border radius are applied in real time.
          </p>
          <div className="flex gap-2" style={{ marginTop: 'calc(var(--spacing-unit) * 2)' }}>
            <button
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: '#fff',
                padding: `calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 4)`,
                borderRadius: 'var(--border-radius)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Primary
            </button>
            <button
              style={{
                backgroundColor: 'transparent',
                color: 'var(--brand-primary)',
                padding: `calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 4)`,
                borderRadius: 'var(--border-radius)',
                border: `1px solid var(--brand-primary)`,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Secondary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
