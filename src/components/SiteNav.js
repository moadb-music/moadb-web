import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import logoPng from '../assets/logo.png';

function FlagBR(props) {
  return (
    <svg viewBox="0 0 28 18" aria-hidden="true" {...props}>
      <rect width="28" height="18" fill="#009b3a" />
      <polygon points="14,2 26,9 14,16 2,9" fill="#ffdf00" />
      <circle cx="14" cy="9" r="4" fill="#002776" />
      <path d="M10 8.5c1.8-.8 5.4-.8 8 .1" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function FlagUK(props) {
  return (
    <svg viewBox="0 0 28 18" aria-hidden="true" {...props}>
      <rect width="28" height="18" fill="#012169" />
      <path d="M0 0L28 18M28 0L0 18" stroke="#fff" strokeWidth="5" />
      <path d="M0 0L28 18M28 0L0 18" stroke="#C8102E" strokeWidth="2.5" />
      <path d="M14 0v18M0 9h28" stroke="#fff" strokeWidth="6" />
      <path d="M14 0v18M0 9h28" stroke="#C8102E" strokeWidth="3" />
    </svg>
  );
}

const NAV_SECTIONS_PT = [
  { key: 'home',        href: '/#inicio',     label: 'INÍCIO' },
  { key: 'sobre',       href: '/#sobre',      label: 'SOBRE' },
  { key: 'loja',        href: '/#loja',       label: 'LOJA' },
  { key: 'noticias',    href: '/#noticias',   label: 'NOTÍCIAS' },
  { key: 'discografia', href: '/#discografia',label: 'DISCOGRAFIA' },
  { key: 'contato',     href: '/#contato',    label: 'CONTATO' },
];
const NAV_SECTIONS_EN = [
  { key: 'home',        href: '/#inicio',     label: 'HOME' },
  { key: 'sobre',       href: '/#sobre',      label: 'ABOUT' },
  { key: 'loja',        href: '/#loja',       label: 'STORE' },
  { key: 'noticias',    href: '/#noticias',   label: 'NEWS' },
  { key: 'discografia', href: '/#discografia',label: 'DISCOGRAPHY' },
  { key: 'contato',     href: '/#contato',    label: 'CONTACT' },
];

/**
 * SiteNav — nav idêntica ao site principal, reutilizável em qualquer página.
 *
 * Props:
 *   lang      {string}   'pt-BR' | 'en'
 *   setLang   {function} setter do lang
 *   extraEnd  {node}     elemento extra no lado direito (ex: botão SAIR)
 */
export default function SiteNav({ lang, setLang, extraEnd }) {
  const isPt = lang === 'pt-BR';
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [pagesContent, setPagesContent] = useState(null);
  const langRef = useRef(null);

  // Lê ordem e visibilidade das seções do Firestore (igual ao App.js)
  useEffect(() => {
    return onSnapshot(doc(db, 'siteData', 'moadb_pages'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPagesContent(d?.content ?? d);
      }
    });
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (!langRef.current) return;
      if (!langRef.current.contains(e.target)) setLangOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setLangOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Monta links respeitando sectionOrder e visibilidade — igual ao App.js
  function buildLinks() {
    const order = Array.isArray(pagesContent?.sectionOrder) ? pagesContent.sectionOrder : [];
    const visible = pagesContent?.backgroundsBySection ?? {};
    const isVisible = (key) => visible[key]?.visible !== false;
    const NAV_SECTIONS = isPt ? NAV_SECTIONS_PT : NAV_SECTIONS_EN;
    const navMap = new Map(NAV_SECTIONS.map((s) => [s.key, s]));
    const ordered = order
      .filter((k) => k !== 'main' && navMap.has(k) && isVisible(k))
      .map((k) => navMap.get(k));
    const missing = NAV_SECTIONS.filter((s) => !order.includes(s.key) && isVisible(s.key));
    return [...ordered, ...missing];
  }

  const links = buildLinks();

  return (
    <>
      <nav className="top-nav" aria-label={isPt ? 'Navegação principal' : 'Main navigation'}>
        <a className="nav-logo-wrap" href="/" aria-label={isPt ? 'Ir para Início' : 'Go to Home'}>
          <img className="nav-logo" src={logoPng} alt="Mind of a Dead Body" />
        </a>

        {/* Desktop links */}
        <div className="nav-links nav-links--desktop" role="navigation">
          {links.map((l) => <a key={l.key} href={l.href}>{l.label}</a>)}
          <a href="/donate">{isPt ? 'APOIAR' : 'SUPPORT'}</a>
          <a href="/members" style={{ color: 'var(--red,#8b0000)' }}>{isPt ? 'MEMBROS' : 'MEMBERS'}</a>
        </div>

        {/* Lang dropdown — desktop */}
        <div className="lang-dropdown lang-dropdown--desktop" ref={langRef}>
          <button className="lang-dropdown-toggle" type="button" aria-haspopup="menu" aria-expanded={langOpen}
            onClick={() => setLangOpen(v => !v)}>
            <span className="lang-flag" aria-hidden="true">{isPt ? <FlagBR /> : <FlagUK />}</span>
            <span className="lang-arrow" aria-hidden="true">▼</span>
          </button>
          {langOpen && (
            <ul className="lang-dropdown-menu" role="menu" aria-label={isPt ? 'Selecionar idioma' : 'Select language'}>
              <li>
                <button type="button" className={`lang-dropdown-item${isPt ? ' active' : ''}`} role="menuitem"
                  onClick={() => { setLang('pt-BR'); setLangOpen(false); }}>
                  <span className="lang-flag" aria-hidden="true"><FlagBR /></span>
                  <span>Português</span>
                </button>
              </li>
              <li>
                <button type="button" className={`lang-dropdown-item${!isPt ? ' active' : ''}`} role="menuitem"
                  onClick={() => { setLang('en'); setLangOpen(false); }}>
                  <span className="lang-flag" aria-hidden="true"><FlagUK /></span>
                  <span>English</span>
                </button>
              </li>
            </ul>
          )}
        </div>

        {/* Slot extra (ex: botão SAIR) — desktop */}
        {extraEnd && <div className="site-nav-extra">{extraEnd}</div>}

        {/* Hamburger — mobile */}
        <button className={`nav-hamburger${menuOpen ? ' is-open' : ''}`} type="button"
          aria-label={menuOpen ? (isPt ? 'Fechar menu' : 'Close menu') : (isPt ? 'Abrir menu' : 'Open menu')}
          aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="nav-mobile-menu" role="navigation" aria-label="Menu">
          {links.map((l) => (
            <a key={l.key} href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</a>
          ))}
          <a href="/donate" onClick={() => setMenuOpen(false)}>{isPt ? 'APOIAR' : 'SUPPORT'}</a>
          <a href="/members" style={{ color: 'var(--red,#8b0000)' }} onClick={() => setMenuOpen(false)}>
            {isPt ? 'MEMBROS' : 'MEMBERS'}
          </a>
          <div className="nav-mobile-lang">
            <button type="button" className={`nav-mobile-lang-btn${isPt ? ' active' : ''}`}
              onClick={() => { setLang('pt-BR'); setMenuOpen(false); }}>
              <span className="lang-flag"><FlagBR /></span> PT
            </button>
            <button type="button" className={`nav-mobile-lang-btn${!isPt ? ' active' : ''}`}
              onClick={() => { setLang('en'); setMenuOpen(false); }}>
              <span className="lang-flag"><FlagUK /></span> EN
            </button>
          </div>
          {/* Slot extra no drawer (ex: botão SAIR) */}
          {extraEnd && <div style={{ padding: '4px 16px 16px' }}>{extraEnd}</div>}
        </div>
      )}
    </>
  );
}
