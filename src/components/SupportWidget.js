import { useEffect, useState } from 'react';
import pixPng from '../assets/pix.png';
import PixPanel from './PixPanel';
import StripeWidget from './StripeWidget';

/**
 * SupportWidget — floating heart button + panel, igual ao App.js.
 * Props:
 *   isPt {boolean}
 */
export default function SupportWidget({ isPt = true }) {
  const [open,    setOpen]    = useState(false);
  const [closing, setClosing] = useState(false);
  const [view,    setView]    = useState(null); // null | 'pix' | 'stripe'

  const openPanel  = () => { setClosing(false); setOpen(true); };
  const closePanel = () => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); setView(null); }, 250);
  };
  const toggle = () => { if (open && !closing) closePanel(); else openPanel(); };

  useEffect(() => {
    if (!open || closing) return;
    function onDocClick(e) {
      if (!e.target.closest('.support-panel') && !e.target.closest('.support-fab')) {
        closePanel();
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing]);

  return (
    <div className="support-float">
      {open && (
        <div className={`support-panel${closing ? ' support-panel--out' : ''}${view === 'stripe' ? ' support-panel--wide' : ''}`}>
          {view === null && (
            <>
              <div className="support-panel-title">{isPt ? 'APOIE O PROJETO' : 'SUPPORT THE PROJECT'}</div>
              <button className="support-opt support-opt--pix" onClick={() => setView('pix')}>
                <img className="contact-pix-icon" src={pixPng} alt="" aria-hidden="true" />
                PIX
              </button>
              <button className="support-opt support-opt--stripe" onClick={() => setView('stripe')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                </svg>
                {isPt ? 'CARTÃO & OUTROS' : 'CARD & MORE'}
              </button>
              <a className="support-opt support-opt--bmc" href="#"
                onClick={(e) => { e.preventDefault(); const btn = document.querySelector('#bmc-wbtn'); if (btn) { btn.style.pointerEvents = 'auto'; btn.click(); btn.style.pointerEvents = 'none'; } }}>
                <img src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg" alt="" width="20" height="20" />
                BUY ME A COFFEE
              </a>
            </>
          )}
          {view === 'pix' && (
            <PixPanel isPt={isPt} onBack={() => setView(null)} onClose={closePanel} />
          )}
          {view === 'stripe' && (
            <>
              <button className="support-back" onClick={() => setView(null)} aria-label={isPt ? 'Voltar' : 'Back'}>‹</button>
              <button className="support-close" onClick={closePanel} aria-label={isPt ? 'Fechar' : 'Close'}>✕</button>
              <div className="support-panel-title">{isPt ? 'CARTÃO & OUTROS' : 'CARD & MORE'}</div>
              <StripeWidget isPt={isPt} onBack={() => setView(null)} />
            </>
          )}
        </div>
      )}
      <button className="support-fab" onClick={toggle}
        aria-label={isPt ? 'Apoiar o projeto' : 'Support the project'}
        aria-expanded={open && !closing}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden="true">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </button>
    </div>
  );
}
