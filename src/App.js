import { useEffect, useRef, useState, useMemo } from 'react';
import './App.css';
import logoPng from './assets/logo.png';
import aboutLogoMark from './assets/logo-mark.png';
import instagramPng from './assets/instagram.png';
import pixPng from './assets/pix.png';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import spotifyIcon from './assets/spotify.png';
import appleIcon from './assets/apple.png';
import deezerIcon from './assets/deezer.png';
import youtubeMusicIcon from './assets/youtube-music.png';
import tiktokIcon from './assets/tiktok.png';
import youtubeIcon from './assets/youtube.png';

const PAGES_DOC_PATH = ['siteData', 'moadb_pages'];

function normalizeAboutFromPagesDoc(raw) {
  const aboutRaw = raw?.about ?? raw?.sobre ?? {};

  if (Array.isArray(aboutRaw?.sections)) {
    const sections = aboutRaw.sections
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => ({
        title: {
          pt: typeof s?.title?.pt === 'string' ? s.title.pt : '',
          en: typeof s?.title?.en === 'string' ? s.title.en : '',
        },
        text: {
          pt: typeof s?.text?.pt === 'string' ? s.text.pt : '',
          en: typeof s?.text?.en === 'string' ? s.text.en : '',
        },
        imageUrl: typeof s?.imageUrl === 'string' ? s.imageUrl : '',
      }));

    while (sections.length < 2) {
      sections.push({ title: { pt: '', en: '' }, text: { pt: '', en: '' }, imageUrl: '' });
    }
    return { sections };
  }

  // legado (uma sessão)
  return {
    sections: [
      {
        title: {
          pt: typeof aboutRaw?.title?.pt === 'string' ? aboutRaw.title.pt : typeof aboutRaw?.titlePT === 'string' ? aboutRaw.titlePT : 'SOBRE',
          en: typeof aboutRaw?.title?.en === 'string' ? aboutRaw.title.en : typeof aboutRaw?.titleEN === 'string' ? aboutRaw.titleEN : 'ABOUT',
        },
        text: {
          pt: typeof aboutRaw?.text?.pt === 'string' ? aboutRaw.text.pt : typeof aboutRaw?.textPT === 'string' ? aboutRaw.textPT : '',
          en: typeof aboutRaw?.text?.en === 'string' ? aboutRaw.text.en : typeof aboutRaw?.textEN === 'string' ? aboutRaw.textEN : '',
        },
        imageUrl: typeof aboutRaw?.imageUrl === 'string' ? aboutRaw.imageUrl : '',
      },
      { title: { pt: '', en: '' }, text: { pt: '', en: '' }, imageUrl: '' },
    ],
  };
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
        image: String(it?.imageUrl || it?.image || ''),
        bgColor: String(it?.bgColor || ''),
      }))
      .filter((it) => it.title || it.image || it.href),
  };
}

function normalizeNewsFromDb(data, langKey = 'pt') {
  const d = data || {};
  const content = d.content && typeof d.content === 'object' ? d.content : {};
  const rawItems = Array.isArray(content.items)
    ? content.items
    : Array.isArray(content.posts)
      ? content.posts
      : Array.isArray(d.items)
        ? d.items
        : [];

  // resolve campo i18n ou string legada
  function resolveI18n(value, fallback = '') {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return String(value[langKey] || value.pt || value.en || fallback).trim();
    }
    return String(value || fallback).trim();
  }

  return rawItems
    .map((it, idx) => {
      const tags = Array.isArray(it?.tags)
        ? it.tags.map((t) => String(t).trim()).filter(Boolean)
        : typeof it?.tags === 'string'
          ? it.tags.split(/[,/]/g).map((t) => t.trim()).filter(Boolean)
          : [];

      const mediaUrl = String(it?.mediaUrl || it?.media || it?.videoUrl || '');
      const mediaKind = String(it?.mediaKind || (mediaUrl ? 'video' : 'image'));

      return {
        id: String(it?.id ?? idx),
        tags,
        type: String(it?.type || it?.tag || ''),
        date: String(it?.date || it?.publishedAt || it?.timestamp || ''),
        title: resolveI18n(it?.title),
        excerptHtml: resolveI18n(it?.excerptHtml, it?.excerpt || it?.description || it?.text || ''),
        excerpt: String(it?.excerpt || it?.description || it?.text || ''),
        ctaText: resolveI18n(it?.ctaText || it?.cta),
        ctaUrl: String(it?.ctaUrl || it?.href || it?.url || it?.link || ''),
        image: String(it?.imageUrl || it?.image || it?.thumbUrl || ''),
        mediaUrl,
        mediaKind,
      };
    })
    .filter((x) => x.title || x.image || x.mediaUrl || x.excerptHtml || x.excerpt || x.ctaUrl);
}

// Tenta extrair thumbnail de vídeo (YouTube) a partir de uma URL.
function getVideoThumbnail(url) {
  if (!url || typeof url !== 'string') return '';

  try {
    const u = new URL(url);
    const host = (u.hostname || '').toLowerCase();

    // youtube.com / youtu.be / shorts
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      let id = '';

      if (host.includes('youtu.be')) {
        id = (u.pathname || '').replace(/^\//, '').split('/')[0] || '';
      } else if ((u.pathname || '').startsWith('/shorts/')) {
        id = u.pathname.split('/shorts/')[1]?.split('/')[0] || '';
      } else {
        id = u.searchParams.get('v') || '';
        if (!id && (u.pathname || '').startsWith('/embed/')) {
          id = u.pathname.split('/embed/')[1]?.split('/')[0] || '';
        }
      }

      if (id) {
        // hqdefault costuma funcionar bem para cards 1:1
        return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      }
    }
  } catch {
    // ignore
  }

  return '';
}

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
  { key: 'home',        href: '#inicio',      label: 'INÍCIO' },
  { key: 'sobre',       href: '#sobre',       label: 'SOBRE' },
  { key: 'loja',        href: '#loja',        label: 'LOJA' },
  { key: 'noticias',    href: '#noticias',    label: 'NOTÍCIAS' },
  { key: 'discografia', href: '#discografia', label: 'DISCOGRAFIA' },
  { key: 'contato',     href: '#contato',     label: 'CONTATO' },
];
const NAV_SECTIONS_EN = [
  { key: 'home',        href: '#inicio',      label: 'HOME' },
  { key: 'sobre',       href: '#sobre',       label: 'ABOUT' },
  { key: 'loja',        href: '#loja',        label: 'STORE' },
  { key: 'noticias',    href: '#noticias',    label: 'NEWS' },
  { key: 'discografia', href: '#discografia', label: 'DISCOGRAPHY' },
  { key: 'contato',     href: '#contato',     label: 'CONTACT' },
];

function SectionBg({ bg }) {
  if (!bg) return null;
  const c01 = (n) => Math.max(0, Math.min(1, parseFloat(n) || 0));
  const aHex = (c, op) => /^#[0-9a-fA-F]{6}$/.test(c) ? `${c}${Math.round(c01(op)*255).toString(16).padStart(2,'0')}` : (c || '#000000');
  const gradOn = bg.gradientEnabled !== false;
  const imgOn = bg.imageEnabled !== false && bg.imageUrl;
  const angle = Math.max(0, Math.min(360, parseFloat(bg.gradientAngle) || 180));
  const from = gradOn ? aHex(bg.gradientFrom || '#000000', bg.gradientFromOpacity ?? bg.gradientOpacity ?? 1) : 'transparent';
  const to = gradOn ? aHex(bg.gradientTo || '#000000', bg.gradientToOpacity ?? bg.gradientOpacity ?? 1) : 'transparent';
  const dividerTop = bg.dividerTop ?? bg.divider ?? 'none';
  const dividerBottom = bg.dividerBottom ?? 'none';

  // máscara aplicada no wrapper que contém todos os layers de bg
  let maskImage = undefined;
  if (dividerBottom === 'fade' && dividerTop === 'fade') {
    maskImage = 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)';
  } else if (dividerBottom === 'fade') {
    maskImage = 'linear-gradient(to bottom, black 93%, transparent 100%)';
  } else if (dividerTop === 'fade') {
    maskImage = 'linear-gradient(to bottom, transparent 0%, black 15%)';
  }

  return (
    <>
      <div
        className="section-bg-layers"
        aria-hidden="true"
        style={maskImage ? { maskImage, WebkitMaskImage: maskImage } : undefined}
      >
        {gradOn && (
          <div className="section-bg-gradient" style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }} />
        )}
        {imgOn && (
          <div className="section-bg-image" style={{ backgroundImage: `url('${bg.imageUrl}')`, opacity: c01(bg.imageOpacity ?? 0.35) }} />
        )}
      </div>
      {dividerTop === 'line' && <div className="section-divider section-divider--line" aria-hidden="true" style={{ top: 0, bottom: 'auto' }} />}
      {dividerBottom === 'line' && <div className="section-divider section-divider--line" aria-hidden="true" />}
    </>
  );
}

function useScrollReveal(deps = []) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal')).filter(el => !el.classList.contains('about'));
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('revealed');
        } else {
          e.target.classList.remove('revealed');
        }
      }),
      { threshold: 0.25, rootMargin: '0px 0px -80px 0px' }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function useParallax() {
  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const heroInner = document.querySelector('.hero-inner');
        if (heroInner) {
          const y = window.scrollY;
          heroInner.style.transform = `translateY(${y * 0.15}px)`;
          heroInner.style.opacity = Math.max(0, 1 - y / 800);
        }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
}

function useTouchSwipe(onSwipeLeft, onSwipeRight) {
  const startX = useRef(null);
  return {
    onTouchStart: (e) => { startX.current = e.touches[0].clientX; },
    onTouchEnd: (e) => {
      if (startX.current === null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      if (Math.abs(dx) < 40) return;
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
      startX.current = null;
    },
  };
}

function App() {
  // Redirect: mobile + domínio moadb.com.br → /tree
  useEffect(() => {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMoadb = window.location.hostname.includes('moadb.com.br');
    if (isMobile && isMoadb) {
      window.location.replace('/tree');
    }
  }, []);

  const [langOpen, setLangOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState(() => {
    const nav = navigator.languages?.[0] || navigator.language || 'pt-BR';
    return nav.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  });
  const langRef = useRef(null);

  // HOME featured (Novos Lançamentos)
  const [homeCfg, setHomeCfg] = useState({
    featuredEnabled: false,
    featuredReleaseIds: [],
    featuredTitle: 'OUÇA AGORA',
    featuredButtonLabel: 'OUVIR AGORA',
  });
  const [discography, setDiscography] = useState([]);

  // Discography modal
  const [openReleaseId, setOpenReleaseId] = useState(null);
  const openRelease = useMemo(
    () => discography.find((r) => String(r.id) === String(openReleaseId)) || null,
    [discography, openReleaseId]
  );

  useEffect(() => {
    if (openReleaseId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [openReleaseId]);

  useEffect(() => {
    function onEsc(e) {
      if (e.key === 'Escape') setOpenReleaseId(null);
    }
    if (openReleaseId) document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [openReleaseId]);

  // UI state: toggle platform links for featured release
  const [featuredPlatformsOpen, setFeaturedPlatformsOpen] = useState(false);
  const [platformsClosing, setPlatformsClosing] = useState(false);

  const openPlatforms = () => { setPlatformsClosing(false); setFeaturedPlatformsOpen(true); };
  const closePlatforms = () => {
    setPlatformsClosing(true);
    setTimeout(() => { setFeaturedPlatformsOpen(false); setPlatformsClosing(false); }, 280);
  };
  const featuredIdsKey = (homeCfg.featuredReleaseIds || []).join('|');

  const [pagesContent, setPagesContent] = useState(null);
  const [appReady, setAppReady] = useState(false);
  const [shopCfg, setShopCfg] = useState({ storeUrl: '', items: [] });
  const [rawNewsData, setRawNewsData] = useState(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState('');

  const [previewTrackId, setPreviewTrackId] = useState(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const previewStartRef = useRef(null);
  const [lyricsTrackId, setLyricsTrackId] = useState(null);

  useEffect(() => {
    const unsubHome = onSnapshot(doc(db, 'siteData', 'moadb_home'), (snap) => {
      const raw = snap.exists() ? (snap.data()?.content ?? snap.data() ?? {}) : {};
      setHomeCfg({
        featuredEnabled: typeof raw.featuredEnabled === 'boolean' ? raw.featuredEnabled : false,
        featuredReleaseIds: Array.isArray(raw.featuredReleaseIds) ? raw.featuredReleaseIds.map(String) : [],
        featuredTitle: (raw.featuredTitle && typeof raw.featuredTitle === 'object')
          ? raw.featuredTitle
          : { pt: String(raw.featuredTitle || '').trim(), en: '' },
        featuredButtonLabel: (raw.featuredButtonLabel && typeof raw.featuredButtonLabel === 'object')
          ? raw.featuredButtonLabel
          : { pt: String(raw.featuredButtonLabel || '').trim(), en: '' },
      });
    });

    const unsubDisco = onSnapshot(
      doc(db, 'siteData', 'moadb_discography'),
      (snap) => {
        try {
          const data = snap.exists() ? (snap.data() ?? {}) : {};

          // Schema: siteData/moadb_discography { content: [ ...releases ] }
          const content = Array.isArray(data?.content) ? data.content : [];

          const list = content
            .map((e) => ({
              id: String(e?.id ?? ''),
              title: String(e?.title ?? ''),
              year: String(e?.year ?? ''),
              type: String(e?.type ?? ''),
              coverUrl: String(e?.coverUrl ?? e?.coverURL ?? e?.cover ?? ''),
              links: {
                spotify: String(e?.links?.spotify ?? ''),
                apple: String(e?.links?.apple ?? ''),
                deezer: String(e?.links?.deezer ?? ''),
                youtubeMusic: String(e?.links?.youtube ?? e?.links?.youtubeMusic ?? ''),
              },
              tracks: Array.isArray(e?.tracks)
                ? e.tracks.map((t, idx) => ({
                    id: String(t?.id || idx),
                    name: String(t?.name || ''),
                    youtubeUrl: String(t?.youtubeUrl || ''),
                    startSec: Number(t?.startSec ?? t?.start ?? t?.segmentStart ?? 0),
                    endSec: Number(t?.endSec ?? t?.end ?? t?.segmentEnd ?? 0),
                    lyrics: String(t?.lyrics || t?.letra || ''),
                  }))
                : [],
            }))
            .filter((x) => x.id);

          setDiscography(list);
        } catch (e) {
          console.error('[DISCO] normalize failed', e);
          setDiscography([]);
        }
      },
      (err) => {
        console.error('[DISCO] onSnapshot error', err);
        setDiscography([]);
      }
    );

    const unsubShop = onSnapshot(
      doc(db, 'siteData', 'moadb_shop'),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        setShopCfg(normalizeShopFromDb(data));
      },
      () => {
        // falha silenciosa: mantém defaults
      }
    );

    const unsubNews = onSnapshot(
      doc(db, 'siteData', 'moadb_news'),
      (snap) => {
        try {
          setNewsLoading(false);
          setNewsError('');
          const exists = snap.exists();
          const data = exists ? snap.data() : {};
          setRawNewsData(data);
        } catch (e) {
          console.error('[NEWS] normalize failed', e);
          setNewsLoading(false);
          setNewsError('normalize-failed');
          setRawNewsData(null);
        }
      },
      (err) => {
        console.error('[NEWS] onSnapshot error', err);
        setNewsLoading(false);
        setNewsError(String(err?.code || err?.message || 'unknown'));
        setRawNewsData(null);
      }
    );

    return () => {
      unsubHome();
      unsubDisco();
      unsubShop();
      unsubNews();
    };
  }, []);

  useEffect(() => {
    const ref = doc(db, ...PAGES_DOC_PATH);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const content = data?.content ?? data;
      setPagesContent(content);
      setAppReady(true);
    }, () => { /* silencioso */ });
    return unsub;
  }, []);

  const langKey = useMemo(() => (String(lang || '').toLowerCase().startsWith('pt') ? 'pt' : 'en'), [lang]);
  const aboutFromDb = useMemo(() => normalizeAboutFromPagesDoc(pagesContent || {}), [pagesContent]);
  const newsItems = useMemo(() => normalizeNewsFromDb(rawNewsData, langKey), [rawNewsData, langKey]);

  const sectionBgStyle = useMemo(() => {
    const order = Array.isArray(pagesContent?.sectionOrder) ? pagesContent.sectionOrder : [];
    const toStyle = (key) => {
      const orderIdx = order.indexOf(key);
      return orderIdx >= 0 ? { order: orderIdx } : {};
    };
    return {
      home: toStyle('home'),
      sobre: toStyle('sobre'),
      loja: toStyle('loja'),
      noticias: toStyle('noticias'),
      discografia: toStyle('discografia'),
      contato: toStyle('contato'),
    };
  }, [pagesContent]);

  const sectionBg = useMemo(() => {
    const bgs = pagesContent?.backgroundsBySection ?? {};
    return {
      home: bgs.home ?? null,
      sobre: bgs.sobre ?? null,
      loja: bgs.loja ?? null,
      noticias: bgs.noticias ?? null,
      discografia: bgs.discografia ?? null,
      contato: bgs.contato ?? null,
    };
  }, [pagesContent]);
  const sectionVisible = useMemo(() => {
    const bgs = pagesContent?.backgroundsBySection ?? {};
    const isVisible = (key) => bgs[key]?.visible !== false;
    return { home: isVisible('home'), sobre: isVisible('sobre'), loja: isVisible('loja'), noticias: isVisible('noticias'), discografia: isVisible('discografia'), contato: isVisible('contato') };
  }, [pagesContent]);

  const shopItems = useMemo(() => shopCfg?.items || [], [shopCfg]);
  const shopStoreUrl = String(shopCfg?.storeUrl || '').trim();

  const [shopIndex, setShopIndex] = useState(0);
  const totalSlides = shopItems.length + 1;

  function getShopSlidesVisible() {
    const w = window.innerWidth;
    if (w <= 600) return 1;
    if (w <= 900) return 2;
    if (w <= 1200) return 3;
    return 5;
  }
  const [shopSlidesVisible, setShopSlidesVisible] = useState(() => getShopSlidesVisible());

  useEffect(() => {
    function onResize() { setShopSlidesVisible(getShopSlidesVisible()); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const maxShopIndex = Math.max(0, totalSlides - shopSlidesVisible);

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function goShopIndex(next) {
    setShopIndex(() => clamp(next, 0, maxShopIndex));
  }

  useEffect(() => {
    setShopIndex((idx) => clamp(idx, 0, maxShopIndex));
  }, [maxShopIndex]);

  useEffect(() => {
    // reset UI when featured release changes or gets disabled
    setFeaturedPlatformsOpen(false);
  }, [homeCfg.featuredEnabled, featuredIdsKey]);
  useEffect(() => {
    // Se o usuário sair do "Início" e depois voltar, volta para o botão automaticamente
    const heroEl = document.querySelector('#inicio');
    if (!heroEl) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries?.[0];
        if (!e) return;
        // quando sair da viewport, reseta
        if (!e.isIntersecting) closePlatforms();
      },
      { threshold: 0.15 }
    );

    obs.observe(heroEl);
    return () => obs.disconnect();
  }, []);

  const featuredItems = (() => {
    const ids = (homeCfg.featuredReleaseIds || []).map(String);
    if (!ids.length) return [];
    const byId = new Map(discography.map((d) => [String(d.id), d]));
    return ids.map((id) => byId.get(String(id))).filter(Boolean);
  })();

  const featuredPrimary = featuredItems[0] || null;

  const featuredLinks = featuredPrimary?.links || {};
  const platformList = [
    { key: 'spotify', label: 'Spotify', href: featuredLinks?.spotify || '', icon: spotifyIcon },
    { key: 'apple', label: 'Apple Music', href: featuredLinks?.apple || '', icon: appleIcon },
    { key: 'deezer', label: 'Deezer', href: featuredLinks?.deezer || '', icon: deezerIcon },
    { key: 'youtubeMusic', label: 'YouTube Music', href: featuredLinks?.youtubeMusic || '', icon: youtubeMusicIcon },
  ].filter((p) => String(p.href || '').trim());

  useEffect(() => {
    function onDocClick(e) {
      if (!langRef.current) return;
      if (!langRef.current.contains(e.target)) setLangOpen(false);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') setLangOpen(false);
    }

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const isPt = lang === 'pt-BR';

  // ===== NEWS carousel state =====
  const [newsIndex, setNewsIndex] = useState(0);
  const newsViewportRef = useRef(null);

  function getNewsVisibleCount() {
    const w = window.innerWidth;
    if (w <= 900) return 1;
    return 4;
  }
  const [newsVisibleCount, setNewsVisibleCount] = useState(() => getNewsVisibleCount());

  useEffect(() => {
    function onResize() { setNewsVisibleCount(getNewsVisibleCount()); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // controla “Ler mais…” (expansão inline) e detecção de clamp por item
  const [expandedNewsIds, setExpandedNewsIds] = useState(() => new Set());
  const [clampedNewsIds, setClampedNewsIds] = useState(() => new Set());
  const excerptRefs = useRef({});

  const toggleNewsExpanded = (id) => {
    setExpandedNewsIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // mede se o texto está clampado (scrollHeight > clientHeight)
  useEffect(() => {
    const capped = (newsItems || []).slice(0, 12);
    const windowItems = capped.slice(newsIndex, newsIndex + newsVisibleCount);
    const idsInView = windowItems.map((p) => String(p.id));

    const raf = requestAnimationFrame(() => {
      setClampedNewsIds((prev) => {
        let changed = false;
        const next = new Set(prev);

        for (const id of idsInView) {
          const el = excerptRefs.current?.[id];
          if (!el) continue;
          const isClamped = el.scrollHeight - el.clientHeight > 1;
          const had = next.has(id);
          if (isClamped && !had) {
            next.add(id);
            changed = true;
          } else if (!isClamped && had) {
            next.delete(id);
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [newsItems, newsIndex, newsVisibleCount]);

  const visibleNewsItems = useMemo(() => {
    const list = Array.isArray(newsItems) ? newsItems : [];
    return list.slice(0, 12);
  }, [newsItems]);

  const maxNewsScrollIndex = Math.max(0, visibleNewsItems.length - newsVisibleCount);

  // renderizamos o track inteiro para permitir animação por translateX (igual ao carrossel da Loja)
  // o índice continua avançando de 1 em 1
  function goNewsScrollIndex(next) {
    setNewsIndex(() => Math.max(0, Math.min(next, maxNewsScrollIndex)));
  }

  useEffect(() => {
    setNewsIndex((i) => Math.min(i, maxNewsScrollIndex));
  }, [maxNewsScrollIndex]);

  useEffect(() => {
    if (!openRelease) {
      setPreviewTrackId(null);
      setPreviewProgress(0);
      setLyricsTrackId(null);
    }
  }, [openRelease]);

  useEffect(() => {
    if (!previewTrackId) {
      setPreviewProgress(0);
      previewStartRef.current = null;
      return;
    }
    const track = openRelease?.tracks?.find((t) => t.id === previewTrackId);
    const duration = (track?.endSec || 0) - (track?.startSec || 0);
    if (!duration) return;
    previewStartRef.current = Date.now();
    setPreviewProgress(0);
    const iv = setInterval(() => {
      const elapsed = (Date.now() - previewStartRef.current) / 1000;
      setPreviewProgress(Math.min(elapsed / duration, 1));
      if (elapsed >= duration) clearInterval(iv);
    }, 200);
    return () => clearInterval(iv);
  }, [previewTrackId, openRelease]);

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportPix, setSupportPix] = useState(false);
  const [supportClosing, setSupportClosing] = useState(false);

  const openSupport = () => { setSupportClosing(false); setSupportOpen(true); };
  const closeSupport = () => {
    setSupportClosing(true);
    setTimeout(() => { setSupportOpen(false); setSupportClosing(false); setSupportPix(false); }, 250);
  };
  const toggleSupport = () => { if (supportOpen && !supportClosing) closeSupport(); else openSupport(); };

  // fechar ao clicar fora
  useEffect(() => {
    if (!supportOpen || supportClosing) return;
    function onDocClick(e) {
      if (!e.target.closest('.support-panel') && !e.target.closest('.support-fab')) {
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
  const [openNewsPost, setOpenNewsPost] = useState(null);

  useScrollReveal([discography.length, visibleNewsItems.length]);
  useParallax();

  // observer dedicado para a seção Sobre — dispara só quando bem centrada na viewport
  useEffect(() => {
    const section = document.querySelector('.about');
    if (!section) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          section.classList.add('revealed');
        } else {
          section.classList.remove('revealed');
        }
      },
      { threshold: 0.45 }
    );
    obs.observe(section);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="app-container">
      {!appReady && (
        <div className="app-loading" aria-label="Carregando" aria-live="polite">
          <img src={logoPng} alt="Mind of a Dead Body" className="app-loading-logo" />
          <div className="app-loading-bar"><div className="app-loading-bar-fill" /></div>
        </div>
      )}
      {appReady && <div className="app-loading app-loading--out" aria-hidden="true">
        <img src={logoPng} alt="" className="app-loading-logo" />
        <div className="app-loading-bar"><div className="app-loading-bar-fill" /></div>
      </div>}
      <div className="bg-layer" aria-hidden="true" style={(() => {
        const bg = pagesContent?.backgroundsBySection?.main;
        if (!bg) return {};
        const c01 = (n) => Math.max(0, Math.min(1, parseFloat(n) || 0));
        const aHex = (c, op) => /^#[0-9a-fA-F]{6}$/.test(c) ? `${c}${Math.round(c01(op)*255).toString(16).padStart(2,'0')}` : (c || '#000000');
        const gradOn = bg.gradientEnabled !== false;
        const imgOn = bg.imageEnabled !== false && bg.imageUrl;
        const angle = Math.max(0, Math.min(360, parseFloat(bg.gradientAngle) || 180));
        const from = gradOn ? aHex(bg.gradientFrom || '#000000', bg.gradientFromOpacity ?? bg.gradientOpacity ?? 1) : 'transparent';
        const to = gradOn ? aHex(bg.gradientTo || '#000000', bg.gradientToOpacity ?? bg.gradientOpacity ?? 1) : 'transparent';
        return {
          '--bg-gradient': gradOn ? `linear-gradient(${angle}deg, ${from}, ${to})` : 'none',
          '--bg-image': imgOn ? `url('${bg.imageUrl}')` : 'none',
          '--bg-image-opacity': imgOn ? c01(bg.imageOpacity ?? 0.35) : 0,
        };
      })()}  />

      <nav className="top-nav" aria-label="Navegação principal">
        <a className="nav-logo-wrap" href="#inicio" aria-label="Ir para Início">
          <img className="nav-logo" src={logoPng} alt="Mind of a Dead Body" />
        </a>

        {/* Desktop nav */}
        <div className="nav-links nav-links--desktop" role="navigation" aria-label="Seções">
          {(() => {
            const order = Array.isArray(pagesContent?.sectionOrder) ? pagesContent.sectionOrder : [];
            const NAV_SECTIONS = isPt ? NAV_SECTIONS_PT : NAV_SECTIONS_EN;
            const navMap = new Map(NAV_SECTIONS.map((s) => [s.key, s]));
            const ordered = order
              .filter((k) => k !== 'main' && navMap.has(k) && sectionVisible[k] !== false)
              .map((k) => navMap.get(k));
            const missing = NAV_SECTIONS.filter((s) => !order.includes(s.key) && sectionVisible[s.key] !== false);
            return [...ordered, ...missing].map((s) => (
              <a key={s.key} href={s.href}>{s.label}</a>
            ));
          })()}
        </div>

        {/* Lang dropdown: só no desktop */}
        <div className="lang-dropdown lang-dropdown--desktop" ref={langRef}>
          <button
            className="lang-dropdown-toggle"
            type="button"
            aria-haspopup="menu"
            aria-expanded={langOpen}
            onClick={() => setLangOpen(v => !v)}
          >
            <span className="lang-flag" aria-hidden="true">
              {isPt ? <FlagBR /> : <FlagUK />}
            </span>
            <span className="lang-arrow" aria-hidden="true">▼</span>
          </button>

          {langOpen && (
            <ul className="lang-dropdown-menu" role="menu" aria-label="Selecionar idioma">
              <li>
                <button
                  type="button"
                  className={`lang-dropdown-item ${isPt ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => {
                    setLang('pt-BR');
                    setLangOpen(false);
                  }}
                >
                  <span className="lang-flag" aria-hidden="true"><FlagBR /></span>
                  <span>Português</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`lang-dropdown-item ${!isPt ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => {
                    setLang('en');
                    setLangOpen(false);
                  }}
                >
                  <span className="lang-flag" aria-hidden="true"><FlagUK /></span>
                  <span>English</span>
                </button>
              </li>
            </ul>
          )}
        </div>

        {/* Hambúrguer (mobile) — canto direito, no lugar do lang-dropdown */}
        <button
          className={`nav-hamburger${menuOpen ? ' is-open' : ''}`}
          type="button"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="nav-mobile-menu" role="navigation" aria-label="Menu">
          {(() => {
            const order = Array.isArray(pagesContent?.sectionOrder) ? pagesContent.sectionOrder : [];
            const NAV_SECTIONS = isPt ? NAV_SECTIONS_PT : NAV_SECTIONS_EN;
            const navMap = new Map(NAV_SECTIONS.map((s) => [s.key, s]));
            const ordered = order
              .filter((k) => k !== 'main' && navMap.has(k) && sectionVisible[k] !== false)
              .map((k) => navMap.get(k));
            const missing = NAV_SECTIONS.filter((s) => !order.includes(s.key) && sectionVisible[s.key] !== false);
            return [...ordered, ...missing].map((s) => (
              <a key={s.key} href={s.href} onClick={() => setMenuOpen(false)}>{s.label}</a>
            ));
          })()}
          {/* Idioma dentro do drawer */}
          <div className="nav-mobile-lang">
            <button
              type="button"
              className={`nav-mobile-lang-btn${isPt ? ' active' : ''}`}
              onClick={() => { setLang('pt-BR'); setMenuOpen(false); }}
            >
              <span className="lang-flag"><FlagBR /></span> PT
            </button>
            <button
              type="button"
              className={`nav-mobile-lang-btn${!isPt ? ' active' : ''}`}
              onClick={() => { setLang('en'); setMenuOpen(false); }}
            >
              <span className="lang-flag"><FlagUK /></span> EN
            </button>
          </div>
        </div>
      )}

      <main style={{ display: 'flex', flexDirection: 'column' }}>
        <section id="inicio" className="hero" aria-label="Inicio" style={sectionBgStyle.home}>
          <SectionBg bg={sectionBg.home} />
          <div className="hero-grain" aria-hidden="true" />
          <div className="hero-inner">
            {!(homeCfg.featuredEnabled && featuredPrimary) ? (
              <h1 className="hero-title" data-text="MIND OF A DEAD BODY">
                <span>MIND OF A</span>
                <span>DEAD BODY</span>
              </h1>
            ) : null}

            {homeCfg.featuredEnabled && featuredPrimary ? (
              <div className="home-featured" aria-label="Novos Lançamentos">
                <div className="home-featured-head">
                  <div className="home-featured-page-title">{(homeCfg.featuredTitle?.[langKey] || homeCfg.featuredTitle?.pt || (isPt ? 'OUÇA AGORA' : 'LISTEN NOW')).toUpperCase()}</div>
                </div>

                <div className="home-featured-row">
                  <div className="home-featured-cover">
                    {featuredPrimary.coverUrl ? <img src={featuredPrimary.coverUrl} alt="" /> : null}
                  </div>

                  <div className="home-featured-meta">
                    <div className="home-featured-album">{featuredPrimary.title}</div>
                    <div className="home-featured-sub">
                      {featuredPrimary.type ? String(featuredPrimary.type).toUpperCase() : ''}
                      {featuredPrimary.year ? ` • ${featuredPrimary.year}` : ''}
                    </div>

                    <div className="home-featured-actions">
                      {!featuredPlatformsOpen ? (
                        <button
                          type="button"
                          className="home-featured-btn btn-outline"
                          onClick={() => {
                            // clique só alterna a exibição de ícones (não abre links direto)
                            if (platformList.length === 0) {
                              const el = document.querySelector('#discografia');
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              return;
                            }
                            openPlatforms();
                          }}
                          title={platformList.length === 0 ? (isPt ? 'Sem links configurados — rolando para a Discografia' : 'No links configured — scrolling to Discography') : (isPt ? 'Mostrar plataformas' : 'Show platforms')}
                        >
                          {(homeCfg.featuredButtonLabel?.[langKey] || homeCfg.featuredButtonLabel?.pt || (isPt ? 'OUVIR AGORA' : 'LISTEN NOW')).toUpperCase()}
                        </button>
                      ) : (
                        <div className={`home-featured-platform-icons-wrap${platformsClosing ? ' is-closing' : ''}`} aria-label="Plataformas">
                          <div className="home-featured-platform-icons" aria-label="Plataformas disponíveis">
                            {platformList.map((p) => (
                              <a
                                key={p.key}
                                className="home-featured-platform-icon"
                                href={p.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={p.label}
                                title={p.label}
                              >
                                <img src={p.icon} alt="" />
                              </a>
                            ))}
                          </div>

                          <button
                            type="button"
                            className="home-featured-platform-back"
                            onClick={() => closePlatforms()}
                            aria-label="Fechar"
                            title="Fechar"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>

                    {/* mantém o grid de botões texto apenas como fallback (não usado) */}
                    {null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section id="sobre" className={`about reveal${!sectionVisible.sobre ? ' section-hidden' : ''}`} aria-label="Sobre" style={sectionBgStyle.sobre}>
          <SectionBg bg={sectionBg.sobre} />
          <div className="about-inner">
            {/* Título principal fixo (não editável via Firestore) */}
            <h2 className="about-title">{langKey === 'pt' ? 'SOBRE' : 'ABOUT'}</h2>

            <div className="about-grid">
              <div className="about-col about-left">
                <div className="about-subtitle">{aboutFromDb?.sections?.[0]?.title?.[langKey] || (langKey === 'pt' ? 'A HISTÓRIA' : 'THE STORY')}</div>
                {aboutFromDb?.sections?.[0]?.text?.[langKey] ? (
                  <div className="about-text" dangerouslySetInnerHTML={{ __html: aboutFromDb.sections[0].text[langKey] }} />
                ) : (
                  <p className="about-text">
                    [Placeholder] Texto sobre o projeto, origem, referências e contexto.
                    Substituir depois com o texto oficial.
                  </p>
                )}
              </div>

              <div className="about-col about-center">
                <img
                  className="about-logo"
                  src={aboutFromDb?.sections?.[0]?.imageUrl || aboutLogoMark}
                  alt="Logo"
                />
              </div>

              <div className="about-col about-right">
                <div className="about-subtitle">{aboutFromDb?.sections?.[1]?.title?.[langKey] || (langKey === 'pt' ? 'A FILOSOFIA' : 'THE PHILOSOPHY')}</div>
                {aboutFromDb?.sections?.[1]?.text?.[langKey] ? (
                  <div className="about-text" dangerouslySetInnerHTML={{ __html: aboutFromDb.sections[1].text[langKey] }} />
                ) : (
                  <p className="about-text">
                    [Placeholder] Texto sobre a proposta artística, estética e direção.
                    Substituir depois com o texto oficial.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="loja" className={`shop reveal${!sectionVisible.loja ? ' section-hidden' : ''}`} aria-label="Loja" style={sectionBgStyle.loja}>
          <SectionBg bg={sectionBg.loja} />
          <div className="shop-inner">
            <h2 className="shop-title">{isPt ? 'LOJA' : 'STORE'}</h2>

            <div
              className="shop-carousel"
              aria-label="Carrossel de produtos"
              {...useTouchSwipe(
                () => goShopIndex(shopIndex + 1),
                () => goShopIndex(shopIndex - 1)
              )}
            >
              {shopIndex > 0 && (
                <button
                  type="button"
                  className="shop-nav-btn prev"
                  onClick={() => goShopIndex(shopIndex - 1)}
                  aria-label="Anterior"
                >
                  ‹
                </button>
              )}

              <div className="shop-viewport">
                <div
                  className="shop-track"
                  style={{ transform: `translateX(-${shopIndex * (100 / shopSlidesVisible)}%)` }}
                >
                  {shopItems.map(item => (
                    <div key={item.id} className="shop-slide">
                      <a
                        className="shop-card shop-card-link"
                        href={item.href || shopStoreUrl || '#'}
                        target={item.href || shopStoreUrl ? '_blank' : undefined}
                        rel={item.href || shopStoreUrl ? 'noreferrer' : undefined}
                        aria-label={`${langKey === 'pt' ? 'Comprar' : 'Buy'}: ${item.title || ''}`.trim()}
                        onClick={(e) => {
                          if (!(item.href || shopStoreUrl)) e.preventDefault();
                        }}
                      >
                        <div className="shop-image" style={item.bgColor ? { background: item.bgColor } : undefined}>
                          <img src={item.image} alt="" />
                        </div>
                        <div className="shop-desc">{item.title}</div>
                        <span className="shop-buy" aria-hidden="true">
                          {langKey === 'pt' ? 'COMPRAR' : 'BUY'}
                        </span>
                      </a>
                    </div>
                  ))}

                  <div className="shop-slide">
                    <a
                      className="shop-more"
                      href={shopStoreUrl || '#'}
                      target={shopStoreUrl ? '_blank' : undefined}
                      rel={shopStoreUrl ? 'noreferrer' : undefined}
                      aria-label={langKey === 'pt' ? 'Ver mais produtos' : 'See more products'}
                    >
                      <span className="shop-more-plus">+</span>
                      <span className="shop-more-text">{langKey === 'pt' ? 'VER MAIS' : 'SEE MORE'}</span>
                    </a>
                  </div>
                </div>
              </div>

              {shopIndex < maxShopIndex && (
                <button
                  type="button"
                  className="shop-nav-btn next"
                  onClick={() => goShopIndex(shopIndex + 1)}
                  aria-label="Próximo"
                >
                  ›
                </button>
              )}
            </div>

            <div className="shop-footer">
              <a
                className="shop-full btn-outline"
                href={shopStoreUrl || '#'}
                target={shopStoreUrl ? '_blank' : undefined}
                rel={shopStoreUrl ? 'noreferrer' : undefined}
              >
                {langKey === 'pt' ? 'VER LOJA COMPLETA' : 'SEE MORE'}
              </a>
            </div>
          </div>
        </section>

        <section id="noticias" className={`news reveal${!sectionVisible.noticias ? ' section-hidden' : ''}`} aria-label="Notícias" style={sectionBgStyle.noticias}>
          <SectionBg bg={sectionBg.noticias} />
          <div className="news-inner">
            <h2 className="news-title">{isPt ? 'NOTÍCIAS' : 'NEWS'}</h2>

            <div
              className="news-carousel"
              aria-label="Carrossel de notícias"
              {...useTouchSwipe(
                () => goNewsScrollIndex(newsIndex + 1),
                () => goNewsScrollIndex(newsIndex - 1)
              )}
            >
              {newsIndex > 0 ? (
                <button
                  type="button"
                  className="news-nav news-prev"
                  aria-label="Anterior"
                  onClick={() => goNewsScrollIndex(newsIndex - 1)}
                >
                  ‹
                </button>
              ) : null}

              <div
                className="news-viewport"
                ref={newsViewportRef}
                style={{
                  // expõe para o CSS calcular o flex-basis (4 cards)
                  '--news-cols': newsVisibleCount,
                }}
              >
                <div
                  className="news-track"
                  style={{
                    transform: `translateX(calc(-${newsIndex} * (100% / ${newsVisibleCount} + ${22 / newsVisibleCount}px)))`,
                  }}
                >
                  {newsError ? (
                    <div className="news-empty" role="status">
                      {langKey === 'pt'
                        ? `Falha ao carregar notícias (${newsError}).`
                        : `Failed to load news (${newsError}).`}
                    </div>
                  ) : newsLoading ? (
                    <div className="news-empty" role="status">
                      {langKey === 'pt' ? 'Carregando notícias…' : 'Loading news…'}
                    </div>
                  ) : (visibleNewsItems || []).length === 0 ? (
                    <div className="news-empty" role="status">
                      {langKey === 'pt' ? 'Sem notícias no momento.' : 'No news yet.'}
                    </div>
                  ) : (
                    (visibleNewsItems || []).map((post) => {
                      const isVideo = post.mediaKind === 'video' || post.mediaKind === 'video_vertical';
                      const mediaHref = post.mediaUrl || post.ctaUrl || '';
                      const thumbSrc = post.image || (isVideo ? getVideoThumbnail(post.mediaUrl) : '') || '';
                      const hasMedia = Boolean(thumbSrc || (isVideo && post.mediaUrl));
                      const hasCtaLink = Boolean(post.ctaUrl);
                      const isExpanded = expandedNewsIds.has(String(post.id));
                      const isClamped = clampedNewsIds.has(String(post.id));

                      return (
                        <article
                          key={post.id}
                          className={`news-card reveal-item ${hasMedia ? '' : 'news-card--text'} ${isExpanded ? 'news-card--expanded' : ''}`.trim()}
                        >
                          {hasMedia ? (
                            mediaHref ? (
                              <a
                                className={`news-media ${thumbSrc ? 'has-thumb-bg' : ''}`.trim()}
                                style={thumbSrc ? { '--news-thumb-url': `url(${thumbSrc})` } : undefined}
                                href={mediaHref}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={isVideo ? (isPt ? 'Abrir vídeo' : 'Open video') : (isPt ? 'Abrir notícia' : 'Open post')}
                                onClick={(e) => { e.preventDefault(); setOpenNewsPost(post); }}
                              >
                                {thumbSrc ? <img src={thumbSrc} alt="" /> : null}
                                {isVideo ? <div className="news-play" aria-hidden="true" /> : null}
                              </a>
                            ) : (
                              <div
                                className={`news-media ${thumbSrc ? 'has-thumb-bg' : ''}`.trim()}
                                style={thumbSrc ? { '--news-thumb-url': `url(${thumbSrc})` } : undefined}
                              >
                                {thumbSrc ? <img src={thumbSrc} alt="" /> : null}
                                {isVideo ? <div className="news-play" aria-hidden="true" /> : null}
                              </div>
                            )
                          ) : null}

                          <div className="news-body">
                            {Array.isArray(post.tags) && post.tags.length ? (
                              <div className="news-tags" aria-label="Tags">
                                {post.tags
                                  .map((t) => String(t || '').trim())
                                  .filter(Boolean)
                                  .map((t) => (
                                    <span key={t} className="news-tag">
                                      {t.toUpperCase()}
                                    </span>
                                  ))}
                              </div>
                            ) : post.type ? (
                              <div className="news-tags" aria-label="Tags">
                                <span className="news-tag">{String(post.type || '').toUpperCase()}</span>
                              </div>
                            ) : null}

                            <h3 className="news-headline">{post.title}</h3>
                            {post.date ? <div className="news-date">{post.date}</div> : null}

                            {post.excerptHtml ? (
                              <div
                                ref={(el) => {
                                  excerptRefs.current[String(post.id)] = el;
                                }}
                                className={`news-excerpt ${isExpanded ? 'news-excerpt--expanded' : ''} ${isClamped ? 'is-overflow' : ''}`.trim()}
                                dangerouslySetInnerHTML={{ __html: post.excerptHtml }}
                              />
                            ) : post.excerpt ? (
                              <p
                                ref={(el) => {
                                  excerptRefs.current[String(post.id)] = el;
                                }}
                                className={`news-excerpt ${isExpanded ? 'news-excerpt--expanded' : ''} ${isClamped ? 'is-overflow' : ''}`.trim()}
                              >
                                {post.excerpt}
                              </p>
                            ) : null}

                            {isClamped ? (
                              <button
                                type="button"
                                className="news-readmore"
                                onClick={() => setOpenNewsPost(post)}
                                aria-expanded={isExpanded}
                              >
                                {langKey === 'pt' ? (isExpanded ? 'Ler menos' : 'Ler mais…') : isExpanded ? 'Read less' : 'Read more…'}
                              </button>
                            ) : null}

                            {hasCtaLink ? (
                              <a className="news-cta" href={post.ctaUrl} target="_blank" rel="noreferrer" onClick={(e) => { e.preventDefault(); setOpenNewsPost(post); }}>
                                {post.ctaText || (langKey === 'pt' ? 'LER MAIS' : 'READ MORE')}
                              </a>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>

              {newsIndex < maxNewsScrollIndex ? (
                <button
                  type="button"
                  className="news-nav news-next"
                  aria-label="Próximo"
                  onClick={() => goNewsScrollIndex(newsIndex + 1)}
                >
                  ›
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section id="discografia" className={`discography reveal${!sectionVisible.discografia ? ' section-hidden' : ''}`} aria-label="Discografia" style={sectionBgStyle.discografia}>
          <SectionBg bg={sectionBg.discografia} />
          <div className="discography-inner">
            <h2 className="discography-title">{isPt ? 'DISCOGRAFIA' : 'DISCOGRAPHY'}</h2>

            <div className="discography-grid" aria-label="Lançamentos">
              {discography.length ? (
                discography.map((rel) => {
                  const kind = String(rel.type || '').toUpperCase();
                  const year = String(rel.year || '').trim();
                  const title = String(rel.title || '').trim();
                  const cover = String(rel.coverUrl || '').trim();

                  return (
                    <article
                      key={rel.id}
                      className="discography-card reveal-item"
                      style={cover ? { '--disco-cover-url': `url(${cover})` } : undefined}
                      aria-label={`${title || (langKey === 'pt' ? 'Lançamento' : 'Release')}${year ? ` (${year})` : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenReleaseId(String(rel.id))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setOpenReleaseId(String(rel.id));
                      }}
                    >
                      <div className="discography-cover">
                        <img src={cover || 'https://via.placeholder.com/800x800?text=Cover'} alt={title ? `Capa de ${title}` : 'Capa do lançamento'} />
                      </div>

                      <div className="discography-meta">
                        <div className="discography-info">
                          <div className="discography-kind">{kind || 'RELEASE'}</div>
                          <div className="discography-name">{title || (langKey === 'pt' ? 'LANÇAMENTO' : 'RELEASE')}</div>
                          <div className="discography-tracks">
                            {rel.tracks && rel.tracks.length > 0
                              ? `${rel.tracks.length} ${langKey === 'pt' ? (rel.tracks.length === 1 ? 'FAIXA' : 'FAIXAS') : (rel.tracks.length === 1 ? 'TRACK' : 'TRACKS')}`
                              : (langKey === 'pt' ? 'SEM FAIXAS' : 'NO TRACKS')}
                          </div>
                        </div>
                        {year ? <div className="discography-year">{year}</div> : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="discography-empty">{langKey === 'pt' ? 'SEM ITENS' : 'NO ITEMS'}</div>
              )}
            </div>
          </div>
        </section>

        {openRelease ? (
          <div
            className="site-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={langKey === 'pt' ? 'Detalhes do lançamento' : 'Release details'}
            onMouseDown={() => setOpenReleaseId(null)}
          >
            <div className="site-modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="site-modal-header">
                <button type="button" className="site-modal-close" onClick={() => setOpenReleaseId(null)} aria-label="Fechar">
                  ×
                </button>
              </div>

              <div className="site-modal-body">
                <div className="disco-modal-grid">
                  <div className="disco-modal-left-panel">
                    <div className="disco-modal-cover">
                      <img src={openRelease.coverUrl || 'https://via.placeholder.com/800x800?text=Cover'} alt={openRelease.title ? `Capa de ${openRelease.title}` : 'Capa do lançamento'} />
                    </div>

                    <div className="disco-modal-info">
                      <h2 className="disco-modal-title">{String(openRelease.title || '').toUpperCase()}</h2>
                      <div className="disco-modal-kicker">
                        {String(openRelease.type || '').toUpperCase()}
                        {openRelease.year ? ` • ${openRelease.year}` : ''}
                        {openRelease.tracks && openRelease.tracks.length > 0 ? ` • ${openRelease.tracks.length} ${langKey === 'pt' ? (openRelease.tracks.length === 1 ? 'FAIXA' : 'FAIXAS') : (openRelease.tracks.length === 1 ? 'TRACK' : 'TRACKS')}` : ''}
                      </div>

                      <div className="disco-modal-links" aria-label={langKey === 'pt' ? 'Plataformas' : 'Platforms'}>
                        {openRelease?.links?.spotify ? (
                          <a className="disco-modal-link-icon" href={openRelease.links.spotify} target="_blank" rel="noreferrer" title="Spotify">
                            <img src={require('./assets/spotify.png')} alt="Spotify" />
                          </a>
                        ) : null}
                        {openRelease?.links?.apple ? (
                          <a className="disco-modal-link-icon" href={openRelease.links.apple} target="_blank" rel="noreferrer" title="Apple Music">
                            <img src={require('./assets/apple.png')} alt="Apple Music" />
                          </a>
                        ) : null}
                        {openRelease?.links?.deezer ? (
                          <a className="disco-modal-link-icon" href={openRelease.links.deezer} target="_blank" rel="noreferrer" title="Deezer">
                            <img src={require('./assets/deezer.png')} alt="Deezer" />
                          </a>
                        ) : null}
                        {openRelease?.links?.youtubeMusic ? (
                          <a className="disco-modal-link-icon" href={openRelease.links.youtubeMusic} target="_blank" rel="noreferrer" title="YouTube Music">
                            <img src={require('./assets/youtube-music.png')} alt="YouTube Music" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="disco-modal-right-panel">
                    {Array.isArray(openRelease.tracks) && openRelease.tracks.length ? (
                      <div className="disco-modal-tracks" aria-label={langKey === 'pt' ? 'Faixas' : 'Tracks'}>
                        <div className="disco-modal-section-title">{langKey === 'pt' ? 'FAIXAS' : 'TRACKS'}</div>
                        <ol className="disco-modal-tracklist">
                          {openRelease.tracks.map((t, idx) => {
                            let youtubeId = '';
                            if (t.youtubeUrl) {
                              try {
                                const url = new URL(t.youtubeUrl);
                                if (url.hostname.includes('youtu.be')) {
                                  youtubeId = url.pathname.replace('/', '');
                                } else if (url.hostname.includes('youtube.com')) {
                                  youtubeId = url.searchParams.get('v') || '';
                                  if (!youtubeId && url.pathname.startsWith('/embed/')) {
                                    youtubeId = url.pathname.split('/embed/')[1]?.split('/')[0] || '';
                                  }
                                }
                              } catch {}
                            }
                            const isLyricsOpen = lyricsTrackId === t.id;
                            const isHidden = lyricsTrackId && !isLyricsOpen;
                            return (
                              <li
                                key={t.id}
                                className={`disco-modal-track${isHidden ? ' disco-modal-track--hidden' : ''}`}
                                style={previewTrackId === t.id ? { '--track-progress': previewProgress } : undefined}
                              >
                                <div className="disco-modal-track-row">
                                  <span className="disco-modal-track-num">{idx + 1}.</span>
                                  <span className="disco-modal-track-name">{t.name}</span>
                                  {t.lyrics ? (
                                    <button
                                      type="button"
                                      className={`disco-modal-track-link disco-modal-track-link--lyrics${isLyricsOpen ? ' is-playing' : ''}`}
                                      aria-label={langKey === 'pt' ? 'Ver letra' : 'View lyrics'}
                                      onClick={() => setLyricsTrackId(isLyricsOpen ? null : t.id)}
                                    >
                                      {langKey === 'pt' ? 'LETRA' : 'LYRICS'}
                                    </button>
                                  ) : null}
                                  {t.youtubeUrl ? (
                                    <button
                                      type="button"
                                      className={`disco-modal-track-link${previewTrackId === t.id ? ' is-playing' : ''}`}
                                      aria-label={langKey === 'pt' ? 'Preview da faixa' : 'Track preview'}
                                      onClick={() => setPreviewTrackId(previewTrackId === t.id ? null : t.id)}
                                    >
                                      <span className="disco-modal-preview-icon" aria-hidden="true" />
                                      PREVIEW
                                    </button>
                                  ) : null}
                                  {previewTrackId === t.id && youtubeId ? (
                                    <div className="disco-modal-preview-iframe-wrap" style={{ overflow: 'hidden', height: '1px', width: '1px', position: 'absolute', pointerEvents: 'none' }}>
                                      <iframe
                                        width="1"
                                        height="1"
                                        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&start=${Math.floor(t.startSec || 0)}&end=${Math.floor(t.endSec || 0)}`}
                                        title={t.name}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      />
                                    </div>
                                  ) : null}
                                </div>
                                {isLyricsOpen ? (
                                  <div className="disco-modal-lyrics-wrap">
                                    <div className="disco-modal-lyrics-timeline" style={{ '--timeline-w': `${Math.round((previewTrackId === t.id ? previewProgress : 0) * 100)}%` }} />
                                    <div className="disco-modal-lyrics">{t.lyrics}</div>
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ) : (
                      <div className="disco-modal-empty-tracks">
                        {langKey === 'pt' ? 'Nenhuma faixa cadastrada.' : 'No tracks listed.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <section id="contato" className={`contact reveal${!sectionVisible.contato ? ' section-hidden' : ''}`} aria-label="Contato" style={sectionBgStyle.contato}>
          <SectionBg bg={sectionBg.contato} />
          <div className="contact-inner">
            <h2 className="contact-title">{isPt ? 'CONTATO' : 'CONTACT'}</h2>

            <div className="contact-grid">
              <div className="contact-left">
                <div className="contact-block">
                  <div className="contact-kicker">BOOKING & MANAGEMENT</div>
                  <a className="contact-email" href="mailto:ai.mindofadeadbody@gmail.com">
                    ai.mindofadeadbody@gmail.com
                  </a>
                </div>

                <div className="contact-block">
                  <div className="contact-kicker">{isPt ? 'APOIE O PROJETO' : 'SUPPORT THE PROJECT'}</div>
                  <p className="contact-help">
                    {isPt ? 'Sua contribuição ajuda a manter viva a chama do metal independente.' : 'Your contribution helps keep the flame of independent metal alive.'}
                  </p>
                  <div className="contact-support-btns">
                    <button type="button" className="support-opt support-opt--pix" onClick={() => { setSupportPix(true); setSupportOpen(true); }}>
                      <img className="contact-pix-icon" src={pixPng} alt="" aria-hidden="true" />
                      PIX
                    </button>
                    <button type="button" className="support-opt support-opt--bmc" onClick={() => { const btn = document.querySelector('#bmc-wbtn'); if(btn){ btn.style.pointerEvents='auto'; btn.click(); btn.style.pointerEvents='none'; } }}>
                      <img src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg" alt="" width="20" height="20" />
                      BUY ME A COFFEE
                    </button>
                  </div>
                </div>
              </div>

              <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
                <label className="contact-field">
                  <span className="sr-only">{isPt ? 'Nome' : 'Name'}</span>
                  <input type="text" name="name" placeholder={isPt ? 'NOME' : 'NAME'} autoComplete="name" />
                </label>

                <label className="contact-field">
                  <span className="sr-only">E-mail</span>
                  <input type="email" name="email" placeholder="E-MAIL" autoComplete="email" />
                </label>

                <label className="contact-field">
                  <span className="sr-only">{isPt ? 'Assunto' : 'Subject'}</span>
                  <input type="text" name="subject" placeholder={isPt ? 'ASSUNTO' : 'SUBJECT'} />
                </label>

                <label className="contact-field contact-field-message">
                  <span className="sr-only">{isPt ? 'Mensagem' : 'Message'}</span>
                  <textarea name="message" placeholder={isPt ? 'MENSAGEM' : 'MESSAGE'} rows={6} />
                </label>

                <button className="contact-submit contact-submit--full" type="submit">
                  {isPt ? 'ENVIAR MENSAGEM' : 'SEND MESSAGE'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer" aria-label="Rodapé">
        <div className="site-footer-inner">
          <div className="footer-icons" aria-label="Links">
            <div className="footer-platforms">
              <a className="footer-icon" href="https://open.spotify.com/intl-pt/artist/7zLPRu5akdcZHeDbVMm3o8" target="_blank" rel="noreferrer" aria-label="Spotify">
                <img src={spotifyIcon} alt="Spotify" />
              </a>
              <a className="footer-icon" href="https://music.apple.com/br/artist/mind-of-a-dead-body/1880815220" target="_blank" rel="noreferrer" aria-label="Apple Music">
                <img src={appleIcon} alt="Apple Music" />
              </a>
              <a className="footer-icon" href="https://www.deezer.com/br/artist/375893561" target="_blank" rel="noreferrer" aria-label="Deezer">
                <img src={deezerIcon} alt="Deezer" />
              </a>
              <a className="footer-icon" href="https://music.youtube.com/channel/UCWuiRQ6qg-tMImAazjifIGg" target="_blank" rel="noreferrer" aria-label="YouTube Music">
                <img src={youtubeMusicIcon} alt="YouTube Music" />
              </a>
            </div>
            <span className="footer-sep">|</span>
            <div className="footer-socials">
              <a className="footer-icon" href="https://www.instagram.com/mindofadeadbody" target="_blank" rel="noreferrer" aria-label="Instagram">
                <img src={instagramPng} alt="Instagram" />
              </a>
              <a className="footer-icon" href="https://www.tiktok.com/@mindofadeadbody" target="_blank" rel="noreferrer" aria-label="TikTok">
                <img src={tiktokIcon} alt="TikTok" />
              </a>
              <a className="footer-icon" href="https://www.youtube.com/@mindofadeadbody" target="_blank" rel="noreferrer" aria-label="YouTube">
                <img src={youtubeIcon} alt="YouTube" />
              </a>
            </div>
          </div>

          <div className="footer-copy">© {new Date().getFullYear()} MIND OF A DEAD BODY</div>
        </div>
      </footer>

      {openNewsPost && (
        <div className="news-modal-backdrop" onMouseDown={() => setOpenNewsPost(null)}>
          <div className="news-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="news-modal-close" onClick={() => setOpenNewsPost(null)} aria-label="Fechar">×</button>
            <div className="news-modal-inner">
            {(openNewsPost.mediaKind === 'video' || openNewsPost.mediaKind === 'video_vertical') && openNewsPost.mediaUrl ? (
              openNewsPost.mediaUrl.includes('instagram.com') ? (
                <a className="news-modal-external" href={openNewsPost.mediaUrl} target="_blank" rel="noreferrer">
                  <span>&#9654;</span> {isPt ? 'Assistir no Instagram' : 'Watch on Instagram'}
                </a>
              ) : (
              <div className="news-modal-video">
                <iframe
                  src={(() => { try { const u = new URL(openNewsPost.mediaUrl); const id = u.searchParams.get('v') || (u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.pathname.split('/shorts/')[1]?.split('?')[0] || u.pathname.split('/embed/')[1]?.split('/')[0] || u.pathname.slice(1)); return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : openNewsPost.mediaUrl; } catch { return openNewsPost.mediaUrl; } })()}
                  title={openNewsPost.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              )
            ) : openNewsPost.image ? (
              <img className="news-modal-img" src={openNewsPost.image} alt="" />
            ) : null}
            <div className="news-modal-body">
              {openNewsPost.tags?.length ? (
                <div className="news-tags">{openNewsPost.tags.map(t => <span key={t} className="news-tag">{t.toUpperCase()}</span>)}</div>
              ) : null}
              <h2 className="news-modal-title">{openNewsPost.title}</h2>
              {openNewsPost.date ? <div className="news-date">{openNewsPost.date}</div> : null}
              {openNewsPost.excerptHtml ? (
                <div className="news-modal-text" dangerouslySetInnerHTML={{ __html: openNewsPost.excerptHtml }} />
              ) : openNewsPost.excerpt ? (
                <p className="news-modal-text">{openNewsPost.excerpt}</p>
              ) : null}
              {openNewsPost.ctaUrl ? (
                <a className="news-cta" href={openNewsPost.ctaUrl} target="_blank" rel="noreferrer">
                  {openNewsPost.ctaText || (langKey === 'pt' ? 'LER MAIS' : 'READ MORE')}
                </a>
              ) : null}
            </div>
            </div>
          </div>
        </div>
      )}

      <div className="support-float">
        {supportOpen && (
          <div className={`support-panel${supportClosing ? ' support-panel--out' : ''}`}>
            {!supportPix ? (
              <>
                <div className="support-panel-title">{isPt ? 'APOIE O PROJETO' : 'SUPPORT THE PROJECT'}</div>
                <button className="support-opt support-opt--pix" onClick={() => setSupportPix(true)}>
                  <img className="contact-pix-icon" src={pixPng} alt="" aria-hidden="true" />
                  PIX
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
            ) : (
              <>
                <button className="support-back support-close" onClick={closeSupport} aria-label="Fechar">✕</button>
                <div className="support-panel-title">PIX</div>
                <a
                  href="https://nubank.com.br/cobrar/31oy9/69b56c23-57b5-4a7e-b7cf-4622fdddce9b"
                  target="_blank"
                  rel="noreferrer"
                  className="contact-pix-qr-link"
                >
                  <img
                    className="contact-pix-qr"
                    src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=d9c7d8b2-52f0-4709-a8d0-ca826b1b7def&bgcolor=0d0d0d&color=ffffff&margin=10"
                    alt="QR Code PIX"
                  />
                </a>
                <div className="contact-pix-key-wrap">
                  <span className="contact-pix-key-label">CHAVE PIX</span>
                  <button
                    type="button"
                    className="contact-pix-copy"
                    onClick={() => navigator.clipboard.writeText('d9c7d8b2-52f0-4709-a8d0-ca826b1b7def')}
                  >
                    <span className="contact-pix-key-value">d9c7d8b2-52f0-4709-a8d0-ca826b1b7def</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                  </button>
                </div>
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

export default App;
