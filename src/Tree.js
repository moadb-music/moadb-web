import { useState, useEffect } from 'react';
import './App.css';
import './Tree.css';
import defaultLogo from './assets/logo-mark.png';
import spotifyIcon from './assets/spotify.png';
import appleIcon from './assets/apple.png';
import deezerIcon from './assets/deezer.png';
import youtubeMusicIcon from './assets/youtube-music.png';
import youtubeIcon from './assets/youtube.png';
import instagramPng from './assets/instagram.png';
import tiktokIcon from './assets/tiktok.png';
import pixPng from './assets/pix.png';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import StripeWidget from './components/StripeWidget';
import PixPanel from './components/PixPanel';

const TREE_DOC_PATH = ['siteData', 'moadb_tree'];

const DEFAULT_LINKS = {
  spotify:      'https://open.spotify.com/intl-pt/artist/7zLPRu5akdcZHeDbVMm3o8',
  apple:        'https://music.apple.com/br/artist/mind-of-a-dead-body/1880815220',
  deezer:       'https://www.deezer.com/br/artist/375893561',
  youtubeMusic: 'https://music.youtube.com/channel/UCWuiRQ6qg-tMImAazjifIGg',
  instagram:    'https://www.instagram.com/mindofadeadbody',
  tiktok:       'https://www.tiktok.com/@mindofadeadbody',
  youtube:      'https://www.youtube.com/@mindofadeadbody',
  website:      '/',
};

const VALID_SIZES = ['xs','sm','md','lg','xl'];
function normalizeSize(v) { return VALID_SIZES.includes(String(v||'').trim()) ? String(v).trim() : 'md'; }
function normalizeI18n(value, fallback = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { pt: String(value.pt || fallback), en: String(value.en || fallback) };
  }
  const str = String(value || fallback);
  return { pt: str, en: str };
}

function normalizeTreeDoc(data) {
  const d = data?.content ?? data ?? {};
  return {
    headerImage: String(d.headerImage || ''),
    headerImageEnabled: d.headerImageEnabled !== false,
    headerImageSize: normalizeSize(d.headerImageSize),
    headerImageOpacity: typeof d.headerImageOpacity === 'number' ? Math.min(1, Math.max(0, d.headerImageOpacity)) : 1,
    title: normalizeI18n(d.title, 'MIND OF A DEAD BODY'),
    titleEnabled: d.titleEnabled !== false,
    titleSize: normalizeSize(d.titleSize),
    titleShadow: d.titleShadow !== false,
    titleOpacity: typeof d.titleOpacity === 'number' ? Math.min(1, Math.max(0, d.titleOpacity)) : 1,
    subtitle: normalizeI18n(d.subtitle, ''),
    subtitleEnabled: d.subtitleEnabled !== false,
    subtitleSize: normalizeSize(d.subtitleSize),
    subtitleShadow: d.subtitleShadow !== false,
    subtitleOpacity: typeof d.subtitleOpacity === 'number' ? Math.min(1, Math.max(0, d.subtitleOpacity)) : 1,
    headerOrder: Array.isArray(d.headerOrder) && d.headerOrder.length === 3 ? d.headerOrder : ['headerImage', 'title', 'subtitle'],
    footerImage: String(d.footerImage || ''),
    footerImageEnabled: d.footerImageEnabled !== false,
    footerImageSize: normalizeSize(d.footerImageSize),
    footerImageOpacity: typeof d.footerImageOpacity === 'number' ? Math.min(1, Math.max(0, d.footerImageOpacity)) : 1,
    links: {
      spotify:      String(d.links?.spotify      || DEFAULT_LINKS.spotify),
      apple:        String(d.links?.apple        || DEFAULT_LINKS.apple),
      deezer:       String(d.links?.deezer       || DEFAULT_LINKS.deezer),
      youtubeMusic: String(d.links?.youtubeMusic || DEFAULT_LINKS.youtubeMusic),
      instagram:    String(d.links?.instagram    || DEFAULT_LINKS.instagram),
      tiktok:       String(d.links?.tiktok       || DEFAULT_LINKS.tiktok),
      youtube:      String(d.links?.youtube      || DEFAULT_LINKS.youtube),
      website:      String(d.links?.website      || DEFAULT_LINKS.website),
    },
  };
}

const TEXT_SIZE = { xs: '0.75rem', sm: '1.1rem', md: '1.6rem', lg: '2.4rem', xl: '3.6rem' };
const TITLE_SIZE = TEXT_SIZE;
const SUBTITLE_SIZE = TEXT_SIZE;
const IMG_SIZE = { xs: '60px', sm: '120px', md: '200px', lg: '320px', xl: '440px' };
const FOOTER_IMG_SIZE = IMG_SIZE;


export default function Tree() {
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportClosing, setSupportClosing] = useState(false);
  const [supportView, setSupportView] = useState(null); // null | 'pix' | 'livepix'
  const [treeCfg, setTreeCfg] = useState(normalizeTreeDoc({}));

  useEffect(() => {
    const unsub = onSnapshot(doc(db, ...TREE_DOC_PATH), (snap) => {
      setTreeCfg(snap.exists() ? normalizeTreeDoc(snap.data()) : normalizeTreeDoc({}));
    }, () => {});
    return unsub;
  }, []);

  const openSupport = () => { setSupportClosing(false); setSupportOpen(true); };
  const closeSupport = () => {
    setSupportClosing(true);
    setTimeout(() => { setSupportOpen(false); setSupportClosing(false); setSupportView(null); }, 250);
  };
  const toggleSupport = () => { if (supportOpen && !supportClosing) closeSupport(); else openSupport(); };

  // fechar ao clicar fora
  useEffect(() => {
    if (!supportOpen || supportClosing) return;
    function onDocClick(e) {
      if (!e.target.closest('.support-panel') && !e.target.closest('.support-fab') && !e.target.closest('.tree-link--support')) {
        closeSupport();
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportOpen, supportClosing]);
  const [lang, setLang] = useState(() => {
    const nav = navigator.languages?.[0] || navigator.language || 'pt-BR';
    return nav.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  });
  const isPt = lang === 'pt';

  useEffect(() => {
    document.body.classList.add('tree-route');
    return () => document.body.classList.remove('tree-route');
  }, []);

  const links = treeCfg.links;

  const groups = isPt ? [
    { group: 'OUÇA', items: [
      { label: 'Spotify',       sub: 'Streaming',           href: links.spotify,      icon: spotifyIcon },
      { label: 'Apple Music',   sub: 'Streaming',           href: links.apple,        icon: appleIcon },
      { label: 'Deezer',        sub: 'Streaming',           href: links.deezer,       icon: deezerIcon },
      { label: 'YouTube Music', sub: 'Streaming',           href: links.youtubeMusic, icon: youtubeMusicIcon },
    ]},
    { group: 'SIGA', items: [
      { label: 'Instagram', sub: '@mindofadeadbody',  href: links.instagram, icon: instagramPng },
      { label: 'TikTok',    sub: '@mindofadeadbody',  href: links.tiktok,    icon: tiktokIcon },
      { label: 'YouTube',   sub: 'Vídeos e clipes',   href: links.youtube,   icon: youtubeIcon },
    ]},
    { group: 'SITE', items: [
      { label: 'Site Oficial', sub: 'mindofadeadbody.com', href: links.website, icon: null },
    ]},
  ] : [
    { group: 'LISTEN', items: [
      { label: 'Spotify',       sub: 'Streaming',     href: links.spotify,      icon: spotifyIcon },
      { label: 'Apple Music',   sub: 'Streaming',     href: links.apple,        icon: appleIcon },
      { label: 'Deezer',        sub: 'Streaming',     href: links.deezer,       icon: deezerIcon },
      { label: 'YouTube Music', sub: 'Streaming',     href: links.youtubeMusic, icon: youtubeMusicIcon },
    ]},
    { group: 'FOLLOW', items: [
      { label: 'Instagram', sub: '@mindofadeadbody', href: links.instagram, icon: instagramPng },
      { label: 'TikTok',    sub: '@mindofadeadbody', href: links.tiktok,    icon: tiktokIcon },
      { label: 'YouTube',   sub: 'Videos & clips',   href: links.youtube,   icon: youtubeIcon },
    ]},
    { group: 'WEBSITE', items: [
      { label: 'Official Website', sub: 'mindofadeadbody.com', href: links.website, icon: null },
    ]},
  ];

  return (
    <div className="tree-page">
      <div className="tree-inner">
        {(treeCfg.headerOrder || ['headerImage','title','subtitle']).map((id) => {
          if (id === 'headerImage' && treeCfg.headerImageEnabled) return (
            <div key="headerImage" style={{ marginBottom: 20, opacity: treeCfg.headerImageOpacity }}>
              <img
                className="tree-logo"
                src={treeCfg.headerImage || defaultLogo}
                alt="Mind of a Dead Body"
                style={{ width: IMG_SIZE[treeCfg.headerImageSize], height: IMG_SIZE[treeCfg.headerImageSize] }}
              />
            </div>
          );
          if (id === 'title' && treeCfg.titleEnabled) return (
            <h1 key="title" className="tree-name" style={{
              fontSize: TITLE_SIZE[treeCfg.titleSize],
              textShadow: treeCfg.titleShadow ? '6px 6px 0 #8b0000' : 'none',
              opacity: treeCfg.titleOpacity,
            }}>
              {(() => {
                const t = treeCfg.title[isPt ? 'pt' : 'en'] || treeCfg.title.pt || 'MIND OF A DEAD BODY';
                if (t.includes('\n')) return t.split('\n').map((line, i) => <span key={i}>{line}</span>);
                if (t.includes(' OF ') || t.includes(' of ')) {
                  const parts = t.split(/( OF | of )/);
                  return [<span key={0}>{parts[0] + (parts[1] || '')}</span>, <span key={1}>{parts.slice(2).join('')}</span>];
                }
                return <span>{t}</span>;
              })()}
            </h1>
          );
          if (id === 'subtitle' && treeCfg.subtitleEnabled) {
            const s = treeCfg.subtitle[isPt ? 'pt' : 'en'] || treeCfg.subtitle.pt || '';
            return s ? (
              <p key="subtitle" className="tree-subtitle" style={{
                fontSize: SUBTITLE_SIZE[treeCfg.subtitleSize],
                textShadow: treeCfg.subtitleShadow ? '3px 3px 0 #8b0000' : 'none',
                opacity: treeCfg.subtitleOpacity,
              }}>{s}</p>
            ) : null;
          }
          return null;
        })}

        {groups.map((group) => (
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
            onClick={toggleSupport}
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
        </div>

        {treeCfg.footerImage ? (
          <img
            src={treeCfg.footerImage}
            alt=""
            style={{ width: FOOTER_IMG_SIZE[treeCfg.footerImageSize], maxWidth: '100%', height: 'auto', borderRadius: 12, marginTop: 8, display: 'block', opacity: treeCfg.footerImageOpacity }}
          />
        ) : null}

        <div className="tree-divider" />
        <div className="tree-footer">© {new Date().getFullYear()} MIND OF A DEAD BODY</div>
      </div>

      {/* Widget de suporte flutuante — igual ao site principal */}
      <div className="support-float">
        {supportOpen && (
          <div className={`support-panel${supportClosing ? ' support-panel--out' : ''}${supportView === 'stripe' ? ' support-panel--wide' : ''}`}>
            {supportView === null && (
              <>
                <div className="support-panel-title">{isPt ? 'APOIE O PROJETO' : 'SUPPORT THE PROJECT'}</div>
                <button className="support-opt support-opt--pix" onClick={() => setSupportView('pix')}>
                  <img className="contact-pix-icon" src={pixPng} alt="" aria-hidden="true" />
                  PIX
                </button>
                <button className="support-opt support-opt--stripe" onClick={() => setSupportView('stripe')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                  {isPt ? 'CARTÃO & OUTROS' : 'CARD & MORE'}
                </button>
                <a
                  className="support-opt support-opt--bmc"
                  href="#"
                  onClick={(e) => { e.preventDefault(); const btn = document.querySelector('#bmc-wbtn'); if(btn){ btn.style.pointerEvents='auto'; btn.click(); btn.style.pointerEvents='none'; } }}
                >
                  <img src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg" alt="" width="20" height="20" />
                  BUY ME A COFFEE
                </a>
              </>
            )}
            {supportView === 'pix' && (
              <PixPanel isPt={isPt} onBack={() => setSupportView(null)} onClose={closeSupport} />
            )}
            {supportView === 'stripe' && (
              <>
                <button className="support-back" onClick={() => setSupportView(null)} aria-label="Voltar">‹</button>
                <button className="support-close" onClick={closeSupport} aria-label="Fechar">✕</button>
                <div className="support-panel-title">{isPt ? 'CARTÃO & OUTROS' : 'CARD & MORE'}</div>
                <StripeWidget isPt={isPt} onBack={() => setSupportView(null)} />
              </>
            )}
          </div>
        )}
        <button
          className="support-fab"
          onClick={toggleSupport}
          aria-label={isPt ? 'Apoiar o projeto' : 'Support the project'}
          aria-expanded={supportOpen && !supportClosing}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
