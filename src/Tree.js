import { useState, useEffect } from 'react';
import './Tree.css';
import logoPng from './assets/logo-mark.png';
import spotifyIcon from './assets/spotify.png';
import appleIcon from './assets/apple.png';
import deezerIcon from './assets/deezer.png';
import youtubeMusicIcon from './assets/youtube-music.png';
import youtubeIcon from './assets/youtube.png';
import instagramPng from './assets/instagram.png';
import tiktokIcon from './assets/tiktok.png';
import pixPng from './assets/pix.png';

const LINKS_PT = [
  {
    group: 'OUÇA',
    items: [
      { label: 'Spotify', sub: 'Streaming', href: 'https://open.spotify.com/intl-pt/artist/7zLPRu5akdcZHeDbVMm3o8', icon: spotifyIcon },
      { label: 'Apple Music', sub: 'Streaming', href: 'https://music.apple.com/br/artist/mind-of-a-dead-body/1880815220', icon: appleIcon },
      { label: 'Deezer', sub: 'Streaming', href: 'https://www.deezer.com/br/artist/375893561', icon: deezerIcon },
      { label: 'YouTube Music', sub: 'Streaming', href: 'https://music.youtube.com/channel/UCWuiRQ6qg-tMImAazjifIGg', icon: youtubeMusicIcon },
    ],
  },
  {
    group: 'SIGA',
    items: [
      { label: 'Instagram', sub: '@mindofadeadbody', href: 'https://www.instagram.com/mindofadeadbody', icon: instagramPng },
      { label: 'TikTok', sub: '@mindofadeadbody', href: 'https://www.tiktok.com/@mindofadeadbody', icon: tiktokIcon },
      { label: 'YouTube', sub: 'Vídeos e clipes', href: 'https://www.youtube.com/@mindofadeadbody', icon: youtubeIcon },
    ],
  },
  {
    group: 'SITE',
    items: [
      { label: 'Site Oficial', sub: 'mindofadeadbody.com', href: '/', icon: null },
    ],
  },
];
const LINKS_EN = [
  {
    group: 'LISTEN',
    items: [
      { label: 'Spotify', sub: 'Streaming', href: 'https://open.spotify.com/intl-pt/artist/7zLPRu5akdcZHeDbVMm3o8', icon: spotifyIcon },
      { label: 'Apple Music', sub: 'Streaming', href: 'https://music.apple.com/br/artist/mind-of-a-dead-body/1880815220', icon: appleIcon },
      { label: 'Deezer', sub: 'Streaming', href: 'https://www.deezer.com/br/artist/375893561', icon: deezerIcon },
      { label: 'YouTube Music', sub: 'Streaming', href: 'https://music.youtube.com/channel/UCWuiRQ6qg-tMImAazjifIGg', icon: youtubeMusicIcon },
    ],
  },
  {
    group: 'FOLLOW',
    items: [
      { label: 'Instagram', sub: '@mindofadeadbody', href: 'https://www.instagram.com/mindofadeadbody', icon: instagramPng },
      { label: 'TikTok', sub: '@mindofadeadbody', href: 'https://www.tiktok.com/@mindofadeadbody', icon: tiktokIcon },
      { label: 'YouTube', sub: 'Videos & clips', href: 'https://www.youtube.com/@mindofadeadbody', icon: youtubeIcon },
    ],
  },
  {
    group: 'WEBSITE',
    items: [
      { label: 'Official Website', sub: 'mindofadeadbody.com', href: '/', icon: null },
    ],
  },
];

function openBmcWidget() {
  const btn = document.querySelector('#bmc-wbtn');
  if (btn) btn.click();
}

export default function Tree() {
  const [supportOpen, setSupportOpen] = useState(false);
  const [showPix, setShowPix] = useState(false);
  const [lang, setLang] = useState(() => {
    const nav = navigator.languages?.[0] || navigator.language || 'pt-BR';
    return nav.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  });
  const isPt = lang === 'pt';

  useEffect(() => {
    document.body.classList.add('tree-route');
    return () => document.body.classList.remove('tree-route');
  }, []);

  return (
    <div className="tree-page">
      <div className="tree-inner">
        <img className="tree-logo" src={logoPng} alt="Mind of a Dead Body" />
        <h1 className="tree-name">
          <span>MIND OF A</span>
          <span>DEAD BODY</span>
        </h1>

        {(isPt ? LINKS_PT : LINKS_EN).map((group) => (
          <div key={group.group} className="tree-group">
            <div className="tree-group-label">{group.group}</div>
            {group.items.map((item) => (
              <a
                key={item.label}
                className="tree-link"
                href={item.href}
                target={item.href.startsWith('http') ? '_blank' : undefined}
                rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
              >
                {item.icon ? (
                  <img className="tree-link-icon" src={item.icon} alt="" aria-hidden="true" />
                ) : (
                  <span className="tree-link-icon--svg" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                  </span>
                )}
                <span className="tree-link-text">
                  {item.label}
                  {item.sub ? <span className="tree-link-sub">{item.sub}</span> : null}
                </span>
              </a>
            ))}
          </div>
        ))}

        {/* Botão de apoio */}
        <div className="tree-group">
          <div className="tree-group-label">{isPt ? 'APOIE' : 'SUPPORT'}</div>
          <button
            type="button"
            className="tree-link tree-link--support"
            onClick={() => { setSupportOpen((v) => !v); setShowPix(false); }}
          >
            <span className="tree-link-icon--svg" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </span>
            <span className="tree-link-text">
              {isPt ? 'Apoiar o Projeto' : 'Support the Project'}
              <span className="tree-link-sub">PIX · Buy Me a Coffee</span>
            </span>
          </button>

          {supportOpen && (
            <div className="tree-support-panel">
              {!showPix ? (
                <>
                  <button
                    type="button"
                    className="tree-link tree-link--pix"
                    onClick={() => setShowPix(true)}
                  >
                    <img className="tree-link-icon" src={pixPng} alt="" aria-hidden="true" style={{ filter: 'brightness(0) invert(1)' }} />
                    <span className="tree-link-text">PIX</span>
                  </button>
                  <button
                    type="button"
                    className="tree-link tree-link--bmc"
                    onClick={openBmcWidget}
                  >
                    <img
                      className="tree-link-icon"
                      src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg"
                      alt=""
                      aria-hidden="true"
                    />
                    <span className="tree-link-text">Buy Me a Coffee</span>
                  </button>
                </>
              ) : (
                <div className="tree-pix-panel">
                  <button className="tree-pix-back" onClick={() => setShowPix(false)}>{isPt ? '← VOLTAR' : '← BACK'}</button>
                  <a
                    href="https://nubank.com.br/cobrar/31oy9/69b56c23-57b5-4a7e-b7cf-4622fdddce9b"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      className="tree-pix-qr"
                      src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=d9c7d8b2-52f0-4709-a8d0-ca826b1b7def&bgcolor=0d0d0d&color=ffffff&margin=10"
                      alt="QR Code PIX"
                    />
                  </a>
                  <button
                    type="button"
                    className="tree-pix-copy"
                    onClick={() => navigator.clipboard.writeText('d9c7d8b2-52f0-4709-a8d0-ca826b1b7def')}
                  >
                    <span>d9c7d8b2-52f0-4709-a8d0-ca826b1b7def</span>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="tree-divider" />
        <div className="tree-footer">© {new Date().getFullYear()} MIND OF A DEAD BODY</div>
      </div>
    </div>
  );
}
