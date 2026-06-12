import type { DashboardModule } from '../../types/dashboard';

export function CardsModule({ module }: { module: DashboardModule }) {
  const cards = ((module.payload as any).cards ?? []) as Array<{ title: string; body: string }>;
  return (
    <section className="panel" data-testid={`module-${module.id}`} data-module-id={module.id}>
      <h2 className="section-title">{module.title}</h2>
      {module.summary ? <p className="tab-intro">{module.summary}</p> : null}
      <div className="cards-grid">
        {cards.map((card) => (
          <article className="mini-card" key={card.title}>
            <strong>{card.title}</strong>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
