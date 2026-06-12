import { useEffect, useMemo, useState } from 'react';
import type { DashboardModule } from '../../types/dashboard';

interface ChartPoint {
  date: string;
  open: number;
  close: number;
}

const PRESET_WINDOWS = [
  { id: '5d', label: '5D', days: 5 },
  { id: '1m', label: '1M', days: 22 },
  { id: '3m', label: '3M', days: 66 },
  { id: 'all', label: 'All', days: Number.POSITIVE_INFINITY },
] as const;

function formatSignedCurrency(value: number) {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatSignedPercent(value: number) {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function clampRange(start: string, end: string, min: string, max: string) {
  const nextStart = start < min ? min : start > max ? max : start;
  const nextEnd = end < min ? min : end > max ? max : end;
  return nextStart <= nextEnd ? { start: nextStart, end: nextEnd } : { start: nextEnd, end: nextEnd };
}

export function ChartModule({ module }: { module: DashboardModule }) {
  const series = useMemo(
    () => (((module.payload as any).series ?? []) as ChartPoint[]).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [module.payload],
  );
  const latest = series.at(-1);
  const recent = series.slice(-5).reverse();
  const availablePresets = PRESET_WINDOWS.filter((preset) => preset.days === Number.POSITIVE_INFINITY || series.length >= preset.days);
  const defaultStart = series.at(0)?.date ?? '';
  const defaultEnd = latest?.date ?? '';
  const [selectedPreset, setSelectedPreset] = useState<string>(availablePresets.at(-1)?.id ?? 'all');
  const [rangeStart, setRangeStart] = useState(defaultStart);
  const [rangeEnd, setRangeEnd] = useState(defaultEnd);

  useEffect(() => {
    setRangeStart(defaultStart);
    setRangeEnd(defaultEnd);
    setSelectedPreset(availablePresets.at(-1)?.id ?? 'all');
  }, [defaultEnd, defaultStart]);

  const visibleSeries = useMemo(() => {
    if (!series.length) return [] as ChartPoint[];
    return series.filter((point) => point.date >= rangeStart && point.date <= rangeEnd);
  }, [rangeEnd, rangeStart, series]);

  const visibleLatest = visibleSeries.at(-1) ?? latest;
  const visibleFirst = visibleSeries.at(0) ?? series.at(0);
  const values = visibleSeries.flatMap((row) => [row.open, row.close]);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const chartWidth = 100;
  const chartHeight = 100;
  const left = 8;
  const right = 8;
  const top = 12;
  const bottom = 86;

  const x = (index: number) => left + (index / Math.max(visibleSeries.length - 1, 1)) * (chartWidth - left - right);
  const y = (value: number) => (max === min ? 50 : top + ((max - value) / (max - min)) * (bottom - top));
  const linePath = (key: 'open' | 'close') =>
    visibleSeries
      .map((row, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(2)} ${y(row[key]).toFixed(2)}`)
      .join(' ');
  const closeAreaPath = visibleSeries.length
    ? [
        `M ${x(0).toFixed(2)} ${bottom}`,
        ...visibleSeries.map((row, index) => `L ${x(index).toFixed(2)} ${y(row.close).toFixed(2)}`),
        `L ${x(visibleSeries.length - 1).toFixed(2)} ${bottom}`,
        'Z',
      ].join(' ')
    : '';
  const dayMove = visibleLatest ? visibleLatest.close - visibleLatest.open : 0;
  const periodReturn = visibleFirst && visibleLatest ? visibleLatest.close - visibleFirst.open : 0;
  const periodPercent = visibleFirst && visibleFirst.open ? (periodReturn / visibleFirst.open) * 100 : 0;
  const guideValues = [0, 0.5, 1].map((step) => max - (max - min) * step);

  const applyPreset = (presetId: string) => {
    const preset = availablePresets.find((item) => item.id === presetId);
    if (!preset || !series.length) return;
    setSelectedPreset(presetId);
    if (preset.days === Number.POSITIVE_INFINITY) {
      setRangeStart(series[0].date);
      setRangeEnd(series.at(-1)?.date ?? series[0].date);
      return;
    }
    const subset = series.slice(-preset.days);
    setRangeStart(subset[0].date);
    setRangeEnd(subset.at(-1)?.date ?? subset[0].date);
  };

  const handleRangeInput = (nextStart: string, nextEnd: string) => {
    if (!defaultStart || !defaultEnd) return;
    const clamped = clampRange(nextStart, nextEnd, defaultStart, defaultEnd);
    setSelectedPreset('custom');
    setRangeStart(clamped.start);
    setRangeEnd(clamped.end);
  };

  return (
    <section className="panel" data-testid={`module-${module.id}`} data-module-id={module.id}>
      <div className="chart-header-row">
        <div>
          <h2 className="section-title">{module.title}</h2>
          {module.summary ? <p className="tab-intro">{module.summary}</p> : null}
        </div>
        {series.length ? (
          <div className="chart-range-shell">
            <div className="chart-presets" aria-label="Date range presets">
              {availablePresets.map((preset) => (
                <button
                  className={`range-pill ${selectedPreset === preset.id ? 'active' : ''}`.trim()}
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="chart-date-range">
              <label className="chat-field">
                <span className="chat-field-label">Start date</span>
                <input aria-label="Start date" className="chat-select" max={rangeEnd || defaultEnd} min={defaultStart} onChange={(event) => handleRangeInput(event.target.value, rangeEnd || defaultEnd)} type="date" value={rangeStart} />
              </label>
              <label className="chat-field">
                <span className="chat-field-label">End date</span>
                <input aria-label="End date" className="chat-select" max={defaultEnd} min={rangeStart || defaultStart} onChange={(event) => handleRangeInput(rangeStart || defaultStart, event.target.value)} type="date" value={rangeEnd} />
              </label>
            </div>
          </div>
        ) : null}
      </div>
      {visibleLatest && visibleFirst ? (
        <>
          <div className="market-snapshot market-snapshot--expanded">
            <div className="metric">
              <div className="metric-label">Latest day</div>
              <div className="metric-value">{visibleLatest.date}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Open</div>
              <div className="metric-value">${visibleLatest.open.toFixed(2)}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Close</div>
              <div className="metric-value">${visibleLatest.close.toFixed(2)}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Day move</div>
              <div className={`metric-value ${dayMove >= 0 ? 'positive' : 'negative'}`}>{formatSignedCurrency(dayMove)}</div>
              <div className="metric-sub">Close minus open</div>
            </div>
            <div className="metric">
              <div className="metric-label">Period return</div>
              <div className={`metric-value ${periodReturn >= 0 ? 'positive' : 'negative'}`}>{formatSignedCurrency(periodReturn)}</div>
              <div className="metric-sub">{visibleFirst.date} → {visibleLatest.date}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Period gain/loss</div>
              <div className={`metric-value ${periodPercent >= 0 ? 'positive' : 'negative'}`}>{formatSignedPercent(periodPercent)}</div>
              <div className="metric-sub">Relative to first open</div>
            </div>
          </div>
          <div className="chart-shell">
            <svg className="chart chart--market" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" aria-label="VOO daily open and close chart">
              <defs>
                <linearGradient id={`chart-fill-${module.id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(109,94,252,0.26)" />
                  <stop offset="100%" stopColor="rgba(109,94,252,0.02)" />
                </linearGradient>
              </defs>
              {guideValues.map((value) => (
                <g key={value}>
                  <line className="chart-guide" x1={left} x2={chartWidth - right} y1={y(value)} y2={y(value)} />
                  <text className="chart-axis-label" x={1} y={y(value) + 1.5}>{`$${value.toFixed(0)}`}</text>
                </g>
              ))}
              {closeAreaPath ? <path d={closeAreaPath} fill={`url(#chart-fill-${module.id})`} /> : null}
              <path d={linePath('open')} fill="none" stroke="#3bb273" strokeWidth="2.6" strokeLinecap="round" />
              <path d={linePath('close')} fill="none" stroke="#6d5efc" strokeWidth="3.2" strokeLinecap="round" />
              {visibleSeries.map((point, index) => (
                <text className="chart-date-label" key={point.date} textAnchor="middle" x={x(index)} y={96}>
                  {point.date.slice(5)}
                </text>
              )).filter((_, index, labels) => index === 0 || index === labels.length - 1 || index % Math.max(Math.ceil(labels.length / 4), 1) === 0)}
              <circle cx={x(visibleSeries.length - 1)} cy={y(visibleLatest.open)} r="2.7" fill="#3bb273" />
              <circle cx={x(visibleSeries.length - 1)} cy={y(visibleLatest.close)} r="3.1" fill="#6d5efc" />
            </svg>
            <div className="legend" aria-label="Market legend">
              <span className="open">Open</span>
              <span className="close">Close</span>
            </div>
          </div>
          <div className="recent-prices" data-testid="recent-prices">
            {recent.map((row) => {
              const delta = row.close - row.open;
              return (
                <div className="recent-price" key={row.date}>
                  <div className="date">{row.date.slice(5)}</div>
                  <div className="labelled">Open: ${row.open.toFixed(2)}</div>
                  <div className="labelled">Close: ${row.close.toFixed(2)}</div>
                  <div className={`delta ${delta >= 0 ? 'positive' : 'negative'}`}>{formatSignedCurrency(delta)}</div>
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
