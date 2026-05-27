import { useState } from 'react';
import { PanelRenderer } from './PanelRenderer';
import { PanelConfig } from './PanelConfig';
import type { DashboardPanel } from '../../lib/types';
import type { PanelTemplate } from './PanelLibrary';

interface CanvasProps {
  panels: DashboardPanel[];
  panelData: Record<string, any>;
  onUpdatePanel: (panel: DashboardPanel) => void;
  onRemovePanel: (id: string) => void;
  onAddPanel: (template: PanelTemplate) => void;
}

export function Canvas({ panels, panelData, onUpdatePanel, onRemovePanel }: CanvasProps) {
  const [configuringPanelId, setConfiguringPanelId] = useState<string | null>(null);
  const configuringPanel = panels.find(p => p.id === configuringPanelId) || null;

  const cols = 12;

  const handleConfigChange = (updated: DashboardPanel) => {
    onUpdatePanel(updated);
  };

  const sortedPanels = [...panels].sort((a, b) => {
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    return a.position.x - b.position.x;
  });

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {sortedPanels.length === 0 ? (
            <div className="col-span-full flex items-center justify-center h-64 bg-slate-900 border-2 border-dashed border-slate-700 rounded-lg">
              <div className="text-center">
                <p className="text-slate-500 mb-2">No panels yet</p>
                <p className="text-xs text-slate-600">Drag panels from the library or click to add</p>
              </div>
            </div>
          ) : sortedPanels.map(panel => (
            <div
              key={panel.id}
              style={{
                gridColumn: `${panel.position.x + 1} / span ${panel.position.w}`,
                gridRow: `span ${panel.position.h}`,
                minHeight: `${panel.position.h * 120}px`,
              }}
            >
              <PanelRenderer
                panel={panel}
                data={panelData[panel.id]}
                onConfigure={() => setConfiguringPanelId(panel.id)}
                onRemove={() => onRemovePanel(panel.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {configuringPanel && (
        <div className="w-72 flex-shrink-0">
          <PanelConfig
            panel={configuringPanel}
            onChange={handleConfigChange}
            onClose={() => setConfiguringPanelId(null)}
          />
        </div>
      )}
    </div>
  );
}
