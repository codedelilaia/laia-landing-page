import type { DashboardModule } from '../../types/dashboard';

export function KanbanModule({ module }: { module: DashboardModule }) {
  const columns = ((module.payload as any).columns ?? []) as Array<{ title: string; cards: Array<{ title: string; body: string }> }>;
  return (
    <section className="panel" data-testid={`module-${module.id}`} data-module-id={module.id}>
      <h2 className="section-title">{module.title}</h2>
      {module.summary ? <p className="tab-intro">{module.summary}</p> : null}
      <div className="kanban-grid">
        {columns.map((column) => (
          <div className="kanban-column" key={column.title}>
            <h3>{column.title}</h3>
            {column.cards.map((card) => (
              <article className="mini-card" key={card.title}>
                <strong>{card.title}</strong>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
