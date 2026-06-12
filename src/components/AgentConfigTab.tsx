import type { DashboardModule } from '../types/dashboard';
import { CardsModule } from './modules/CardsModule';

export function AgentConfigTab({ modules }: { modules: DashboardModule[] }) {
  return (
    <section className="tab-panel" id="tab-agent">
      <div className="agent-grid compact-grid">
        {modules.map((module) => (
          <CardsModule key={module.id} module={module} />
        ))}
      </div>
    </section>
  );
}
