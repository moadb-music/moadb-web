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

  // UI state: toggle platform links for featured release
  const [featuredPlatformsOpen, setFeaturedPlatformsOpen] = useState(false);
  const featuredIdsKey = (homeCfg.featuredReleaseIds || []).join('|');

  const [pagesContent, setPagesContent] = useState(null);
  const [shopCfg, setShopCfg] = useState({ storeUrl: '', items: [] });
  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState('');

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

    const unsubDisco = onSnapshot(doc(db, 'siteData', 'moadb_discography'), (snap) => {
      const raw = snap.exists() ? (snap.data()?.content ?? snap.data() ?? {}) : {};
      const content = Array.isArray(raw) ? raw : Array.isArray(raw.content) ? raw.content : Array.isArray(snap.data()?.content) ? snap.data().content : [];
      const list = (content || [])
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
        }))
        .filter((x) => x.id);
      setDiscography(list);
    });

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

  // ===== NEWS carousel state (4 por vez / 12 no total) =====
  const [newsIndex, setNewsIndex] = useState(0);

  const visibleNewsItems = useMemo(() => {
    const list = Array.isArray(newsItems) ? newsItems : [];
    return list.slice(0, 12);
  }, [newsItems]);

  // ===== NEWS carousel state (anda de 1 em 1 item; 4 visíveis) =====
  const newsVisibleCount = 4;
  const maxNewsScrollIndex = Math.max(0, visibleNewsItems.length - newsVisibleCount);

  const scrolledNewsItems = useMemo(() => visibleNewsItems.slice(newsIndex, newsIndex + newsVisibleCount), [visibleNewsItems, newsIndex]);

  useEffect(() => {
    setNewsIndex((i) => Math.min(i, maxNewsScrollIndex));
  }, [maxNewsScrollIndex]);

  function goNewsScrollIndex(next) {
    setNewsIndex(() => Math.max(0, Math.min(next, maxNewsScrollIndex)));
  }

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

            <div className="shop-carousel" aria-label="Carrossel de produtos">
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
                  style={{ transform: `translateX(-${shopIndex * (100 / slidesPerPage)}%)` }}
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

              <div className="news-viewport">
                <div
                  className="news-track"
                  style={{
                    width: '100%',
                    transform: `translateX(-${newsIndex * (100 / Math.max(1, newsVisibleCount))}%)`,
                    transition: 'transform .55s cubic-bezier(.22, 1, .36, 1)',
                    willChange: 'transform',
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
                    (scrolledNewsItems || []).map((post) => {
                      const isVideo = post.mediaKind === 'video' || post.mediaKind === 'video_vertical';
                      const mediaHref = post.mediaUrl || post.ctaUrl || '';
                      const thumbSrc = post.image || (isVideo ? getVideoThumbnail(post.mediaUrl) : '') || '';
                      const hasMedia = Boolean(thumbSrc || (isVideo && post.mediaUrl));

                      return (
                        <article key={post.id} className={`news-card ${hasMedia ? '' : 'news-card--text'}`.trim()}>
                          {hasMedia ? (
                            mediaHref ? (
                              <a
                                className="news-media"
                                href={mediaHref}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={isVideo ? 'Abrir vídeo' : 'Abrir notícia'}
                              >
                                {thumbSrc ? <img src={thumbSrc} alt="" /> : null}
                                {isVideo ? <div className="news-play" aria-hidden="true" /> : null}
                              </a>
                            ) : (
                              <div className="news-media">
                                {thumbSrc ? <img src={thumbSrc} alt="" /> : null}
                                {isVideo ? <div className="news-play" aria-hidden="true" /> : null}
                              </div>
                            )
                          ) : null}

                          <div className="news-body">
                            {Array.isArray(post.tags) && post.tags.length ? (
                              <div className="news-tag">{String(post.tags[0] || '').toUpperCase()}</div>
                            ) : post.type ? (
                              <div className="news-tag">{post.type}</div>
                            ) : null}

                            {post.date ? <div className="news-date">{post.date}</div> : null}
                            <h3 className="news-headline">{post.title}</h3>

                            {post.excerptHtml ? (
                              <div className="news-excerpt" dangerouslySetInnerHTML={{ __html: post.excerptHtml }} />
                            ) : post.excerpt ? (
                              <p className="news-excerpt">{post.excerpt}</p>
                            ) : null}

                            <a
                              className="news-cta"
                              href={post.ctaUrl || '#'}
                              onClick={(e) => {
                                if (!post.ctaUrl) e.preventDefault();
                              }}
                              target={post.ctaUrl ? '_blank' : undefined}
                              rel={post.ctaUrl ? 'noreferrer' : undefined}
                            >
                              {post.ctaText || (langKey === 'pt' ? 'LER MAIS' : 'READ MORE')}
                            </a>
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
              <article className="discography-card" aria-label="Silent Rebirth (2024)">
                <div className="discography-cover">
                  <img
                    src="https://via.placeholder.com/800x800?text=Cover"
                    alt="Capa do álbum Silent Rebirth"
                  />
                </div>

                <div className="discography-meta">
                  <div className="discography-kind">ALBUM</div>
                  <div className="discography-name">SILENT REBIRTH</div>
                  <div className="discography-year">2024</div>
                </div>
              </article>
            </div>
          </div>
        </section>

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
                    Sua contribuição ajuda a manter viva a chama do metal
                    independente. Apoie via PIX:
                  </p>

                  <button type="button" className="contact-pix">
                    <span className="contact-pix-icon" aria-hidden="true" />
                    APOIAR (PIX)
                  </button>
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
                  <span className="sr-only">Mensagem</span>
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
            <a className="footer-icon" href="/" aria-label="Instagram">
              <img src={instagramPng} alt="" />
            </a>
            <button className="footer-icon" type="button" aria-label="PIX">
              <img src={pixPng} alt="" />
            </button>
          </div>

          <div className="footer-copy">© {new Date().getFullYear()} MIND OF A DEAD BODY</div>
        </div>
      </footer>
    </div>
  );
}

export default App;
