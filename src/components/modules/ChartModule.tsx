import type { DashboardModule } from '../../types/dashboard';

export function ChartModule({ module }: { module: DashboardModule }) {
  const series = ((module.payload as any).series ?? []) as Array<{ date: string; open: number; close: number }>;
  const latest = series.at(-1);
  const recent = series.slice(-5).reverse();
  const values = series.flatMap((row) => [row.open, row.close]);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const chartWidth = 100;
  const chartHeight = 100;
  const chartTop = 10;
  const chartBottom = 90;

  const x = (index: number) => (index / Math.max(series.length - 1, 1)) * chartWidth;
  const y = (value: number) => (max === min ? 50 : chartTop + ((max - value) / (max - min)) * (chartBottom - chartTop));
  const pathFor = (key: 'open' | 'close') =>
    series
      .map((row, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(2)} ${y(row[key]).toFixed(2)}`)
      .join(' ');

  const dayMove = latest ? latest.close - latest.open : 0;

  return (
    <section className="panel" data-testid={`module-${module.id}`} data-module-id={module.id}>
      <h2 className="section-title">{module.title}</h2>
      {module.summary ? <p className="tab-intro">{module.summary}</p> : null}
      {latest ? (
        <>
          <div className="market-snapshot">
            <div className="metric">
              <div className="metric-label">Latest day</div>
              <div className="metric-value">{latest.date}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Open</div>
              <div className="metric-value">${latest.open.toFixed(2)}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Close</div>
              <div className="metric-value">${latest.close.toFixed(2)}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Day move</div>
              <div className={`metric-value ${dayMove >= 0 ? 'positive' : 'negative'}`}>{`${dayMove >= 0 ? '+' : '-'}$${Math.abs(dayMove).toFixed(2)}`}</div>
              <div className="metric-sub">Close minus open</div>
            </div>
          </div>
          <svg className="chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" aria-label="VOO daily open and close chart">
            <path d={pathFor('open')} fill="none" stroke="#3bb273" strokeWidth="2.5" strokeLinecap="round" />
            <path d={pathFor('close')} fill="none" stroke="#6d5efc" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={x(series.length - 1).toFixed(2)} cy={y(latest.open).toFixed(2)} r="2.8" fill="#3bb273" />
            <circle cx={x(series.length - 1).toFixed(2)} cy={y(latest.close).toFixed(2)} r="2.8" fill="#6d5efc" />
          </svg>
          <div className="legend" aria-label="Market legend">
            <span className="open">Open</span>
            <span className="close">Close</span>
          </div>
          <div className="recent-prices" data-testid="recent-prices">
            {recent.map((row) => {
              const delta = row.close - row.open;
              return (
                <div className="recent-price" key={row.date}>
                  <div className="date">{row.date.slice(5)}</div>
                  <div className="labelled">Open: ${row.open.toFixed(2)}</div>
                  <div className="labelled">Close: ${row.close.toFixed(2)}</div>
                  <div className={`delta ${delta >= 0 ? 'positive' : 'negative'}`}>{`${delta >= 0 ? '+' : '-'}$${Math.abs(delta).toFixed(2)}`}</div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="chart-empty">No market data yet.</div>
      )}
    </section>
  );
}
