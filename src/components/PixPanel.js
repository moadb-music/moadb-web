import { useState } from 'react';
import pixQr from '../assets/pix-qr.png';

const PIX_KEY = 'd9c7d8b2-52f0-4709-a8d0-ca826b1b7def';

export default function PixPanel({ isPt, onBack, onClose }) {
  const [copied, setCopied] = useState(false);

  const copyKey = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  };

  return (
    <>
      <button className="support-back" onClick={onBack} aria-label="Voltar">‹</button>
      <button className="support-close" onClick={onClose} aria-label="Fechar">✕</button>
      <div className="support-panel-title">PIX</div>

      {copied ? (
        <div className="pix-copied-msg">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="#32BCAD" aria-hidden="true">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <p>{isPt ? 'Chave copiada!' : 'Key copied!'}</p>
          <p className="pix-copied-sub">
            {isPt
              ? 'Abra o app do seu banco, vá em PIX → Pagar → Chave e cole.'
              : 'Open your bank app, go to PIX → Pay → Key and paste.'}
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="contact-pix-qr-link pix-qr-btn"
            onClick={copyKey}
            title={isPt ? 'Clique para copiar a chave' : 'Click to copy key'}
          >
            <img
              className="contact-pix-qr"
              src={pixQr}
              alt="QR Code PIX"
            />
            <span className="pix-qr-overlay">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff" aria-hidden="true">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
              {isPt ? 'Copiar chave' : 'Copy key'}
            </span>
          </button>
          <div className="contact-pix-key-wrap">
            <span className="contact-pix-key-label">CHAVE PIX</span>
            <button type="button" className="contact-pix-copy" onClick={copyKey}>
              <span className="contact-pix-key-value">{PIX_KEY}</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
            </button>
          </div>
        </>
      )}
    </>
  );
}
