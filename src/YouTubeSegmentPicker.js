import { useEffect, useMemo, useRef, useState } from 'react';
import YouTube from 'react-youtube';

function parseYouTubeId(urlOrId) {
  const s = String(urlOrId || '').trim();
  if (!s) return '';

  // If already looks like an id
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;

  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu.be')) return u.pathname.replace('/', '').slice(0, 11);
    const v = u.searchParams.get('v');
    if (v) return v.slice(0, 11);
    const parts = u.pathname.split('/').filter(Boolean);
    const embedIdx = parts.indexOf('embed');
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1].slice(0, 11);
    const shortsIdx = parts.indexOf('shorts');
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1].slice(0, 11);
  } catch {
    // ignore
  }
  return '';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmt(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function YouTubeSegmentPicker({ value, onChange }) {
  // value: { youtubeUrl, startSec, endSec }
  const youtubeId = useMemo(() => parseYouTubeId(value?.youtubeUrl), [value?.youtubeUrl]);

  const playerRef = useRef(null);
  const tickRef = useRef(null);
  const previewTickRef = useRef(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const startSec = Number(value?.startSec ?? 0);
  const endSec = Number(value?.endSec ?? 0);

  const safeRange = useMemo(() => {
    if (!duration) return { start: 0, end: 0 };
    const a = clamp(startSec, 0, duration);
    const b = clamp(endSec, 0, duration);
    return {
      start: Math.min(a, b),
      end: Math.max(a, b),
    };
  }, [duration, startSec, endSec]);

  const gapDuration = Math.max(0, safeRange.end - safeRange.start);

  // Preview position is 0..gapDuration
  const [previewPos, setPreviewPos] = useState(0);

  useEffect(() => {
    // Clamp previewPos if gap changes
    setPreviewPos(p => clamp(p, 0, gapDuration));
  }, [gapDuration]);

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (previewTickRef.current) window.clearInterval(previewTickRef.current);
      tickRef.current = null;
      previewTickRef.current = null;
      if (playerRef.current?.stopVideo) playerRef.current.stopVideo();
    };
  }, []);

  function emit(patch) {
    onChange?.({
      youtubeUrl: value?.youtubeUrl || '',
      startSec: safeRange.start,
      endSec: safeRange.end,
      ...patch,
    });
  }

  function startTick() {
    if (tickRef.current) return;
    tickRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      const t = p.getCurrentTime();
      if (Number.isFinite(t)) setCurrentTime(t);
    }, 250);
  }

  function stopTick() {
    if (!tickRef.current) return;
    window.clearInterval(tickRef.current);
    tickRef.current = null;
  }

  function startPreviewGuard() {
    if (previewTickRef.current) return;
    previewTickRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      const t = p.getCurrentTime();
      if (!Number.isFinite(t)) return;
      // If we passed end, pause
      if (t >= safeRange.end - 0.05) {
        p.pauseVideo?.();
        setIsPlayingPreview(false);
        if (previewTickRef.current) {
          window.clearInterval(previewTickRef.current);
          previewTickRef.current = null;
        }
      }
      // update preview slider position
      setPreviewPos(clamp(t - safeRange.start, 0, gapDuration));
    }, 100);
  }

  function stopPreviewGuard() {
    if (!previewTickRef.current) return;
    window.clearInterval(previewTickRef.current);
    previewTickRef.current = null;
  }

  const opts = {
    width: '100%',
    height: '0',
    playerVars: {
      modestbranding: 1,
      rel: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
    },
  };

  const hasPlayer = Boolean(youtubeId);

  // Derived UI values
  const totalPctStart = duration ? (safeRange.start / duration) * 100 : 0;
  const totalPctEnd = duration ? (safeRange.end / duration) * 100 : 0;
  const totalGapLeft = Math.min(totalPctStart, totalPctEnd);
  const totalGapWidth = Math.max(0, Math.abs(totalPctEnd - totalPctStart));

  return (
    <div className="seg">
      <div className="seg-player" aria-hidden="true" style={{ height: 0, border: 0, padding: 0, margin: 0, overflow: 'hidden' }}>
        {youtubeId ? (
          <YouTube
            videoId={youtubeId}
            opts={opts}
            onReady={e => {
              playerRef.current = e.target;
              const d = e.target.getDuration?.() || 0;
              if (Number.isFinite(d) && d > 0) {
                setDuration(d);
                const start = clamp(safeRange.start, 0, d);
                const end = clamp(safeRange.end || Math.min(d, start + 15), 0, d);
                emit({ startSec: start, endSec: Math.max(end, start) });
              }
              startTick();
            }}
            onPlay={() => {
              startTick();
              if (isPlayingPreview) startPreviewGuard();
            }}
            onPause={() => {
              stopTick();
              stopPreviewGuard();
              setIsPlayingPreview(false);
            }}
            onEnd={() => {
              stopTick();
              stopPreviewGuard();
              setIsPlayingPreview(false);
            }}
          />
        ) : null}
      </div>

      {!hasPlayer ? null : (
        <div className="seg-time">
          <div className="seg-row">
            <div className="seg-title">Trecho</div>
            <div className="seg-meta">{fmt(safeRange.start)} – {fmt(safeRange.end)} <span style={{ opacity: 0.8 }}>({fmt(gapDuration)})</span></div>
          </div>

          <div className="seg-dual" style={{ marginTop: 10 }}>
            <div className="seg-dual-track" aria-hidden="true">
              <div
                className="seg-dual-gap"
                style={{ left: `${totalGapLeft}%`, width: `${totalGapWidth}%` }}
              />
            </div>

            <input
              className="seg-dual-range seg-dual-range-start"
              type="range"
              min={0}
              max={Math.max(0, duration)}
              step={0.05}
              value={safeRange.start}
              onChange={e => {
                const nextStart = Number(e.target.value);
                emit({ startSec: Math.min(nextStart, safeRange.end) });
              }}
              aria-label="Início do trecho"
            />
            <input
              className="seg-dual-range seg-dual-range-end"
              type="range"
              min={0}
              max={Math.max(0, duration)}
              step={0.05}
              value={safeRange.end}
              onChange={e => {
                const nextEnd = Number(e.target.value);
                emit({ endSec: Math.max(nextEnd, safeRange.start) });
              }}
              aria-label="Fim do trecho"
            />
          </div>

          <div className="seg-actions seg-actions-transport">
            <button
              type="button"
              className="admin-btn"
              onClick={() => emit({ startSec: currentTime })}
              disabled={!duration}
            >
              MARCAR INÍCIO
            </button>

            <div className="seg-transport" role="group" aria-label="Controles de preview">
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  const p = playerRef.current;
                  if (!p?.seekTo) return;

                  if (isPlayingPreview) {
                    p.pauseVideo?.();
                    setIsPlayingPreview(false);
                    stopPreviewGuard();
                    return;
                  }

                  p.seekTo(safeRange.start + previewPos, true);
                  p.playVideo?.();
                  setIsPlayingPreview(true);
                  startTick();
                  startPreviewGuard();
                }}
                disabled={!duration || gapDuration <= 0.05}
              >
                {isPlayingPreview ? '❚❚' : '▶'}
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  const p = playerRef.current;
                  p?.pauseVideo?.();
                  p?.seekTo?.(safeRange.start, true);
                  setPreviewPos(0);
                  setIsPlayingPreview(false);
                  stopPreviewGuard();
                }}
                disabled={!duration}
              >
                ⏹
              </button>
            </div>

            <button
              type="button"
              className="admin-btn"
              onClick={() => emit({ endSec: currentTime })}
              disabled={!duration}
            >
              MARCAR FIM
            </button>
          </div>

          <div className="seg-row" style={{ marginTop: 12 }}>
            <div className="seg-title">Preview</div>
            <div className="seg-meta">{fmt(previewPos)} / {fmt(gapDuration)}</div>
          </div>

          <input
            className="seg-preview"
            type="range"
            min={0}
            max={Math.max(0, gapDuration)}
            step={0.05}
            value={previewPos}
            onChange={e => {
              const next = Number(e.target.value);
              setPreviewPos(next);
              const p = playerRef.current;
              if (p?.seekTo) p.seekTo(safeRange.start + next, true);
            }}
            disabled={!duration || gapDuration <= 0.05}
            aria-label="Scrubber do preview"
          />
        </div>
      )}
    </div>
  );
}
