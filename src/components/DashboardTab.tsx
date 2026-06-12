import { useMemo, useState } from 'react';
import { updateEditableModule } from '../api/dashboard';
import type { DashboardModule, DashboardState } from '../types/dashboard';
import { CardsModule } from './modules/CardsModule';
import { ChartModule } from './modules/ChartModule';
import { KanbanModule } from './modules/KanbanModule';
import { StatusModule } from './modules/StatusModule';

interface DashboardTabProps {
  dashboard: DashboardState;
  onDashboardChange: (dashboard: DashboardState) => void;
}

function renderModule(module: DashboardModule, onDashboardChange: (dashboard: DashboardState) => void) {
  if (module.type === 'kanban') return <KanbanModule key={module.id} module={module} />;
  if (module.type === 'chart') return <ChartModule key={module.id} module={module} />;
  if (module.type === 'cards') return <CardsModule key={module.id} module={module} />;
  if (module.type === 'status') {
    const editable = module.id === 'chores' || module.id === 'internal_projects';
    return (
      <StatusModule
        key={module.id}
        module={module}
        editable={editable}
        onSave={
          editable
            ? async (items) => {
                const updated = await updateEditableModule(module.id, items);
                onDashboardChange(updated);
              }
            : undefined
        }
      />
    );
  }
  return null;
}

export function DashboardTab({ dashboard, onDashboardChange }: DashboardTabProps) {
  const [error, setError] = useState<string | null>(null);
  const modules = useMemo(() => [...dashboard.modules].sort((a, b) => a.sortOrder - b.sortOrder), [dashboard.modules]);

  const dashboardModules = modules.filter((module) => module.zone === 'dashboard-primary' || module.zone === 'dashboard-secondary');
  const primary = dashboardModules.filter((module) => module.zone === 'dashboard-primary');
  const secondary = dashboardModules.filter((module) => module.zone === 'dashboard-secondary');

  return (
    <section className="tab-panel active" id="tab-dashboard">
      {error ? <div className="inline-error">{error}</div> : null}
      <div className="main-grid">
        <div className="primary-column">
          {primary.map((module) => (
            <div
              key={module.id}
              onClickCapture={() => setError(null)}
              onKeyDownCapture={() => setError(null)}
              role="presentation"
            >
              {renderModule(module, async (nextDashboard) => {
                try {
                  onDashboardChange(nextDashboard);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Unable to save module.');
                }
              })}
            </div>
          ))}
        </div>
        <div className="secondary-column">
          {secondary.map((module) => renderModule(module, onDashboardChange))}
        </div>
      </div>
    </section>
  );
}
