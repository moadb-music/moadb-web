import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
  // Inicializa todas as 24 horas com zero
  const map = {};
  for (let h = 0; h < 24; h++) {
    map[`${String(h).padStart(2, '0')}h`] = 0;
  }
  for (const item of arr) {
    const d = item.ts?.toDate ? item.ts.toDate() : new Date();
    const key = `${String(d.getHours()).padStart(2, '0')}h`;
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
const CHART_H = 220;
const CHART_PAD_LEFT = 32;
const CHART_PAD_RIGHT = 12;
const CHART_PAD_TOP = 10;
const CHART_PAD_BOTTOM = 26;

function yTicks(max) {
  if (max <= 0) return [0];
  const step = Math.ceil(max / 4);
  return [0, step, step * 2, step * 3, step * 4].filter(v => v <= max + step);
}

function useContainerWidth(ref) {
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width;
      if (w > 0) setWidth(w);
    });
    ro.observe(ref.current);
    setWidth(ref.current.offsetWidth || 600);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function LineChart({ data, color = '#e5c97e' }) {
  const wrapRef = useRef(null);
  const W = useContainerWidth(wrapRef);
  const [hovered, setHovered] = useState(null);

  const vals = data.map(([, v]) => v);
  const maxVal = Math.max(...vals, 1);
  const H = CHART_H;
  const PL = CHART_PAD_LEFT;
  const PR = CHART_PAD_RIGHT;
  const PT = CHART_PAD_TOP;
  const PB = CHART_PAD_BOTTOM;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const xOf = (i) => PL + (i / Math.max(data.length - 1, 1)) * innerW;
  const yOf = (v) => PT + innerH - (v / maxVal) * innerH;

  const handleMouseMove = useCallback((e) => {
    if (!wrapRef.current || !data.length) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let closest = 0;
    let minDist = Infinity;
    data.forEach(([, ], i) => {
      const dist = Math.abs(xOf(i) - mx);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setHovered({ i: closest, x: xOf(closest), y: yOf(data[closest][1]), label: data[closest][0], value: data[closest][1] });
  }, [data, W]); // eslint-disable-line

  if (!data.length) return (
    <div ref={wrapRef}>
      <p style={{ opacity: 0.4, fontSize: '0.8rem' }}>Sem dados no período.</p>
    </div>
  );

  const ticks = yTicks(maxVal);
  const pts = data.map(([, v], i) => `${xOf(i)},${yOf(v)}`).join(' ');
  const areaD = [
    `M ${xOf(0)},${yOf(0)}`,
    ...data.map(([, v], i) => `L ${xOf(i)},${yOf(v)}`),
    `L ${xOf(data.length - 1)},${yOf(0)}`,
    'Z',
  ].join(' ');
  const gradId = `areaGrad_line_${W}`;
  const TOOLTIP_W = 130;

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHovered(null)}
    >
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {ticks.map(t => (
          <g key={t}>
            <line x1={PL} y1={yOf(t)} x2={W - PR} y2={yOf(t)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <text x={PL - 5} y={yOf(t) + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="10">{t}</text>
          </g>
        ))}

        <path d={areaD} fill={`url(#${gradId})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

        {data.map(([, v], i) => (
          <circle key={i} cx={xOf(i)} cy={yOf(v)} r={hovered?.i === i ? 4 : 2.5}
            fill={color} style={{ transition: 'r 0.1s' }} />
        ))}

        {/* hover crosshair */}
        {hovered && (
          <line x1={hovered.x} y1={PT} x2={hovered.x} y2={H - PB}
            stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,3" />
        )}

        {data.map(([k], i) => {
          const step = Math.max(1, Math.floor(data.length / 8));
          if (i !== 0 && i !== data.length - 1 && i % step !== 0) return null;
          return (
            <text key={k} x={xOf(i)} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10">{k}</text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          top: Math.max(4, hovered.y - 52),
          left: Math.min(hovered.x - TOOLTIP_W / 2, W - TOOLTIP_W - 4),
          width: TOOLTIP_W,
          background: 'rgba(28,28,28,0.96)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          padding: '7px 10px',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>{hovered.label}</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>{hovered.value} pageviews</div>
        </div>
      )}
    </div>
  );
}

function BarChart({ data, color = '#e5c97e' }) {
  const wrapRef = useRef(null);
  const W = useContainerWidth(wrapRef);
  const [hovered, setHovered] = useState(null);

  const vals = data.map(([, v]) => v);
  const maxVal = Math.max(...vals, 1);
  const H = CHART_H;
  const PL = CHART_PAD_LEFT;
  const PR = CHART_PAD_RIGHT;
  const PT = CHART_PAD_TOP;
  const PB = CHART_PAD_BOTTOM;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const barW = Math.max(3, Math.min(40, (innerW / Math.max(data.length, 1)) * 0.6));
  const xOf = (i) => PL + (i + 0.5) * (innerW / Math.max(data.length, 1));
  const yOf = (v) => PT + innerH - (v / maxVal) * innerH;
  const barH = (v) => (v / maxVal) * innerH;

  const handleMouseMove = useCallback((e) => {
    if (!wrapRef.current || !data.length) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let closest = 0;
    let minDist = Infinity;
    data.forEach(([, ], i) => {
      const dist = Math.abs(xOf(i) - mx);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setHovered({ i: closest, x: xOf(closest), y: yOf(data[closest][1]), label: data[closest][0], value: data[closest][1] });
  }, [data, W]); // eslint-disable-line

  if (!data.length) return (
    <div ref={wrapRef}>
      <p style={{ opacity: 0.4, fontSize: '0.8rem' }}>Sem dados no período.</p>
    </div>
  );

  const ticks = yTicks(maxVal);
  const TOOLTIP_W = 130;

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHovered(null)}
    >
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PL} y1={yOf(t)} x2={W - PR} y2={yOf(t)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <text x={PL - 5} y={yOf(t) + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="10">{t}</text>
          </g>
        ))}

        {data.map(([k, v], i) => {
          const step = Math.max(1, Math.floor(data.length / 8));
          const showLabel = i === 0 || i === data.length - 1 || i % step === 0;
          const isHov = hovered?.i === i;
          return (
            <g key={k}>
              <rect x={xOf(i) - barW / 2} y={yOf(v)} width={barW} height={barH(v)}
                fill={color} opacity={isHov ? 1 : 0.75} rx="2" />
              {showLabel && (
                <text x={xOf(i)} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10">{k}</text>
              )}
            </g>
          );
        })}

        {/* hover crosshair */}
        {hovered && (
          <line x1={hovered.x} y1={PT} x2={hovered.x} y2={H - PB}
            stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,3" />
        )}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          top: Math.max(4, hovered.y - 52),
          left: Math.min(hovered.x - TOOLTIP_W / 2, W - TOOLTIP_W - 4),
          width: TOOLTIP_W,
          background: 'rgba(28,28,28,0.96)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          padding: '7px 10px',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>{hovered.label}</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>{hovered.value} pageviews</div>
        </div>
      )}
    </div>
  );
}

// ── Mini horizontal bar ───────────────────────────────────────────────────────
function MiniBar({ label, value, max, color = '#e5c97e', prefix = '' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <span style={{ width: 110, minWidth: 80, fontSize: '0.78rem', opacity: 0.75, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {prefix}{label}
      </span>
      <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.06)', borderRadius: 2, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      <span style={{ width: 28, fontSize: '0.75rem', opacity: 0.7, textAlign: 'right', flexShrink: 0 }}>{value}</span>
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
    padding: '32px 24px 28px',
    minWidth: 0,
    textAlign: 'center',
  };

  const secTitle = {
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.62rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    opacity: 0.4,
    marginBottom: 18,
  };

  const tabBtn = (active) => ({
    background: active ? 'rgba(229,201,126,0.12)' : 'transparent',
    border: `1px solid ${active ? '#e5c97e' : 'rgba(255,255,255,0.18)'}`,
    color: active ? '#e5c97e' : 'rgba(255,255,255,0.45)',
    borderRadius: 5,
    padding: '3px 10px',
    fontSize: '0.7rem',
    fontFamily: 'Inter, sans-serif',
    cursor: 'pointer',
    transition: '0.2s',
    whiteSpace: 'nowrap',
  });

  const chartTitle = range.hours
    ? 'PAGEVIEWS — HOJE (POR HORA)'
    : 'PAGEVIEWS — POR DIA';

  return (
    <div style={{ color: '#fff' }}>

      {/* Range selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {RANGES.map((r, i) => (
          <button key={r.label} type="button"
            style={{
              background: 'none',
              border: 'none',
              color: i === rangeIdx ? '#e5c97e' : 'rgba(255,255,255,0.55)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.85rem',
              fontWeight: i === rangeIdx ? 600 : 400,
              padding: '5px 14px',
              cursor: 'pointer',
              borderBottom: i === rangeIdx ? '2px solid #e5c97e' : '2px solid transparent',
              transition: 'color 0.2s',
            }}
            onClick={() => setRangeIdx(i)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Carregando...</p>}
      {error   && <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</p>}

      {!loading && !error && (
        <>
          {/* KPIs — 4 colunas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
            {[
              { label: 'Pageviews',         value: totalViews },
              { label: 'Sessões únicas',    value: uniqueSessions },
              { label: 'Páginas distintas', value: byPage.length },
              { label: 'Países',            value: byCountry.length },
            ].map(kpi => (
              <div key={kpi.label} style={card}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 'clamp(2.2rem, 4vw, 3rem)', fontWeight: 700, color: '#e5c97e', lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: '0.6rem', opacity: 0.4, marginTop: 12, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Chart card */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '20px 20px 14px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={secTitle}>{chartTitle}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" style={tabBtn(chartType === 'line')} onClick={() => setChartType('line')}>Linha</button>
                <button type="button" style={tabBtn(chartType === 'bar')}  onClick={() => setChartType('bar')}>Barras</button>
              </div>
            </div>
            <div style={{ width: '100%' }}>
              {chartType === 'line'
                ? <LineChart data={chartData} />
                : <BarChart  data={chartData} />
              }
            </div>
          </div>

          {/* Bars grid — 4 colunas fixas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '20px 20px' }}>
              <div style={secTitle}>Páginas</div>
              {byPage.map(([k, v]) => <MiniBar key={k} label={k} value={v} max={maxPage} />)}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '20px 20px' }}>
              <div style={secTitle}>Dispositivo</div>
              {byDevice.map(([k, v]) => <MiniBar key={k} label={k} value={v} max={maxDevice} color="#2dd4bf" />)}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '20px 20px' }}>
              <div style={secTitle}>Browser</div>
              {byBrowser.map(([k, v]) => <MiniBar key={k} label={k} value={v} max={maxBrowser} color="#c084fc" />)}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '20px 20px' }}>
              <div style={secTitle}>Sistema Operacional</div>
              {byOS.map(([k, v]) => <MiniBar key={k} label={k} value={v} max={maxOS} color="#4ade80" />)}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '20px 20px', gridColumn: '1 / -1' }}>
              <div style={secTitle}>Países</div>
              {byCountry.length > 0
                ? byCountry.map(([k, v]) => (
                    <MiniBar key={k} label={k} value={v} max={maxCountry} color="#f97316" prefix={countryFlag(k) + ' '} />
                  ))
                : <p style={{ opacity: 0.4, fontSize: '0.8rem' }}>Sem dados de país ainda.</p>
              }
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '20px 20px', gridColumn: '1 / -1' }}>
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
