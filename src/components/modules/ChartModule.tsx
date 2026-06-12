import type { DashboardModule } from '../../types/dashboard';

export function ChartModule({ module }: { module: DashboardModule }) {
  const series = ((module.payload as any).series ?? []) as Array<{ date: string; open: number; close: number }>;
  const points = series.map((row) => row.close);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const sparkline = points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = max === min ? 50 : 100 - ((value - min) / (max - min)) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <section className="panel" data-testid={`module-${module.id}`} data-module-id={module.id}>
      <h2 className="section-title">{module.title}</h2>
      {module.summary ? <p className="tab-intro">{module.summary}</p> : null}
      <svg className="chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={module.title}>
        <polyline fill="none" points={sparkline} stroke="currentColor" strokeWidth="2" />
      </svg>
      <div className="chart-footer">
        <span>{series[0]?.date}</span>
        <span>{series.at(-1)?.date}</span>
      </div>
    </section>
  );
}
