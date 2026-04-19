import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { trackPageView } from './analytics';
import { useNavigate, useParams, Routes, Route } from 'react-router-dom';
import logoPng from './assets/logo.png';
import PromoPopup from './components/PromoPopup';
import './App.css';
import './Loja.css';

// ─── flags (igual ao SiteNav) ─────────────────────────────────────────────────

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

// ─── nav da loja ──────────────────────────────────────────────────────────────

const SITE_LINKS_PT = [
  { href: '/#inicio',      label: 'INÍCIO' },
  { href: '/#sobre',       label: 'SOBRE' },
  { href: '/#loja',        label: 'LOJA' },
  { href: '/#noticias',    label: 'NOTÍCIAS' },
  { href: '/#discografia', label: 'DISCOGRAFIA' },
  { href: '/#contato',     label: 'CONTATO' },
  { href: '/donate',       label: 'APOIAR' },
  { href: '/members',      label: 'MEMBROS' },
];
const SITE_LINKS_EN = [
  { href: '/#inicio',      label: 'HOME' },
  { href: '/#sobre',       label: 'ABOUT' },
  { href: '/#loja',        label: 'STORE' },
  { href: '/#noticias',    label: 'NEWS' },
  { href: '/#discografia', label: 'DISCOGRAPHY' },
  { href: '/#contato',     label: 'CONTACT' },
  { href: '/donate',       label: 'SUPPORT' },
  { href: '/members',      label: 'MEMBERS' },
];

function LojaNav({ lang, setLang, backHref, storeUrl, filterProps, categorias }) {
  const navigate = useNavigate();
  const isPt = lang === 'pt-BR';
  const [langOpen, setLangOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const langRef = useRef(null);
  const siteLinks = isPt ? SITE_LINKS_PT : SITE_LINKS_EN;

  // fecha ao clicar fora ou pressionar Escape
  useEffect(() => {
    function onDocClick(e) {
      if (!langRef.current?.contains(e.target)) setLangOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') { setLangOpen(false); setMenuOpen(false); }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="loja-nav-wrapper">
      <header className="loja-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* seta — só mobile */}
          <button
            type="button"
            className="loja-nav-back-btn loja-nav-back-mobile"
            onClick={() => navigate(-1)}
            aria-label={isPt ? 'Voltar' : 'Back'}
          >
            <svg viewBox="0 0 16 16" fill="none" width="20" height="20" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* logo — só desktop, com confirmação */}
          <button
            type="button"
            className="loja-nav-site-link loja-nav-logo-desktop"
            onClick={() => {
              const msg = isPt ? 'Tem certeza que deseja sair da loja?' : 'Are you sure you want to leave the store?';
              if (window.confirm(msg)) window.location.href = 'https://mindofadeadbody.com.br';
            }}
            aria-label="mindofadeadbody.com.br"
          >
            <img
              src={`${process.env.PUBLIC_URL}/logo.png`}
              alt=""
              className="loja-nav-site-logo"
            />
          </button>
        </div>

        {/* direita: hamburguer (mobile) */}
        <div className="loja-nav-right">
          {/* hamburguer — mobile only */}
          <button
            type="button"
            className={`loja-hamburger${menuOpen ? ' is-open' : ''}`}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* disclaimer — fixo abaixo do nav no desktop */}
      {storeUrl && (
        <div className="loja-disclaimer loja-disclaimer--fixed" role="note">
          <svg className="loja-disclaimer-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M10 9v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="10" cy="6.5" r=".8" fill="currentColor"/>
          </svg>
          <span className="loja-disclaimer-text">
            {isPt ? (
              <>Este site é um <strong>mostruário</strong> — todas as compras são finalizadas na{' '}
              <strong>Hotprinti</strong>, plataforma de print on demand parceira.
              Os itens são produzidos sob demanda e enviados diretamente por eles.</>
            ) : (
              <>This site is a <strong>showcase</strong> — all purchases are completed on{' '}
              <strong>Hotprinti</strong>, our print on demand partner platform.
              Items are produced on demand and shipped directly by them.</>
            )}
          </span>
          <a className="loja-disclaimer-link" href={storeUrl} target="_blank" rel="noreferrer">
            {isPt ? 'Ir para a loja ↗' : 'Go to store ↗'}
          </a>
        </div>
      )}

      {/* drawer mobile */}
      {menuOpen && (
        <div className="loja-mobile-drawer" role="dialog" aria-modal="true" aria-label={isPt ? 'Menu' : 'Menu'}>

          {/* categorias da loja */}
          {categorias && categorias.length > 0 && filterProps && (
            <>
              {/* busca — primeiro */}
              <div className="loja-drawer-search-wrap">
                <svg className="loja-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  type="search"
                  className="loja-search"
                  value={filterProps.search}
                  onChange={(e) => { filterProps.setSearch(e.target.value); navigate('/loja'); }}
                  placeholder={isPt ? 'Buscar produto…' : 'Search product…'}
                  aria-label={isPt ? 'Buscar produto' : 'Search product'}
                  style={{ width: '100%' }}
                />
                {filterProps.search && (
                  <button type="button" className="loja-search-clear" onClick={() => filterProps.setSearch('')} aria-label="Limpar">×</button>
                )}
              </div>

              <div className="loja-drawer-divider" />
              <div className="loja-drawer-section-label">{isPt ? 'CATEGORIAS' : 'CATEGORIES'}</div>

              {/* Lançamentos */}
              <button
                type="button"
                className={`loja-drawer-link loja-drawer-cat${filterProps.catFilter === 'all' ? ' is-active' : ''}`}
                onClick={() => { filterProps.selectCat('all'); navigate('/loja'); setMenuOpen(false); }}
              >
                {isPt ? 'Lançamentos' : 'New Arrivals'}
              </button>

              {/* Categorias com subcategorias sempre expandidas */}
              {categorias.map(cat => {
                const subcats = filterProps.subcatMap?.[cat] || [];
                const isActive = filterProps.catFilter === cat;

                return (
                  <div key={cat}>
                    {/* categoria — clicável, filtra por categoria */}
                    <button
                      type="button"
                      className={`loja-drawer-link loja-drawer-cat${isActive && filterProps.subcatFilter === 'all' ? ' is-active' : ''}`}
                      onClick={() => { filterProps.selectCat(cat); navigate('/loja'); setMenuOpen(false); }}
                    >
                      {cat}
                    </button>

                    {/* subcategorias — indentadas abaixo */}
                    {subcats.map(sub => (
                      <button
                        key={sub}
                        type="button"
                        className={`loja-drawer-link loja-drawer-subcat${isActive && filterProps.subcatFilter === sub ? ' is-active' : ''}`}
                        onClick={() => { filterProps.selectCatSubcat(cat, sub); navigate('/loja'); setMenuOpen(false); }}
                      >
                        {formatSubcat(sub)}
                      </button>
                    ))}
                  </div>
                );
              })}
            </>
          )}

          {/* idioma removido — loja usa idioma do browser */}

          {/* voltar ao site — no final do drawer */}
          <div className="loja-drawer-divider" style={{ marginTop: 'auto' }} />
          <button
            type="button"
            className="loja-drawer-link"
            style={{ color: 'rgba(255,255,255,.3)', fontSize: '.75rem', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => {
              const msg = isPt ? 'Tem certeza que deseja sair da loja?' : 'Are you sure you want to leave the store?';
              if (window.confirm(msg)) { setMenuOpen(false); window.location.href = 'https://mindofadeadbody.com.br'; }
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" width="13" height="13" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {isPt ? '← mindofadeadbody.com.br' : '← mindofadeadbody.com.br'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function LojaDisclaimer({ isPt, storeUrl }) {
  if (!storeUrl) return null;
  return (
    <div className="loja-disclaimer loja-disclaimer--inline" role="note">
      <svg className="loja-disclaimer-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M10 9v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="10" cy="6.5" r=".8" fill="currentColor"/>
      </svg>
      <span className="loja-disclaimer-text">
        {isPt
          ? <>Mostruário — compras na <strong>Hotprinti</strong>.</>
          : <>Showcase — purchases on <strong>Hotprinti</strong>.</>}
      </span>
      <a className="loja-disclaimer-link" href={storeUrl} target="_blank" rel="noreferrer">
        {isPt ? 'Ir para a loja ↗' : 'Go to store ↗'}
      </a>
    </div>
  );
}


function isInAppWebView() {
  const ua = navigator.userAgent || '';
  return /Instagram|FBAN|FBAV|FB_IAB|TikTok|BytedanceWebview|Twitter|Snapchat/i.test(ua);
}

function openPlatformLink(webUrl) {
  if (!webUrl) return;
  if (!isInAppWebView()) { window.open(webUrl, '_blank', 'noreferrer'); return; }
  window.open(webUrl, '_blank', 'noreferrer');
}

function normalizeShopFromDb(data) {
  const d = data || {};
  const content = d.content && typeof d.content === 'object' ? d.content : {};
  const rawItems = Array.isArray(content.items) ? content.items : [];
  return {
    storeUrl: String(content.storeUrl || content.url || d.storeUrl || d.url || ''),
    items: rawItems
      .map((it, idx) => ({
        id: String(it?.id || idx),
        title: String(it?.title || it?.name || ''),
        href: String(it?.url || it?.productUrl || it?.href || it?.link || ''),
        images: Array.isArray(it?.images) && it.images.length
          ? it.images.map(String).filter(Boolean)
          : (it?.imageUrl ? [String(it.imageUrl)] : []),
        bgColor: String(it?.bgColor || ''),
        categoria: String(it?.categoria || ''),
        subcategoria: String(it?.subcategoria || ''),
        cor: String(it?.cor || ''),
        printSide: String(it?.printSide || ''),
        printType: String(it?.printType || ''),
        printSizes: {
          frente: String(it?.printSizes?.frente || ''),
          costas: String(it?.printSizes?.costas || ''),
          ladoD:  String(it?.printSizes?.ladoD  || ''),
          ladoE:  String(it?.printSizes?.ladoE  || ''),
        },
        descricao: String(it?.descricao || ''),
        edicaoEspecial: it?.edicaoEspecial === true,
      }))
      .filter((it) => it.title || it.images.length || it.href),
  };
}

const PRINT_INFO = {
  pt: {
    DTG: {
      label: 'DTG',
      fullName: 'Direct to Garment',
      desc: 'A tinta é aplicada diretamente na malha com jato de tinta especializado. Resultado suave ao toque, cores vibrantes e produção rápida.',
      prazo: null,
    },
    DTF: {
      label: 'DTF',
      fullName: 'Direct to Film',
      desc: 'A estampa é impressa em filme e transferida para a peça com calor. Alta durabilidade, bordas nítidas e excelente cobertura em qualquer cor de tecido.',
      prazo: '⚠ Impressão DTF pode levar mais tempo para ser produzida.',
    },
  },
  en: {
    DTG: {
      label: 'DTG',
      fullName: 'Direct to Garment',
      desc: 'Ink is applied directly onto the fabric using a specialized inkjet printer. Soft feel, vibrant colors and fast production.',
      prazo: null,
    },
    DTF: {
      label: 'DTF',
      fullName: 'Direct to Film',
      desc: 'The design is printed on film and heat-transferred onto the garment. High durability, sharp edges and great coverage on any fabric color.',
      prazo: '⚠ DTF printing may take longer to produce.',
    },
  },
};

function formatSubcat(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// mapa de nomes de cor em PT/EN → valor CSS
const COR_MAP = {
  preto: '#111', black: '#111',
  branco: '#fff', white: '#fff',
  cinza: '#888', gray: '#888', grey: '#888',
  'cinza mescla': '#999', 'heather gray': '#999',
  vermelho: '#c0392b', red: '#c0392b',
  azul: '#1a5276', blue: '#1a5276',
  'azul marinho': '#0d2b55', navy: '#0d2b55',
  verde: '#1e8449', green: '#1e8449',
  amarelo: '#f1c40f', yellow: '#f1c40f',
  laranja: '#e67e22', orange: '#e67e22',
  roxo: '#6c3483', purple: '#6c3483',
  rosa: '#e91e8c', pink: '#e91e8c',
  bege: '#d4b896', beige: '#d4b896',
  marrom: '#6d4c41', brown: '#6d4c41',
  vinho: '#6b1a2a', burgundy: '#6b1a2a',
  chumbo: '#4a4a4a',
};

function corParaCss(cor) {
  if (!cor) return null;
  const key = String(cor).toLowerCase().trim();
  if (COR_MAP[key]) return COR_MAP[key];
  // se já for hex ou rgb, usa direto
  if (/^#[0-9a-f]{3,8}$/i.test(key) || /^rgb/.test(key)) return cor;
  return null;
}

// ─── hook de dados ────────────────────────────────────────────────────────────

function useIsMobile(breakpoint = 600) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

function useShopData() {
  const [shopCfg, setShopCfg] = useState({ storeUrl: '', items: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'siteData', 'moadb_shop'),
      (snap) => { setShopCfg(normalizeShopFromDb(snap.exists() ? snap.data() : {})); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, []);
  return { shopCfg, loading };
}

// ─── bg da página ────────────────────────────────────────────────────────────
// Tenta carregar store-bg.jpg; se não existir, o CSS define o fallback cinza escuro
const PAGE_BG = {
  backgroundImage: `url(${process.env.PUBLIC_URL}/images/store-bg.jpg)`,
  backgroundSize: 'cover',
  backgroundPosition: 'center top',
  backgroundAttachment: 'fixed',
};

// bg do banner — aplicado via style para usar PUBLIC_URL corretamente
const BANNER_BG_STYLE = {
  backgroundImage: `url(${process.env.PUBLIC_URL}/images/banner.jpg)`,
};

// ─── card do catálogo com troca de imagem ────────────────────────────────────

function LojaCard({ item, isPt, onClick }) {
  const [activeImg, setActiveImg] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const hasMultiple = item.images.length > 1;
  const touchStartX = useRef(null);

  // reset loaded quando muda de imagem
  function switchImg(idx) {
    const next = ((idx % item.images.length) + item.images.length) % item.images.length;
    if (next === activeImg) return;
    setLoaded(false);
    setActiveImg(next);
  }

  // toque no card: troca imagem (não navega)
  function handleCardClick(e) {
    if (!hasMultiple) return;
    // se foi um swipe, não faz nada (já tratado no touchEnd)
    if (touchStartX.current !== null) return;
    switchImg(activeImg + 1);
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (!hasMultiple) return;
    if (Math.abs(dx) < 30) {
      // tap curto — troca para próxima imagem
      switchImg(activeImg + 1);
    } else if (dx < 0) {
      switchImg(activeImg + 1);
    } else {
      switchImg(activeImg - 1);
    }
  }

  return (
    <div
      className="loja-card-outer"
      onMouseEnter={() => { if (hasMultiple) switchImg(1); }}
      onMouseLeave={() => { setActiveImg(0); setLoaded(false); }}
    >
      {/* área da imagem — clique/swipe troca imagem no mobile */}
      <div
        className="loja-card-img-wrap"
        style={{ background: item.bgColor || '#0a0a0a' }}
        onClick={handleCardClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {item.images[activeImg] ? (
          <>
            <img
              key={item.images[activeImg]}
              src={item.images[activeImg]}
              alt={item.title}
              className={`loja-card-img${loaded ? ' is-loaded' : ''}`}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
            />
            {!loaded && (
              <div className="loja-card-img-spinner" aria-hidden="true">
                <span className="loja-spinner" />
              </div>
            )}
          </>
        ) : (
          <div className="loja-card-img-empty" />
        )}

        {item.printType && (
          <span className="loja-card-print-badge">{item.printType}</span>
        )}
        {item.edicaoEspecial && (
          <span className="loja-card-special-badge">✦ ED. ESPECIAL</span>
        )}

        {hasMultiple && (
          <div className="loja-card-dots">
            {item.images.map((_, idx) => (
              <span
                key={idx}
                className={`loja-card-dot${activeImg === idx ? ' is-active' : ''}`}
                onMouseEnter={(e) => { e.stopPropagation(); switchImg(idx); }}
                onClick={(e) => { e.stopPropagation(); switchImg(idx); }}
                role="presentation"
              />
            ))}
          </div>
        )}
      </div>

      {/* info — não navega */}
      <div className="loja-card-body">
        {item.subcategoria && (
          <div className="loja-card-sub">{formatSubcat(item.subcategoria)}</div>
        )}
        <div className="loja-card-title">{item.title}</div>
        {item.cor && <div className="loja-card-cor">{item.cor}</div>}
      </div>

      {/* cta — único elemento que navega */}
      <button
        type="button"
        className="loja-card-cta"
        onClick={onClick}
        aria-label={`${isPt ? 'Ver produto' : 'View product'}: ${item.title}`}
      >
        <span>{isPt ? 'VER PRODUTO' : 'VIEW PRODUCT'}</span>
        <span className="loja-card-cta-arrow">→</span>
      </button>
    </div>
  );
}

// ─── catálogo (/loja) ─────────────────────────────────────────────────────────

function LojaCatalogo({ shopCfg, loading, lang, setLang, storeUrl, filterProps, hasSubbar, navCategorias }) {
  const navigate = useNavigate();
  const isPt = lang === 'pt-BR';
  const items = useMemo(() => shopCfg.items || [], [shopCfg]);
  const isMobile = useIsMobile();

  const { catFilter, subcatFilter, search, categorias, subcatMap, selectCatSubcat } = filterProps;

  const filtered = useMemo(() => {
    let list = catFilter === 'all' ? items : items.filter((i) => i.categoria === catFilter);
    if (subcatFilter !== 'all') {
      list = list.filter((i) => i.subcategoria === subcatFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.subcategoria.toLowerCase().includes(q) ||
        i.cor.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, catFilter, subcatFilter, search]);

  useEffect(() => { trackPageView('loja'); }, []);

  return (
    <div className={`loja-page${hasSubbar ? ' has-subbar' : ''}`} style={PAGE_BG}>
      <LojaNav lang={lang} setLang={setLang} storeUrl={storeUrl} filterProps={filterProps} categorias={navCategorias} />

      <main className="loja-main">
        <LojaDisclaimer isPt={isPt} storeUrl={storeUrl} />
        <div className="loja-banner">
          <div className="loja-banner-bg" style={BANNER_BG_STYLE} />
          <div className="loja-banner-content">
            <div className="loja-banner-eyebrow">Mind of a Dead Body</div>
            <div className="loja-banner-title">
              {isPt ? 'LOJA' : 'STORE'}
              <span className="loja-banner-title-outline">
                {isPt ? 'OFICIAL' : 'OFFICIAL'}
              </span>
            </div>
          </div>
        </div>

        {/* ── grid de produtos ── */}
        <div className="loja-catalog-section">

          {/* meta: só count, sem loja oficial aqui */}
          <div className="loja-catalog-meta">
            <span className="loja-catalog-count">
              <strong>{filtered.length}</strong>
              {' '}{filtered.length === 1
                ? (isPt ? 'produto' : 'product')
                : (isPt ? 'produtos' : 'products')}
              {catFilter !== 'all'
                ? <span className="loja-catalog-count-tag">{catFilter}</span>
                : <span className="loja-catalog-count-tag">{isPt ? 'Lançamentos' : 'New Arrivals'}</span>}
              {subcatFilter !== 'all'
                ? <span className="loja-catalog-count-tag">{formatSubcat(subcatFilter)}</span>
                : null}
              {search
                ? <span className="loja-catalog-count-tag">"{search}"</span>
                : null}
            </span>
          </div>

          {loading ? (
            <div className="loja-loading">{isPt ? 'Carregando…' : 'Loading…'}</div>
          ) : filtered.length === 0 ? (
            <div className="loja-empty">{isPt ? 'Nenhum produto encontrado.' : 'No products found.'}</div>
          ) : catFilter === 'all' && !search ? (
            /* ── Lançamentos: agrupa por subcategoria ── */
            (() => {
              const subcatsOrdered = [
                ...new Set(filtered.map((i) => i.subcategoria).filter(Boolean))
              ];
              const semSubcat = filtered.filter((i) => !i.subcategoria);

              return (
                <>
                  {/* ── seções por subcategoria ── */}
                  {subcatsOrdered.map((sub) => {
                    const subItems = filtered.filter((i) => i.subcategoria === sub);
                    if (!subItems.length) return null;
                    const cat = subItems[0].categoria;
                    const MOBILE_LIMIT = 5;
                    const displayItems = isMobile ? subItems.slice(0, MOBILE_LIMIT) : subItems;
                    const hasMore = isMobile && subItems.length > MOBILE_LIMIT;
                    return (
                      <div key={sub} className="loja-section">
                        <div className="loja-section-header">
                          <div className="loja-section-titles">
                            <span className="loja-section-cat">{cat}</span>
                            <div className="loja-section-title-row">
                              <h2 className="loja-section-title">{formatSubcat(sub)}</h2>
                              <button
                                type="button"
                                className="loja-section-more"
                                onClick={() => selectCatSubcat(cat, sub)}
                              >
                                {isPt ? 'ver todos' : 'see all'} <span className="loja-section-more-arrow">→</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="loja-grid">
                          {displayItems.map((item) => (
                            <LojaCard key={item.id} item={item} isPt={isPt} onClick={() => navigate(`/loja/${item.id}`)} />
                          ))}
                        </div>
                        {hasMore && (
                          <button
                            type="button"
                            className="loja-section-more"
                            style={{ marginTop: 12, display: 'flex', alignSelf: 'center', margin: '12px auto 0' }}
                            onClick={() => selectCatSubcat(cat, sub)}
                          >
                            {isPt ? `ver todos (${subItems.length})` : `see all (${subItems.length})`}
                            <span className="loja-section-more-arrow"> →</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {semSubcat.length > 0 && (
                    <div className="loja-section">
                      <div className="loja-section-header">
                        <h2 className="loja-section-title">{isPt ? 'Outros' : 'Other'}</h2>
                      </div>
                      <div className="loja-grid">
                        {semSubcat.map((item) => (
                          <LojaCard key={item.id} item={item} isPt={isPt} onClick={() => navigate(`/loja/${item.id}`)} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          ) : (
            /* ── modo filtrado: grid simples ── */
            <div className="loja-grid">
              {filtered.map((item) => (
                <LojaCard key={item.id} item={item} isPt={isPt} onClick={() => navigate(`/loja/${item.id}`)} />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="loja-footer">
        <div className="loja-footer-bottom">
          {storeUrl && (
            <a className="loja-footer-store" href={storeUrl} target="_blank" rel="noreferrer">
              {isPt ? 'Loja oficial ↗' : 'Official store ↗'}
            </a>
          )}
          <span>© {new Date().getFullYear()} MIND OF A DEAD BODY</span>
        </div>
      </footer>
    </div>
  );
}
// ─── produto (/loja/:id) ──────────────────────────────────────────────────────

function LojaProduto({ shopCfg, loading, lang, setLang, hasSubbar }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isPt = lang === 'pt-BR';
  const storeUrl = String(shopCfg.storeUrl || '').trim();

  const item = useMemo(
    () => (shopCfg.items || []).find((i) => i.id === id) || null,
    [shopCfg, id]
  );

  const [activeImg, setActiveImg] = useState(0);
  useEffect(() => { setActiveImg(0); }, [id]);
  useEffect(() => { if (item) trackPageView(`loja-produto-${item.id}`); }, [item]);

  const printInfo = item ? PRINT_INFO[isPt ? 'pt' : 'en'][item.printType] : null;
  const sizes = item?.printSizes || {};
  const sizeEntries = [
    { key: 'frente', label: isPt ? 'Frente' : 'Front' },
    { key: 'costas', label: isPt ? 'Costas' : 'Back' },
    { key: 'ladoD',  label: isPt ? 'Lado direito' : 'Right side' },
    { key: 'ladoE',  label: isPt ? 'Lado esquerdo' : 'Left side' },
  ].filter(({ key }) => sizes[key]);

  if (loading) {
    return (
      <div className={`loja-page${hasSubbar ? ' has-subbar' : ''}`} style={PAGE_BG}>
        <LojaNav lang={lang} setLang={setLang} backHref="/loja" storeUrl={storeUrl} />
        <main className="loja-main"><div className="loja-loading">{isPt ? 'Carregando…' : 'Loading…'}</div></main>
      </div>
    );
  }

  if (!item) {
    return (
      <div className={`loja-page${hasSubbar ? ' has-subbar' : ''}`} style={PAGE_BG}>
        <LojaNav lang={lang} setLang={setLang} backHref="/loja" storeUrl={storeUrl} />
        <main className="loja-main">
          <div className="loja-empty">{isPt ? 'Produto não encontrado.' : 'Product not found.'}</div>
          <button type="button" className="loja-back-link" onClick={() => navigate('/loja')}>
            ← {isPt ? 'Voltar à loja' : 'Back to store'}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={`loja-page${hasSubbar ? ' has-subbar' : ''}`} style={PAGE_BG}>
      <LojaNav lang={lang} setLang={setLang} backHref="/loja" storeUrl={storeUrl} />

      <main className="loja-produto-main">
        <LojaDisclaimer isPt={isPt} storeUrl={storeUrl} />

        {/* breadcrumb */}
        <nav className="loja-breadcrumb" aria-label="breadcrumb">
          <button type="button" onClick={() => navigate('/loja')} className="loja-breadcrumb-link">
            {isPt ? 'Loja' : 'Store'}
          </button>
          {item.categoria && (
            <>
              <span className="loja-breadcrumb-sep">›</span>
              <button type="button" className="loja-breadcrumb-link"
                onClick={() => navigate('/loja', { state: { cat: item.categoria } })}>
                {item.categoria}
              </button>
            </>
          )}
          <span className="loja-breadcrumb-sep">›</span>
          <span className="loja-breadcrumb-current">{item.title}</span>
        </nav>

        <div className="loja-produto-layout">

          {/* ── galeria ── */}
          <div className="loja-produto-gallery">
            <div className="loja-produto-main-img" style={{ background: item.bgColor || '#0a0a0a' }}>
              {item.images[activeImg]
                ? <img src={item.images[activeImg]} alt={item.title} />
                : <div className="loja-card-img-empty" />
              }
            </div>

            {item.images.length > 1 && (
              <div className="loja-produto-thumbs">
                {item.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`loja-produto-thumb${activeImg === idx ? ' is-active' : ''}`}
                    onClick={() => setActiveImg(idx)}
                    style={{ background: item.bgColor || '#0a0a0a' }}
                    aria-label={`Imagem ${idx + 1}`}
                  >
                    <img src={img} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── info ── */}
          <div className="loja-produto-info">

            {(item.categoria || item.subcategoria) && (
              <div className="loja-produto-cats">
                {item.categoria && <span className="loja-produto-cat">{item.categoria}</span>}
                {item.subcategoria && <span className="loja-produto-subcat">{formatSubcat(item.subcategoria)}</span>}
              </div>
            )}

            <h1 className="loja-produto-title">{item.title}</h1>

            {item.edicaoEspecial && (
              <div className="loja-produto-collab">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="13" height="13">
                  <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1-3-2.9 4.2-.6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                </svg>
                <span>
                  {isPt
                    ? 'Edição Especial — peça exclusiva em colaboração com outro projeto.'
                    : 'Special Edition — exclusive piece in collaboration with another project.'}
                </span>
              </div>
            )}

            {item.cor && (
              <div className="loja-produto-cor">
                <span
                  className="loja-produto-cor-dot"
                  style={{ background: corParaCss(item.cor) || item.bgColor || '#555' }}
                />
                {item.cor}
              </div>
            )}

            {item.descricao && (
              <div className="loja-produto-desc">
                {item.descricao.split('\n').map((line, i) =>
                  line.trim() === '' ? <br key={i} /> : <p key={i}>{line}</p>
                )}
              </div>
            )}

            {(printInfo || sizeEntries.length > 0) && (
              <div className="loja-produto-specs">

                {/* cabeçalho com ícone */}
                <div className="loja-produto-specs-header">
                  <svg className="loja-produto-specs-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M10 9v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="10" cy="6.5" r=".8" fill="currentColor"/>
                  </svg>
                  <span className="loja-produto-specs-title">
                    {isPt ? 'Especificações de Impressão' : 'Print Specifications'}
                  </span>
                  {printInfo && (
                    <span className="loja-produto-specs-badge">{printInfo.label}</span>
                  )}
                </div>

                {/* técnica — descrição expandida */}
                {printInfo && (
                  <div className="loja-produto-specs-technique">
                    <div className="loja-produto-specs-technique-name">
                      {printInfo.label} <span>— {printInfo.fullName}</span>
                    </div>
                    <p className="loja-produto-specs-technique-desc">{printInfo.desc}</p>
                  </div>
                )}

                {/* linhas de dados */}
                <div className="loja-produto-specs-rows">
                  {item.printSide && (
                    <div className="loja-produto-spec-row">
                      <span>{isPt ? 'Posição' : 'Position'}</span>
                      <strong>{item.printSide}</strong>
                    </div>
                  )}
                  {sizeEntries.map(({ key, label }) => (
                    <div key={key} className="loja-produto-spec-row">
                      <span>{label}</span>
                      <strong>
                        {sizes[key]}
                        {/^\d/.test(String(sizes[key])) && !/cm/i.test(String(sizes[key])) ? ' cm' : ''}
                      </strong>
                    </div>
                  ))}
                </div>

                {/* aviso de prazo DTF */}
                {printInfo?.prazo && (
                  <div className="loja-produto-specs-prazo">
                    {printInfo.prazo}
                  </div>
                )}

              </div>
            )}

            {item.href && (
              <button type="button" className="loja-produto-cta" onClick={() => openPlatformLink(item.href)}>
                {isPt ? 'VER NA LOJA' : 'VIEW IN STORE'}
                <span className="loja-produto-cta-arrow">↗</span>
              </button>
            )}

          </div>
        </div>
      </main>

      <footer className="loja-footer">
        <div className="loja-footer-bottom">
          <span>© {new Date().getFullYear()} MIND OF A DEAD BODY</span>
        </div>
      </footer>
    </div>
  );
}

// ─── root ─────────────────────────────────────────────────────────────────────

export default function LojaRoot() {
  const [lang, setLang] = useState(() => {
    const nav = navigator.languages?.[0] || navigator.language || 'pt-BR';
    return nav.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  });
  const { shopCfg, loading } = useShopData();
  const storeUrl = String(shopCfg.storeUrl || '').trim();

  // estado de filtro elevado para o root — compartilhado entre catálogo e produto
  const categorias = useMemo(() => {
    const cats = [...new Set((shopCfg.items || []).map((i) => i.categoria).filter(Boolean))];
    return cats;
  }, [shopCfg.items]);

  const subcatMap = useMemo(() => {
    const map = {};
    for (const item of shopCfg.items || []) {
      if (!item.categoria || !item.subcategoria) continue;
      if (!map[item.categoria]) map[item.categoria] = new Set();
      map[item.categoria].add(item.subcategoria);
    }
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v]]));
  }, [shopCfg.items]);

  const [catFilter, setCatFilter] = useState('all');
  const [subcatFilter, setSubcatFilter] = useState('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const isPt = lang === 'pt-BR';

  function selectCat(cat) { setCatFilter(cat); setSubcatFilter('all'); }
  function selectSubcat(sub) { setSubcatFilter(sub); }
  function selectCatSubcat(cat, sub) { setCatFilter(cat); setSubcatFilter(sub); }

  const subcats = useMemo(
    () => catFilter !== 'all' ? (subcatMap[catFilter] || []) : [],
    [catFilter, subcatMap]
  );

  const filterProps = { catFilter, subcatFilter, search, setSearch, categorias, subcats, subcatMap, selectCat, selectSubcat, selectCatSubcat, isPt };

  return (
    <>
      {/* topbar fixa — aparece em todas as telas da loja */}
      <div className="loja-topbar">
        <div className="loja-topbar-inner">
          <div className="loja-cats" role="tablist">
            <button type="button" role="tab" aria-selected={catFilter === 'all'}
              className={`loja-cat-btn${catFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => { selectCat('all'); navigate('/loja'); }}>
              {isPt ? 'Lançamentos' : 'New Arrivals'}
            </button>
            {categorias.map((cat) => (
              <button key={cat} type="button" role="tab" aria-selected={catFilter === cat}
                className={`loja-cat-btn${catFilter === cat ? ' is-active' : ''}`}
                onClick={() => { selectCat(cat); navigate('/loja'); }}>
                {cat}
              </button>
            ))}
          </div>
          <div className="loja-search-wrap">
            <svg className="loja-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input type="search" className="loja-search" value={search}
              onChange={(e) => { setSearch(e.target.value); navigate('/loja'); }}
              placeholder={isPt ? 'Buscar produto…' : 'Search product…'}
              aria-label={isPt ? 'Buscar produto' : 'Search product'} />
            {search && (
              <button type="button" className="loja-search-clear" onClick={() => setSearch('')} aria-label="Limpar">×</button>
            )}
          </div>
        </div>
      </div>

      {subcats.length > 0 && (
        <div className="loja-subbar" role="tablist" aria-label={isPt ? 'Subcategorias' : 'Subcategories'}>
          <button type="button" role="tab"
            aria-selected={subcatFilter === 'all'}
            className={`loja-subbar-btn${subcatFilter === 'all' ? ' is-active' : ''}`}
            onClick={() => selectSubcat('all')}>
            {isPt ? 'Todos' : 'All'}
          </button>
          {subcats.map((sub) => (
            <button key={sub} type="button" role="tab"
              aria-selected={subcatFilter === sub}
              className={`loja-subbar-btn${subcatFilter === sub ? ' is-active' : ''}`}
              onClick={() => selectSubcat(sub)}>
              {formatSubcat(sub)}
            </button>
          ))}
        </div>
      )}

      <Routes>
        <Route path="/" element={
          <LojaCatalogo shopCfg={shopCfg} loading={loading} lang={lang} setLang={setLang}
            storeUrl={storeUrl} filterProps={filterProps} hasSubbar={subcats.length > 0} navCategorias={categorias} />
        } />
        <Route path="/:id" element={
          <LojaProduto shopCfg={shopCfg} loading={loading} lang={lang} setLang={setLang}
            hasSubbar={subcats.length > 0} />
        } />
      </Routes>
      <PromoPopup lang={lang} />
    </>
  );
}
