import type { DashboardModule } from '../../types/dashboard';

export function HistoryModule({ module }: { module: DashboardModule }) {
  const entries = ((module.payload as any).entries ?? []) as Array<{ date: string; title: string; summary: string; bullets: string[] }>;
  return (
    <section className="panel" data-testid={`module-${module.id}`} data-module-id={module.id}>
      <h2 className="section-title">{module.title}</h2>
      {module.summary ? <p className="tab-intro">{module.summary}</p> : null}
      <div className="history-list">
        {entries.map((entry) => (
          <article className="history-entry" key={`${entry.date}-${entry.title}`}>
            <div className="history-date">{entry.date}</div>
            <strong>{entry.title}</strong>
            <p>{entry.summary}</p>
            <ul>
              {entry.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
