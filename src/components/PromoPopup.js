import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const STORAGE_KEY = '_moadb_promo_never';

function isNeverShow(promo) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const { cupom, expiraEm } = JSON.parse(stored);
    return cupom === promo.cupom && expiraEm === promo.expiraEm;
  } catch { return false; }
}

function setNeverShow(promo) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cupom: promo.cupom || '',
      expiraEm: promo.expiraEm || '',
    }));
  } catch {}
}

// ── renderiza markdown simples: **negrito**, *itálico*, ~~tachado~~, \n → <br>
export function renderPromoText(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/\n/g, '<br>');
}

function useCountdown(expiraEm) {
  const getRemaining = useCallback(() => {
    if (!expiraEm) return null;
    const end = new Date(expiraEm + 'T23:59:59').getTime();
    const diff = end - Date.now();
    if (diff <= 0) return null;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { d, h, m, s };
  }, [expiraEm]);

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    setRemaining(getRemaining());
    const id = setInterval(() => setRemaining(getRemaining()), 1000);
    return () => clearInterval(id);
  }, [getRemaining]);

  return remaining;
}

function CountdownUnit({ value, label }) {
  return (
    <div className="promo-countdown-unit">
      <span className="promo-countdown-num">{String(value).padStart(2, '0')}</span>
      <span className="promo-countdown-label">{label}</span>
    </div>
  );
}

export default function PromoPopup({ lang }) {
  const [promo, setPromo] = useState(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmNever, setConfirmNever] = useState(false);
  const isPt = lang === 'pt-BR';

  useEffect(() => {
    let timer = null;
    const unsub = onSnapshot(doc(db, 'siteData', 'moadb_promo'), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (!d.ativa) return;
      if (!d.titulo && !d.cupom) return;
      if (d.expiraEm) {
        const end = new Date(d.expiraEm + 'T23:59:59');
        if (end < new Date()) return;
      }
      if (isNeverShow(d)) return;
      setPromo(d);
      timer = setTimeout(() => setVisible(true), 800);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const remaining = useCountdown(promo?.expiraEm);

  function dismiss() {
    setVisible(false);
    setConfirmNever(false);
  }

  function neverShow() {
    if (promo) setNeverShow(promo);
    setVisible(false);
    setConfirmNever(false);
  }

  async function copyCupom() {
    if (!promo?.cupom) return;
    try {
      await navigator.clipboard.writeText(promo.cupom);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = promo.cupom;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  if (!promo || !visible) return null;

  return (
    <div className="promo-backdrop" role="dialog" aria-modal="true" aria-label={promo.titulo} onClick={dismiss}>
      <div className="promo-popup" onClick={e => e.stopPropagation()}>

        {/* fechar */}
        <button type="button" className="promo-close" onClick={dismiss} aria-label={isPt ? 'Fechar' : 'Close'}>
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

        {/* badge */}
        <div className="promo-badge">{isPt ? '🎉 PROMOÇÃO' : '🎉 PROMO'}</div>

        {/* título */}
        <h2 className="promo-title">{promo.titulo}</h2>

        {/* texto */}
        {promo.texto && (
          <p className="promo-text"
            dangerouslySetInnerHTML={{ __html: renderPromoText(promo.texto) }}
          />
        )}

        {/* cupom */}
        {promo.cupom && (
          <button type="button" className={`promo-cupom${copied ? ' is-copied' : ''}`} onClick={copyCupom}>
            <span className="promo-cupom-code">{promo.cupom}</span>
            <span className="promo-cupom-action">
              {copied
                ? (isPt ? '✓ Copiado!' : '✓ Copied!')
                : (isPt ? 'Copiar' : 'Copy')}
            </span>
          </button>
        )}

        {/* contagem regressiva */}
        {remaining && (
          <div className="promo-countdown">
            <div className="promo-countdown-label-top">
              {isPt ? 'Termina em' : 'Ends in'}
            </div>
            <div className="promo-countdown-units">
              {remaining.d > 0 && <CountdownUnit value={remaining.d} label={isPt ? 'dias' : 'days'} />}
              <CountdownUnit value={remaining.h} label={isPt ? 'horas' : 'hours'} />
              <CountdownUnit value={remaining.m} label={isPt ? 'min' : 'min'} />
              <CountdownUnit value={remaining.s} label={isPt ? 'seg' : 'sec'} />
            </div>
          </div>
        )}

        {/* ações */}
        {confirmNever ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '10px 0 2px', borderTop: '1px solid rgba(255,255,255,.07)', width: '100%',
          }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '.75rem', color: 'rgba(255,255,255,.55)' }}>
              {isPt ? 'Não exibir mais esta promoção?' : 'Never show this promotion again?'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="promo-dismiss" onClick={() => setConfirmNever(false)}>
                {isPt ? 'Cancelar' : 'Cancel'}
              </button>
              <button type="button" className="promo-dismiss" style={{ color: 'rgba(255,100,100,.7)' }} onClick={neverShow}>
                {isPt ? 'Sim, não exibir mais' : 'Yes, never show again'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button type="button" className="promo-dismiss" onClick={dismiss}>
              {isPt ? 'Fechar' : 'Close'}
            </button>
            <button type="button" className="promo-dismiss" style={{ opacity: .5 }} onClick={() => setConfirmNever(true)}>
              {isPt ? 'Não exibir mais' : 'Don\'t show again'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
