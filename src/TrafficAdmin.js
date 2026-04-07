import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// ── Ranges ────────────────────────────────────────────────────────────────────
const RANGES = [
  { label: '24h',    hours: 24 },
  { label: '7 dias', days: 7 },
  { label: '30 dias',days: 30 },
  { label: '90 dias',days: 90 },
];

function sinceTs(range) {
  const d = new Date();
  if (range.hours) d.setHours(d.getHours() - range.hours);
  else d.setDate(d.getDate() - range.days);
  return Timestamp.fromDate(d);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function countBy(arr, key) {
  const map = {};
  for (const item of arr) {
    const v = item[key] || 'unknown';
    map[v] = (map[v] || 0) + 1;
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function groupByDay(arr) {
  const map = {};
  for (const item of arr) {
    const d = item.ts?.toDate ? item.ts.toDate() : new Date();
    const key = d.toISOString().slice(0, 10);
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}

function groupByHour(arr) {
  const map = {};
  for (const item of arr) {
    const d = item.ts?.toDate ? item.ts.toDate() : new Date();
    // "HH:00" format
    const h = String(d.getHours()).padStart(2, '0');
    const key = `${h}:00`;
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}

// Flag emoji from country code
function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

// ── Chart components ──────────────────────────────────────────────────────────
const CHART_H = 120;
const CHART_PAD_LEFT = 36;
const CHART_PAD_BOTTOM = 24;

function yTicks(max) {
  if (max <= 0) return [0];
  const step = Math.ceil(max / 4);
  return [0, step, step * 2, step * 3, step * 4].filter(v => v <= max + step);
}

function LineChart({ data, color = '#e5c97e' }) {
  if (!data.length) return <p style={{ opacity: 0.4, fontSize: '0.8rem' }}>Sem dados no período.</p>;

  const vals = data.map(([, v]) => v);
  const maxVal = Math.max(...vals, 1);
  const ticks = yTicks(maxVal);
  const W = 600;
  const H = CHART_H;
  const PL = CHART_PAD_LEFT;
  const PB = CHART_PAD_BOTTOM;
  const innerW = W - PL - 8;
  const innerH = H - PB - 8;

  const xOf = (i) => PL + (i / Math.max(data.length - 1, 1)) * innerW;
  const yOf = (v) => 8 + innerH - (v / maxVal) * innerH;

  const pts = data.map(([, v], i) => `${xOf(i)},${yOf(v)}`).join(' ');

  // area fill path
  const areaD = [
    `M ${xOf(0)},${yOf(0)}`,
    ...data.map(([, v], i) => `L ${xOf(i)},${yOf(v)}`),
    `L ${xOf(data.length - 1)},${yOf(0)}`,
    'Z',
  ].join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: CHART_H + 20, display: 'block', overflow: 'visible' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* y-axis ticks */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={PL} y1={yOf(t)} x2={W - 8} y2={yOf(t)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          <text x={PL - 4} y={yOf(t) + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="9">{t}</text>
        </g>
      ))}

      {/* area */}
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#areaGrad)" />

      {/* line */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* dots */}
      {data.map(([, v], i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(v)} r="3" fill={color} />
      ))}

      {/* x-axis labels */}
      {data.map(([k], i) => {
        // show only first, last, and ~3 in between
        const step = Math.max(1, Math.floor(data.length / 4));
        if (i !== 0 && i !== data.length - 1 && i % step !== 0) return null;
        return (
          <text key={k} x={xOf(i)} y={H - 2} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9">
            {k}
          </text>
        );
      })}
    </svg>
  );
}

function BarChart({ data, color = '#e5c97e' }) {
  if (!data.length) return <p style={{ opacity: 0.4, fontSize: '0.8rem' }}>Sem dados no período.</p>;

  const vals = data.map(([, v]) => v);
  const maxVal = Math.max(...vals, 1);
  const ticks = yTicks(maxVal);
  const W = 600;
  const H = CHART_H;
  const PL = CHART_PAD_LEFT;
  const PB = CHART_PAD_BOTTOM;
  const innerW = W - PL - 8;
  const innerH = H - PB - 8;

  const barW = Math.max(4, Math.min(32, (innerW / data.length) * 0.65));
  const xOf = (i) => PL + (i + 0.5) * (innerW / data.length);
  const yOf = (v) => 8 + innerH - (v / maxVal) * innerH;
  const barH = (v) => (v / maxVal) * innerH;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: CHART_H + 20, display: 'block', overflow: 'visible' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {ticks.map(t => (
        <g key={t}>
          <line x1={PL} y1={yOf(t)} x2={W - 8} y2={yOf(t)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          <text x={PL - 4} y={yOf(t) + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="9">{t}</text>
        </g>
      ))}

      {data.map(([k, v], i) => (
        <g key={k}>
          <rect
            x={xOf(i) - barW / 2}
            y={yOf(v)}
            width={barW}
            height={barH(v)}
            fill={color}
            opacity="0.85"
            rx="2"
          />
          {/* x label */}
          {(() => {
            const step = Math.max(1, Math.floor(data.length / 6));
            if (i !== 0 && i !== data.length - 1 && i % step !== 0) return null;
            return (
              <text x={xOf(i)} y={H - 2} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9">{k}</text>
            );
          })()}
        </g>
      ))}
    </svg>
  );
}

// ── Mini horizontal bar ───────────────────────────────────────────────────────
function MiniBar({ label, value, max, color = '#e5c97e', prefix = '' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
      <span style={{ width: 90, minWidth: 60, fontSize: '0.75rem', opacity: 0.75, textAlign: 'right', flexShrink: 0, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {prefix}{label}
      </span>
      <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 13, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      <span style={{ width: 30, fontSize: '0.75rem', opacity: 0.85, textAlign: 'right', flexShrink: 0 }}>{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TrafficAdmin() {
  const [rangeIdx, setRangeIdx] = useState(1);
  const [chartType, setChartType] = useState('line');
  const [granularity, setGranularity] = useState('day');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const range = RANGES[rangeIdx];

  useEffect(() => {
    setLoading(true);
    setError('');
    const since = sinceTs(range);
    const q = query(
      collection(db, 'analytics_pageviews'),
      where('ts', '>=', since),
      orderBy('ts', 'desc'),
      limit(5000)
    );
    getDocs(q)
      .then(snap => {
        setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || 'Erro ao carregar dados');
        setLoading(false);
      });
  }, [rangeIdx]); // eslint-disable-line

  useEffect(() => {
    if (range.hours) setGranularity('hour');
    else setGranularity('day');
  }, [rangeIdx]); // eslint-disable-line

  const totalViews     = rows.length;
  const uniqueSessions = useMemo(() => new Set(rows.map(r => r.sessionId)).size, [rows]);
  const byPage         = useMemo(() => countBy(rows, 'page'), [rows]);
  const byDevice       = useMemo(() => countBy(rows, 'device'), [rows]);
  const byBrowser      = useMemo(() => countBy(rows, 'browser'), [rows]);
  const byOS           = useMemo(() => countBy(rows, 'os'), [rows]);
  const byReferrer     = useMemo(() => countBy(rows, 'referrer').slice(0, 8), [rows]);
  const byCountry      = useMemo(() => countBy(rows, 'country').slice(0, 10), [rows]);
  const chartData      = useMemo(
    () => granularity === 'hour' ? groupByHour(rows) : groupByDay(rows),
    [rows, granularity]
  );

  const maxPage    = byPage[0]?.[1]     || 1;
  const maxDevice  = byDevice[0]?.[1]   || 1;
  const maxBrowser = byBrowser[0]?.[1]  || 1;
  const maxOS      = byOS[0]?.[1]       || 1;
  const maxRef     = byReferrer[0]?.[1] || 1;
  const maxCountry = byCountry[0]?.[1]  || 1;

  const card = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '16px 16px',
    minWidth: 0,
  };

  const secTitle = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: '0.72rem',
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.5,
    marginBottom: 14,
  };

  const tabBtn = (active) => ({
    background: active ? 'rgba(229,201,126,0.15)' : 'none',
    border: `1px solid ${active ? '#e5c97e' : 'rgba(255,255,255,0.15)'}`,
    color: active ? '#e5c97e' : 'rgba(255,255,255,0.5)',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: '0.7rem',
    letterSpacing: 1,
    fontFamily: 'Oswald, sans-serif',
    cursor: 'pointer',
    transition: '0.2s',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ padding: '24px 0', color: '#fff' }}>

      {/* Range selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {RANGES.map((r, i) => (
          <button key={r.label} type="button"
            className={`admin-tab ${i === rangeIdx ? 'is-active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '6px 14px' }}
            onClick={() => setRangeIdx(i)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ opacity: 0.5 }}>Carregando...</p>}
      {error   && <p style={{ color: '#f87171' }}>{error}</p>}

      {!loading && !error && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Pageviews',         value: totalViews },
              { label: 'Sessões únicas',    value: uniqueSessions },
              { label: 'Páginas distintas', value: byPage.length },
              { label: 'Países',            value: byCountry.length },
            ].map(kpi => (
              <div key={kpi.label} style={{ ...card, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(1.4rem, 5vw, 2rem)', color: '#e5c97e', lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.55, marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Chart card */}
          <div style={{ ...card, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <span style={secTitle}>Pageviews — {granularity === 'hour' ? 'por hora' : 'por dia'}</span>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {!range.hours && (
                  <>
                    <button type="button" style={tabBtn(granularity === 'day')}  onClick={() => setGranularity('day')}>Diário</button>
                    <button type="button" style={tabBtn(granularity === 'hour')} onClick={() => setGranularity('hour')}>Por hora</button>
                  </>
                )}
                <button type="button" style={tabBtn(chartType === 'line')} onClick={() => setChartType('line')}>Linha</button>
                <button type="button" style={tabBtn(chartType === 'bar')}  onClick={() => setChartType('bar')}>Barras</button>
              </div>
            </div>
            {/* scrollable wrapper so chart never overflows on narrow screens */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {chartType === 'line'
                ? <LineChart data={chartData} />
                : <BarChart  data={chartData} />
              }
            </div>
          </div>

          {/* Bars grid — 1 col on mobile, 2 on tablet+ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>

            <div style={card}>
              <div style={secTitle}>Páginas</div>
              {byPage.map(([k, v]) => <MiniBar key={k} label={k} value={v} max={maxPage} />)}
            </div>

            <div style={card}>
              <div style={secTitle}>Dispositivo</div>
              {byDevice.map(([k, v]) => <MiniBar key={k} label={k} value={v} max={maxDevice} color="#7ec8e5" />)}
            </div>

            <div style={card}>
              <div style={secTitle}>Browser</div>
              {byBrowser.map(([k, v]) => <MiniBar key={k} label={k} value={v} max={maxBrowser} color="#a78bfa" />)}
            </div>

            <div style={card}>
              <div style={secTitle}>Sistema Operacional</div>
              {byOS.map(([k, v]) => <MiniBar key={k} label={k} value={v} max={maxOS} color="#86efac" />)}
            </div>

            <div style={{ ...card, gridColumn: '1 / -1' }}>
              <div style={secTitle}>Países</div>
              {byCountry.length > 0
                ? byCountry.map(([k, v]) => (
                    <MiniBar key={k} label={k} value={v} max={maxCountry} color="#f97316"
                      prefix={countryFlag(k) + ' '} />
                  ))
                : <p style={{ opacity: 0.4, fontSize: '0.8rem' }}>Sem dados de país ainda — os novos acessos já vão registrar.</p>
              }
            </div>

            <div style={{ ...card, gridColumn: '1 / -1' }}>
              <div style={secTitle}>Origem do tráfego (referrer)</div>
              {byReferrer.length > 0
                ? byReferrer.map(([k, v]) => <MiniBar key={k} label={k} value={v} max={maxRef} color="#fb923c" />)
                : <p style={{ opacity: 0.4, fontSize: '0.8rem' }}>Sem dados.</p>
              }
            </div>

          </div>
        </>
      )}
    </div>
  );
}
