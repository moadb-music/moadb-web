import { useEffect, useRef, useState, useMemo } from 'react';
import './App.css';
import logoPng from './assets/logo.png';
import aboutLogoMark from './assets/logo-mark.png';
import instagramPng from './assets/instagram.png';
import pixPng from './assets/pix.png';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
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

function normalizeNewsFromDb(data) {
  const d = data || {};
  const content = d.content && typeof d.content === 'object' ? d.content : {};
  const rawItems = Array.isArray(content.items)
    ? content.items
    : Array.isArray(content.posts)
      ? content.posts
      : Array.isArray(d.items)
        ? d.items
        : [];

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
        title: String(it?.title || ''),
        excerptHtml: String(it?.excerptHtml || ''),
        excerpt: String(it?.excerpt || it?.description || it?.text || ''),
        ctaText: String(it?.ctaText || it?.cta || ''),
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
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <rect width="24" height="24" fill="#009b3a" />
      <polygon points="12,3 21,12 12,21 3,12" fill="#ffdf00" />
      <circle cx="12" cy="12" r="5" fill="#002776" />
      <path d="M7.2 11.2c2.3-1 7.1-1 9.6.1" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function FlagUK(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <rect width="24" height="24" fill="#012169" />
      <path d="M0 0L24 24M24 0L0 24" stroke="#fff" strokeWidth="6" />
      <path d="M0 0L24 24M24 0L0 24" stroke="#C8102E" strokeWidth="3" />
      <path d="M12 0v24M0 12h24" stroke="#fff" strokeWidth="8" />
      <path d="M12 0v24M0 12h24" stroke="#C8102E" strokeWidth="4" />
    </svg>
  );
}

function App() {
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState('pt-BR');
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
  const featuredIdsKey = (homeCfg.featuredReleaseIds || []).join('|');

  const [pagesContent, setPagesContent] = useState(null);
  const [shopCfg, setShopCfg] = useState({ storeUrl: '', items: [] });
  const [newsItems, setNewsItems] = useState([]);
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
        featuredTitle: typeof raw.featuredTitle === 'string' && raw.featuredTitle.trim() ? raw.featuredTitle : 'OUÇA AGORA',
        featuredButtonLabel:
          typeof raw.featuredButtonLabel === 'string' && raw.featuredButtonLabel.trim() ? raw.featuredButtonLabel : 'OUVIR AGORA',
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
          const normalized = normalizeNewsFromDb(data);

          // Diagnóstico: ajuda a entender se o doc existe, qual o shape e quantos itens saíram da normalização
          console.info('[NEWS] onSnapshot ok', {
            path: 'siteData/moadb_news',
            exists,
            keys: data && typeof data === 'object' ? Object.keys(data) : [],
            contentKeys:
              data?.content && typeof data.content === 'object' ? Object.keys(data.content) : [],
            rawItemsCount: Array.isArray(data?.content?.items)
              ? data.content.items.length
              : Array.isArray(data?.content?.posts)
                ? data.content.posts.length
                : Array.isArray(data?.items)
                  ? data.items.length
                  : 0,
            normalizedCount: normalized.length,
          });

          setNewsItems(normalized);
        } catch (e) {
          console.error('[NEWS] normalize failed', e);
          setNewsLoading(false);
          setNewsError('normalize-failed');
          setNewsItems([]);
        }
      },
      (err) => {
        // Não deixa falhar silenciosamente: isso é a causa mais comum de "não aparece"
        console.error('[NEWS] onSnapshot error', err);
        setNewsLoading(false);
        setNewsError(String(err?.code || err?.message || 'unknown'));
        setNewsItems([]);
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
    let cancelled = false;
    async function loadPages() {
      try {
        const ref = doc(db, ...PAGES_DOC_PATH);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data();
        const content = data?.content ?? data;
        if (!cancelled) setPagesContent(content);
      } catch {
        // silencioso: mantém placeholders
      }
    }
    loadPages();
    return () => {
      cancelled = true;
    };
  }, []);

  const langKey = useMemo(() => (String(lang || '').toLowerCase().startsWith('pt') ? 'pt' : 'en'), [lang]);
  const aboutFromDb = useMemo(() => normalizeAboutFromPagesDoc(pagesContent || {}), [pagesContent]);
  const shopItems = useMemo(() => shopCfg?.items || [], [shopCfg]);
  const shopStoreUrl = String(shopCfg?.storeUrl || '').trim();

  const [shopIndex, setShopIndex] = useState(0);
  const slidesPerPage = 5;
  const totalSlides = shopItems.length + 1; // +1 for the "ver mais" card
  const maxShopIndex = Math.max(0, totalSlides - slidesPerPage);

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function goShopIndex(next) {
    setShopIndex(() => clamp(next, 0, maxShopIndex));
  }

  useEffect(() => {
    // se a lista diminuir, evita índice fora do range
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
        if (!e.isIntersecting) setFeaturedPlatformsOpen(false);
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
  const newsVisibleCount = 4;
  const newsViewportRef = useRef(null);

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

  return (
    <div className="app-container">
      <div className="bg-layer" aria-hidden="true" />

      <nav className="top-nav" aria-label="Navegação principal">
        <a className="nav-logo-wrap" href="#inicio" aria-label="Ir para Início">
          <img className="nav-logo" src={logoPng} alt="Mind of a Dead Body" />
        </a>

        <div className="nav-links" role="navigation" aria-label="Seções">
          <a href="#inicio">INÍCIO</a>
          <a href="#sobre">SOBRE</a>
          <a href="#loja">LOJA</a>
          <a href="#noticias">NOTÍCIAS</a>
          <a href="#discografia">DISCOGRAFIA</a>
          <a href="#contato">CONTATO</a>
        </div>

        <div className="lang-dropdown" ref={langRef}>
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
      </nav>

      <main>
        <section id="inicio" className="hero" aria-label="Início">
          <div className="hero-inner">
            {!(homeCfg.featuredEnabled && featuredPrimary) ? (
              <h1 className="hero-title">
                <span>MIND OF A</span>
                <span>DEAD BODY</span>
              </h1>
            ) : null}

            {homeCfg.featuredEnabled && featuredPrimary ? (
              <div className="home-featured" aria-label="Novos Lançamentos">
                <div className="home-featured-head">
                  <div className="home-featured-page-title">{String(homeCfg.featuredTitle || 'OUÇA AGORA').toUpperCase()}</div>
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
                            setFeaturedPlatformsOpen(true);
                          }}
                          title={platformList.length === 0 ? 'Sem links configurados — rolando para a Discografia' : 'Mostrar plataformas'}
                        >
                          {String(homeCfg.featuredButtonLabel || 'OUVIR AGORA').toUpperCase()}
                        </button>
                      ) : (
                        <div className="home-featured-platform-icons-wrap" aria-label="Plataformas">
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
                            onClick={() => setFeaturedPlatformsOpen(false)}
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

        <section id="sobre" className="about" aria-label="Sobre">
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

        <section id="loja" className="shop" aria-label="Loja">
          <div className="shop-inner">
            <h2 className="shop-title">LOJA</h2>

            <div class="shop-carousel" aria-label="Carrossel de produtos">
              {shopIndex > 0 && (
                <button
                  type="button"
                  class="shop-nav-btn prev"
                  onClick={() => goShopIndex(shopIndex - 1)}
                  aria-label="Anterior"
                >
                  ‹
                </button>
              )}

              <div class="shop-viewport">
                <div
                  class="shop-track"
                  style={{ transform: `translateX(-${shopIndex * (100 / slidesPerPage)}%)` }}
                >
                  {shopItems.map(item => (
                    <div key={item.id} class="shop-slide">
                      <a
                        class="shop-card shop-card-link"
                        href={item.href || shopStoreUrl || '#'}
                        target={item.href || shopStoreUrl ? '_blank' : undefined}
                        rel={item.href || shopStoreUrl ? 'noreferrer' : undefined}
                        aria-label={`${langKey === 'pt' ? 'Comprar' : 'Buy'}: ${item.title || ''}`.trim()}
                        onClick={(e) => {
                          if (!(item.href || shopStoreUrl)) e.preventDefault();
                        }}
                      >
                        <div class="shop-image" style={item.bgColor ? { background: item.bgColor } : undefined}>
                          <img src={item.image} alt="" />
                        </div>
                        <div class="shop-desc">{item.title}</div>
                        <span class="shop-buy" aria-hidden="true">
                          {langKey === 'pt' ? 'COMPRAR' : 'BUY'}
                        </span>
                      </a>
                    </div>
                  ))}

                  <div class="shop-slide">
                    <a
                      class="shop-more"
                      href={shopStoreUrl || '#'}
                      target={shopStoreUrl ? '_blank' : undefined}
                      rel={shopStoreUrl ? 'noreferrer' : undefined}
                      aria-label={langKey === 'pt' ? 'Ver mais produtos' : 'See more products'}
                    >
                      <span class="shop-more-plus">+</span>
                      <span class="shop-more-text">{langKey === 'pt' ? 'VER MAIS' : 'SEE MORE'}</span>
                    </a>
                  </div>
                </div>
              </div>

              {shopIndex < maxShopIndex && (
                <button
                  type="button"
                  class="shop-nav-btn next"
                  onClick={() => goShopIndex(shopIndex + 1)}
                  aria-label="Próximo"
                >
                  ›
                </button>
              )}
            </div>

            <div class="shop-footer">
              <a
                class="shop-full btn-outline"
                href={shopStoreUrl || '#'}
                target={shopStoreUrl ? '_blank' : undefined}
                rel={shopStoreUrl ? 'noreferrer' : undefined}
              >
                {langKey === 'pt' ? 'VER LOJA COMPLETA' : 'SEE MORE'}
              </a>
            </div>
          </div>
        </section>

        <section id="noticias" className="news" aria-label="Notícias">
          <div className="news-inner">
            <h2 className="news-title">NOTÍCIAS</h2>

            <div className="news-carousel" aria-label="Carrossel de notícias">
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
                    transform: `translateX(-${newsIndex * (100 / newsVisibleCount)}%)`,
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
                          className={`news-card ${hasMedia ? '' : 'news-card--text'} ${isExpanded ? 'news-card--expanded' : ''}`.trim()}
                        >
                          {hasMedia ? (
                            mediaHref ? (
                              <a
                                className={`news-media ${thumbSrc ? 'has-thumb-bg' : ''}`.trim()}
                                style={thumbSrc ? { '--news-thumb-url': `url(${thumbSrc})` } : undefined}
                                href={mediaHref}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={isVideo ? 'Abrir vídeo' : 'Abrir notícia'}
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
                                onClick={() => toggleNewsExpanded(String(post.id))}
                                aria-expanded={isExpanded}
                              >
                                {langKey === 'pt' ? (isExpanded ? 'Ler menos' : 'Ler mais…') : isExpanded ? 'Read less' : 'Read more…'}
                              </button>
                            ) : null}

                            {hasCtaLink ? (
                              <a className="news-cta" href={post.ctaUrl} target="_blank" rel="noreferrer">
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

        <section id="discografia" className="discography" aria-label="Discografia">
          <div className="discography-inner">
            <h2 className="discography-title">DISCOGRAFIA</h2>

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
                      className="discography-card"
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

        <section id="contato" className="contact" aria-label="Contato">
          <div className="contact-inner">
            <h2 className="contact-title">CONTATO</h2>

            <div className="contact-grid">
              <div className="contact-left">
                <div className="contact-block">
                  <div className="contact-kicker">BOOKING &amp; MANAGEMENT</div>
                  <a className="contact-email" href="mailto:ai.mindofadeadbody@gmail.com">
                    ai.mindofadeadbody@gmail.com
                  </a>
                </div>

                <div className="contact-block">
                  <div className="contact-kicker">APOIE O PROJETO</div>
                  <p className="contact-help">
                    Sua contribuição ajuda a manter viva a chama do metal independente.
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
                  <span className="sr-only">Nome</span>
                  <input type="text" name="name" placeholder="NOME" autoComplete="name" />
                </label>

                <label className="contact-field">
                  <span className="sr-only">E-mail</span>
                  <input type="email" name="email" placeholder="E-MAIL" autoComplete="email" />
                </label>

                <label className="contact-field">
                  <span className="sr-only">Assunto</span>
                  <input type="text" name="subject" placeholder="ASSUNTO" />
                </label>

                <label className="contact-field contact-field-message">
                  <span class="sr-only">Mensagem</span>
                  <textarea name="message" placeholder="MENSAGEM" rows={6} />
                </label>

                <button className="contact-submit" type="submit">
                  ENVIAR MENSAGEM
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

      <div className="support-float">
        {supportOpen && (
          <div className="support-panel">
            {!supportPix ? (
              <>
                <div className="support-panel-title">APOIE O PROJETO</div>
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
                <button className="support-back" onClick={() => setSupportPix(false)}>← VOLTAR</button>
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
          onClick={() => { setSupportOpen(v => !v); setSupportPix(false); }}
          aria-label="Apoiar o projeto"
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
