import type { DashboardModule } from '../types/dashboard';
import { HistoryModule } from './modules/HistoryModule';

export function HistoryTab({ modules }: { modules: DashboardModule[] }) {
  return (
    <section className="tab-panel" id="tab-history">
      <div className="history-zone">
        {modules.map((module) => (
          <HistoryModule key={module.id} module={module} />
        ))}
      </div>
    </section>
  );
}
