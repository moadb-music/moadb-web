import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

import ImageGalleryModal from './components/ImageGalleryModal';

const PAGES_DOC_PATH = ['siteData', 'moadb_pages'];

const SECTIONS = [
  { key: 'main', label: 'PRINCIPAL' },
  { key: 'home', label: 'HOME' },
  { key: 'sobre', label: 'SOBRE' },
  { key: 'loja', label: 'LOJA' },
  { key: 'noticias', label: 'NOTÍCIAS' },
  { key: 'discografia', label: 'DISCOGRAFIA' },
  { key: 'contato', label: 'CONTATO' },
];

const DEFAULT_ORDER = SECTIONS.map((s) => s.key);

function makeDefaultBackground() {
  return {
    gradientEnabled: true,
    gradientFrom: '#000000',
    gradientTo: '#120000',
    gradientAngle: 180,
    gradientOpacity: 1,
    imageEnabled: true,
    imageUrl: '',
    imageOpacity: 0.35,
  };
}

function makeDefaultAboutSection() {
  return {
    title: { pt: '', en: '' },
    text: { pt: '', en: '' }, // HTML (rich text)
    imageUrl: '',
  };
}

function makeDefaultAbout() {
  return {
    // duas sessões editáveis
    sections: [
      {
        ...makeDefaultAboutSection(),
        // Subtítulo 1 (o título principal "SOBRE/ABOUT" é fixo no site e não é editável)
        title: { pt: '', en: '' },
      },
      {
        ...makeDefaultAboutSection(),
        // Subtítulo 2
        title: { pt: '', en: '' },
      },
    ],
  };
}

const DEFAULT_CONFIG = {
  backgroundsBySection: SECTIONS.reduce((acc, s) => {
    acc[s.key] = makeDefaultBackground();
    return acc;
  }, {}),
  about: makeDefaultAbout(),
  sectionOrder: DEFAULT_ORDER,
};

function clamp01(n) {
  const v = Number.isFinite(n) ? n : parseFloat(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clampAngle(n) {
  const v = Number.isFinite(n) ? n : parseFloat(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(360, v));
}

function alphaHex(color, opacity) {
  const c = typeof color === 'string' ? color : '#000000';
  if (!/^#([0-9a-fA-F]{6})$/.test(c)) return c;
  const a = Math.round(clamp01(opacity) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${c}${a}`;
}

function normalizeBackground(rawBg) {
  const bg = rawBg ?? {};
  const legacyColor = typeof bg.color === 'string' ? bg.color : null;
  const legacyImage = typeof bg.overlayImageUrl === 'string' && bg.overlayImageUrl ? bg.overlayImageUrl : typeof bg.baseImageUrl === 'string' ? bg.baseImageUrl : '';

  const next = makeDefaultBackground();
  next.gradientFrom = typeof bg.gradientFrom === 'string' ? bg.gradientFrom : legacyColor || next.gradientFrom;
  next.gradientTo = typeof bg.gradientTo === 'string' ? bg.gradientTo : legacyColor || next.gradientTo;
  next.gradientAngle = clampAngle(bg.gradientAngle ?? next.gradientAngle);
  next.gradientOpacity = clamp01(bg.gradientOpacity ?? bg.colorOpacity ?? next.gradientOpacity);

  if (typeof bg.gradientEnabled === 'boolean') {
    next.gradientEnabled = bg.gradientEnabled;
  } else if (typeof bg.gradientFromEnabled === 'boolean' || typeof bg.gradientToEnabled === 'boolean') {
    next.gradientEnabled = (bg.gradientFromEnabled !== false) || (bg.gradientToEnabled !== false);
  } else {
    next.gradientEnabled = true;
  }

  if (typeof bg.imageEnabled === 'boolean') {
    next.imageEnabled = bg.imageEnabled;
  } else {
    next.imageEnabled = true;
  }

  next.imageUrl = typeof bg.imageUrl === 'string' ? bg.imageUrl : legacyImage;
  next.imageOpacity = clamp01(bg.imageOpacity ?? bg.overlayOpacity ?? next.imageOpacity);
  return next;
}

function normalizeDoc(data) {
  const raw = data?.content ?? data ?? {};
  const backgroundsBySection = raw.backgroundsBySection ?? raw.backgrounds ?? raw.sections ?? null;

  const singleLegacyBg = raw.background ?? raw.bg ?? null;

  const acc = {};
  SECTIONS.forEach((s) => {
    if (backgroundsBySection && backgroundsBySection[s.key]) {
      acc[s.key] = normalizeBackground(backgroundsBySection[s.key]);
    } else if (singleLegacyBg) {
      acc[s.key] = normalizeBackground(singleLegacyBg);
    } else {
      acc[s.key] = makeDefaultBackground();
    }
  });

  const aboutRaw = raw.about ?? raw.sobre ?? {};

  const isMainAboutTitle = (v) => {
    const s = String(v || '').trim().toLowerCase();
    return s === 'sobre' || s === 'about';
  };

  // Novo formato: about.sections[]
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

    while (sections.length < 2) sections.push(makeDefaultAbout().sections[sections.length]);

    // Garantia extra: se alguém salvou o título principal como subtítulo por engano, limpa.
    sections.forEach((sec) => {
      if (isMainAboutTitle(sec?.title?.pt)) sec.title.pt = '';
      if (isMainAboutTitle(sec?.title?.en)) sec.title.en = '';
    });

    const sectionOrder = Array.isArray(raw.sectionOrder) ? raw.sectionOrder : DEFAULT_ORDER;
  return { backgroundsBySection: acc, about: { sections }, sectionOrder };
  }

  // Legacy: about.title/text/imageUrl (mantém como Subtítulo 1 / Texto 1; o heading "SOBRE" continua fixo)
  const legacyTitlePT = typeof aboutRaw?.title?.pt === 'string' ? aboutRaw.title.pt : typeof aboutRaw?.titlePT === 'string' ? aboutRaw.titlePT : '';
  const legacyTitleEN = typeof aboutRaw?.title?.en === 'string' ? aboutRaw.title.en : typeof aboutRaw?.titleEN === 'string' ? aboutRaw.titleEN : '';

  const about = {
    sections: [
      {
        title: {
          pt: isMainAboutTitle(legacyTitlePT) ? '' : legacyTitlePT,
          en: isMainAboutTitle(legacyTitleEN) ? '' : legacyTitleEN,
        },
        text: {
          pt: typeof aboutRaw?.text?.pt === 'string' ? aboutRaw.text.pt : typeof aboutRaw?.textPT === 'string' ? aboutRaw.textPT : '',
          en: typeof aboutRaw?.text?.en === 'string' ? aboutRaw.text.en : typeof aboutRaw?.textEN === 'string' ? aboutRaw.textEN : '',
        },
        imageUrl: typeof aboutRaw?.imageUrl === 'string' ? aboutRaw.imageUrl : '',
      },
      makeDefaultAbout().sections[1],
    ],
  };

  const sectionOrder = Array.isArray(raw.sectionOrder) ? raw.sectionOrder : DEFAULT_ORDER;
  return { backgroundsBySection: acc, about, sectionOrder };
}

function backgroundToPreviewStyle(bg) {
  const enabled = bg.gradientEnabled !== false;
  const imagesOn = bg.imageEnabled !== false;

  const from = enabled ? alphaHex(bg.gradientFrom, bg.gradientOpacity) : 'transparent';
  const to = enabled ? alphaHex(bg.gradientTo, bg.gradientOpacity) : 'transparent';

  const style = {
    backgroundImage: `linear-gradient(${clampAngle(bg.gradientAngle)}deg, ${from}, ${to})`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    '--admin-bg-image': imagesOn && bg.imageUrl ? `url('${bg.imageUrl}')` : 'none',
    '--adminImageOpacity': imagesOn ? clamp01(bg.imageOpacity) : 0,
  };

  return style;
}

export default function PaginasAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const [selectedSection, setSelectedSection] = useState(SECTIONS[0].key);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('visual'); // 'visual' | 'content'
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const sectionOrder = Array.isArray(config.sectionOrder) ? config.sectionOrder : DEFAULT_ORDER;
  const orderedSections = sectionOrder
    .map((key) => SECTIONS.find((s) => s.key === key))
    .filter(Boolean);

  function moveSection(key, dir) {
    if (key === 'main') return;
    const order = [...sectionOrder];
    const idx = order.indexOf(key);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= order.length) return;
    // não pode trocar com 'main'
    if (order[next] === 'main') return;
    [order[idx], order[next]] = [order[next], order[idx]];
    setConfig((prev) => ({ ...prev, sectionOrder: order }));
  }

  const [aboutLang, setAboutLang] = useState('pt');
  const [langOpen, setLangOpen] = useState(false);

  // SVGs simples (sem emoji) para bandeiras
  const FlagBR = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" fill="#009B3A" />
      <polygon points="12,3 21,12 12,21 3,12" fill="#FFDF00" />
      <circle cx="12" cy="12" r="5" fill="#002776" />
    </svg>
  );

  const FlagUK = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" fill="#012169" />
      <path d="M0 0 L24 24 M24 0 L0 24" stroke="#FFF" strokeWidth="5" />
      <path d="M0 0 L24 24 M24 0 L0 24" stroke="#C8102E" strokeWidth="3" />
      <path d="M12 0 V24 M0 12 H24" stroke="#FFF" strokeWidth="7" />
      <path d="M12 0 V24 M0 12 H24" stroke="#C8102E" strokeWidth="4" />
    </svg>
  );

  const aboutCfg = config.about ?? makeDefaultAbout();
  const aboutSections = Array.isArray(aboutCfg.sections) ? aboutCfg.sections : makeDefaultAbout().sections;
  const aboutS1 = aboutSections[0] ?? makeDefaultAbout().sections[0];
  const aboutS2 = aboutSections[1] ?? makeDefaultAbout().sections[1];

  const selectedBg = config.backgroundsBySection?.[selectedSection] ?? makeDefaultBackground();

  const [draft, setDraft] = useState(selectedBg);

  useEffect(() => {
    setDraft(selectedBg);
    setIsEditorOpen(false);
    setEditorMode('visual');
  }, [selectedSection, selectedBg]);

  const previewStyle = useMemo(() => {
    const bg = isEditorOpen ? draft : selectedBg;
    return backgroundToPreviewStyle(bg);
  }, [draft, isEditorOpen, selectedBg]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const ref = doc(db, ...PAGES_DOC_PATH);
        const snap = await getDoc(ref);
        const next = snap.exists() ? normalizeDoc(snap.data()) : DEFAULT_CONFIG;
        if (!cancelled) setConfig(next);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Falha ao carregar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveAll() {
    setSaving(true);
    setError('');
    try {
      const ref = doc(db, ...PAGES_DOC_PATH);
      await setDoc(
        ref,
        {
          content: config,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      setError(e?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  function resetSelected() {
    const ok = window.confirm('Resetar o background desta seção?');
    if (!ok) return;

    setConfig((prev) => ({
      ...prev,
      backgroundsBySection: {
        ...(prev.backgroundsBySection || {}),
        [selectedSection]: makeDefaultBackground(),
      },
    }));
    setDraft(makeDefaultBackground());
    setIsEditorOpen(false);
  }

  function openEditor(mode = 'visual') {
    setDraft(selectedBg);
    setEditorMode(mode);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setDraft(selectedBg);
    setIsEditorOpen(false);
  }

  function applyDraft() {
    setConfig((prev) => ({
      ...prev,
      backgroundsBySection: {
        ...(prev.backgroundsBySection || {}),
        [selectedSection]: { ...draft },
      },
    }));
    setIsEditorOpen(false);
  }

  const sectionLabel = SECTIONS.find((s) => s.key === selectedSection)?.label || selectedSection;

  return (
    <section className="admin-section" aria-label="Admin Páginas">
      <div className="admin-section-header">
        <div>
          <h2 className="admin-h2">PÁGINAS</h2>
          <div className="admin-subtitle">Background por seção (degradê + imagem). Parallax: em breve.</div>
        </div>

        <div className="admin-section-actions">
          <button type="button" className="admin-btn" onClick={saveAll} disabled={saving || loading}>
            {saving ? 'SALVANDO…' : 'SALVAR TUDO'}
          </button>
        </div>
      </div>

      {error ? <div className="admin-error">{error}</div> : null}

      <div className="admin-grid">
        <aside className="admin-panel">
          <div className="admin-panel-title">SEÇÕES</div>
          <div className="admin-list">
            {orderedSections.map((s, idx) => {
              const imgUrl = config.backgroundsBySection?.[s.key]?.imageUrl || '';
              return (
                <div
                  key={s.key}
                  className={`admin-list-item admin-pages-list-item ${selectedSection === s.key ? 'is-active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }}
                  onClick={() => setSelectedSection(s.key)}
                >
                  <div className="admin-list-item-thumb" style={{ flexShrink: 0 }}>
                    {imgUrl
                      ? <img src={imgUrl} alt="" />
                      : <div className="admin-list-item-thumb-empty" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="admin-list-item-title">{s.label}</div>
                    <div className="admin-list-item-meta">
                      <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>#{idx + 1}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="admin-track-btn"
                      style={{ padding: '3px 7px', fontSize: '0.7rem', lineHeight: 1 }}
                      onClick={() => moveSection(s.key, -1)}
                      disabled={s.key === 'main' || idx === 0 || orderedSections[idx - 1]?.key === 'main'}
                      title="Mover para cima"
                    >▲</button>
                    <button
                      type="button"
                      className="admin-track-btn"
                      style={{ padding: '3px 7px', fontSize: '0.7rem', lineHeight: 1 }}
                      onClick={() => moveSection(s.key, 1)}
                      disabled={s.key === 'main' || idx === orderedSections.length - 1}
                      title="Mover para baixo"
                    >▼</button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="admin-panel">
          <div className="admin-panel-title">{isEditorOpen ? `${editorMode === 'content' ? 'CONTEÚDO' : 'VISUAL'} — ${sectionLabel}` : `PREVIEW — ${sectionLabel}`}</div>

          {!isEditorOpen ? (
            <div className="admin-form">
              <div className="admin-pages-preview-box admin-pages-preview-box-lg" style={previewStyle}>
                <div className="admin-pages-preview-overlay" />
                <div className="admin-pages-preview-content">
                  <div className="admin-pages-preview-h1">MIND OF A</div>
                  <div className="admin-pages-preview-h1">DEAD BODY</div>
                  <div className="admin-pages-preview-chip">{sectionLabel}</div>
                </div>
              </div>

              {selectedSection === 'sobre' ? (
                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" className="admin-btn admin-btn-ghost" onClick={resetSelected} disabled={saving || loading}>
                    RESETAR SEÇÃO
                  </button>
                  <button type="button" className="admin-btn" onClick={() => openEditor('visual')}>
                    EDITAR VISUAL
                  </button>
                  <button type="button" className="admin-btn admin-btn-primary" onClick={() => openEditor('content')}>
                    EDITAR CONTEÚDO
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" className="admin-btn admin-btn-ghost" onClick={resetSelected} disabled={saving || loading}>
                    RESETAR SEÇÃO
                  </button>
                  <button type="button" className="admin-btn admin-btn-primary" onClick={() => openEditor('visual')}>
                    EDITAR
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="admin-form">
              <div className="admin-pages-editor-stack">
                <div className="admin-pages-editor-top" style={editorMode === 'content' ? { display: 'none' } : undefined}>
                  <div className="admin-card admin-pages-card">
                    <div className="admin-pages-degrade-head">
                      <div className="admin-pages-label">DEGRADÊ</div>
                      <button
                        type="button"
                        className={`admin-switch ${draft.gradientEnabled ? 'is-on' : ''}`}
                        onClick={() => setDraft((v) => ({ ...v, gradientEnabled: !v.gradientEnabled }))}
                        aria-label="Ativar/desativar degradê"
                        title="Ativar/desativar degradê"
                      />
                    </div>

                    <div className="admin-pages-divider" />

                    <div className="admin-pages-row" style={{ marginTop: 12 }}>
                      <div className="admin-pages-row-spacer" aria-hidden="true" />
                      <div className="admin-pages-controls">
                        <div className="admin-color-field">
                          <div className="admin-color-top">
                            <input
                              type="color"
                              value={draft.gradientFrom}
                              onChange={(e) => setDraft((v) => ({ ...v, gradientFrom: e.target.value }))}
                              className="admin-color admin-color-swatch admin-color-swatch-xl"
                              aria-label="Cor inicial"
                              title="Cor inicial"
                              disabled={!draft.gradientEnabled}
                            />
                          </div>
                          <input
                            type="text"
                            value={draft.gradientFrom}
                            onChange={(e) => {
                              const v = String(e.target.value || '').trim();
                              setDraft((prev) => ({ ...prev, gradientFrom: v }));
                            }}
                            className="admin-input admin-color-hex admin-color-hex-subtle"
                            placeholder="#000000"
                            aria-label="Hex cor inicial"
                            disabled={!draft.gradientEnabled}
                          />
                        </div>

                        <div className="admin-color-field">
                          <div className="admin-color-top">
                            <input
                              type="color"
                              value={draft.gradientTo}
                              onChange={(e) => setDraft((v) => ({ ...v, gradientTo: e.target.value }))}
                              className="admin-color admin-color-swatch admin-color-swatch-xl"
                              aria-label="Cor final"
                              title="Cor final"
                              disabled={!draft.gradientEnabled}
                            />
                          </div>
                          <input
                            type="text"
                            value={draft.gradientTo}
                            onChange={(e) => {
                              const v = String(e.target.value || '').trim();
                              setDraft((prev) => ({ ...prev, gradientTo: v }));
                            }}
                            className="admin-input admin-color-hex admin-color-hex-subtle"
                            placeholder="#120000"
                            aria-label="Hex cor final"
                            disabled={!draft.gradientEnabled}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="admin-pages-slider-grid">
                      <div className="admin-pages-slider">
                        <div className="admin-range-top">
                          <span>ÂNGULO</span>
                          <span>{Math.round(clampAngle(draft.gradientAngle))}°</span>
                        </div>
                        <input
                          className="admin-slider"
                          type="range"
                          min="0"
                          max="360"
                          step="1"
                          value={draft.gradientAngle}
                          onChange={(e) => setDraft((v) => ({ ...v, gradientAngle: clampAngle(e.target.value) }))}
                          disabled={!draft.gradientEnabled}
                        />
                      </div>

                      <div className="admin-pages-slider">
                        <div className="admin-range-top">
                          <span>OPACIDADE DO DEGRADÊ</span>
                          <span>{Math.round(clamp01(draft.gradientOpacity) * 100)}%</span>
                        </div>
                        <input
                          className="admin-slider"
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={draft.gradientOpacity}
                          onChange={(e) => setDraft((v) => ({ ...v, gradientOpacity: clamp01(e.target.value) }))}
                          disabled={!draft.gradientEnabled}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="admin-card admin-pages-card">
                    <div className="admin-pages-degrade-head">
                      <div className="admin-pages-label">IMAGEM</div>
                      <button
                        type="button"
                        className={`admin-switch ${draft.imageEnabled ? 'is-on' : ''}`}
                        onClick={() => setDraft((v) => ({ ...v, imageEnabled: !v.imageEnabled }))}
                        aria-label="Ativar/desativar imagem"
                        title="Ativar/desativar imagem"
                      />
                    </div>

                    <div className="admin-pages-divider" />

                    <div className="admin-pages-row" style={{ marginTop: 12 }}>
                      <div className="admin-pages-row-spacer" aria-hidden="true" />
                      <div className="admin-pages-controls admin-pages-controls-image">
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost admin-pages-remove-image"
                          onClick={() => setDraft((v) => ({ ...v, imageUrl: '' }))}
                          disabled={!draft.imageUrl || !draft.imageEnabled}
                        >
                          REMOVER
                        </button>

                        <button
                          type="button"
                          className="admin-cover-drop admin-cover-drop-xl"
                          onClick={() => {
                            setIsGalleryOpen(true);
                          }}
                          aria-label="Selecionar imagem"
                          title="Selecionar imagem"
                          disabled={!draft.imageEnabled}
                        >
                          {draft.imageUrl ? (
                            <img src={draft.imageUrl} alt="" className="admin-cover-drop-img" />
                          ) : (
                            <span className="admin-cover-drop-empty">SEM IMAGEM</span>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="admin-pages-slider">
                      <div className="admin-range-top">
                        <span>OPACIDADE DA IMAGEM</span>
                        <span>{Math.round(clamp01(draft.imageOpacity) * 100)}%</span>
                      </div>
                      <input
                        className="admin-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={draft.imageOpacity}
                        onChange={(e) => setDraft((v) => ({ ...v, imageOpacity: clamp01(e.target.value) }))}
                        disabled={!draft.imageEnabled}
                      />
                    </div>
                  </div>
                </div>

                {selectedSection === 'sobre' && editorMode === 'content' ? (
                  <div className="admin-card" style={{ marginTop: 14 }}>
                    <div className="admin-pages-degrade-head">
                      <div className="admin-pages-label">SOBRE — CONTEÚDO</div>

                      {/* dropdown de idioma (estilo do site) */}
                      <div className="lang-dropdown" style={{ minWidth: 170 }}>
                        <button
                          type="button"
                          className="lang-dropdown-toggle"
                          onClick={() => setLangOpen((v) => !v)}
                          aria-haspopup="menu"
                          aria-expanded={langOpen ? 'true' : 'false'}
                          title="Idioma"
                        >
                          <span className="lang-flag" aria-hidden="true">{aboutLang === 'pt' ? FlagBR : FlagUK}</span>
                          <span className="lang-current">{aboutLang === 'pt' ? 'Português' : 'English'}</span>
                          <span className="lang-arrow">▾</span>
                        </button>

                        {langOpen ? (
                          <ul className="lang-dropdown-menu" role="menu" aria-label="Idioma">
                            <li>
                              <button
                                type="button"
                                className={`lang-dropdown-item ${aboutLang === 'pt' ? 'active' : ''}`}
                                onClick={() => {
                                  setAboutLang('pt');
                                  setLangOpen(false);
                                }}
                                role="menuitem"
                              >
                                <span className="lang-flag" aria-hidden="true">{FlagBR}</span>
                                Português
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                className={`lang-dropdown-item ${aboutLang === 'en' ? 'active' : ''}`}
                                onClick={() => {
                                  setAboutLang('en');
                                  setLangOpen(false);
                                }}
                                role="menuitem"
                              >
                                <span className="lang-flag" aria-hidden="true">{FlagUK}</span>
                                English
                              </button>
                            </li>
                          </ul>
                        ) : null}
                      </div>
                    </div>

                    <div className="admin-pages-divider" />

                    {/* Layout: esquerda imagem+dicas, direita subtitulo/texto/subtitulo/texto */}
                    <div className="admin-field-row" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
                      {/* ESQUERDA: IMAGEM + DICAS */}
                      <div className="admin-field" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="admin-field">
                          <div className="admin-label">IMAGEM</div>
                          <button
                            type="button"
                            className="admin-cover-drop admin-cover-drop-xl"
                            onClick={() => setIsGalleryOpen(true)}
                            aria-label="Selecionar imagem do Sobre"
                            title="Selecionar imagem"
                          >
                            {aboutS1?.imageUrl ? (
                              <img src={aboutS1.imageUrl} alt="" className="admin-cover-drop-img" />
                            ) : (
                              <span className="admin-cover-drop-empty">SEM IMAGEM</span>
                            )}
                          </button>
                          {aboutS1?.imageUrl ? (
                            <button
                              type="button"
                              className="admin-btn admin-btn-ghost"
                              style={{ marginTop: 10 }}
                              onClick={() =>
                                setConfig((prev) => {
                                  const base = prev.about ?? makeDefaultAbout();
                                  const sections = (Array.isArray(base.sections) ? base.sections : makeDefaultAbout().sections).slice(0, 2);
                                  while (sections.length < 2) sections.push(makeDefaultAbout().sections[sections.length]);
                                  const nextSections = sections.map((s, idx) => (idx === 0 ? { ...s, imageUrl: '' } : s));
                                  return { ...prev, about: { ...base, sections: nextSections } };
                                })
                              }
                            >
                              REMOVER
                            </button>
                          ) : null}
                        </div>

                        <div className="admin-hint" style={{ marginTop: 4 }}>
                          Dica: cole/edite com formatação (negrito/itálico/sublinhado/cores). O conteúdo é salvo como HTML.
                        </div>
                        <div className="admin-muted">
                          Controles: Ctrl+B / Ctrl+I / Ctrl+U.
                        </div>
                      </div>

                      {/* DIREITA: apenas subtítulos editáveis + textos */}
                      <div className="admin-field" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="admin-field">
                          <div className="admin-label">SUBTÍTULO 1 ({aboutLang.toUpperCase()})</div>
                          <input
                            className="admin-input"
                            value={String(aboutS1?.title?.[aboutLang] ?? '')}
                            onChange={(e) => {
                              const v = e.target.value;
                              setConfig((prev) => {
                                const base = prev.about ?? makeDefaultAbout();
                                const sections = (Array.isArray(base.sections) ? base.sections : makeDefaultAbout().sections).slice(0, 2);
                                while (sections.length < 2) sections.push(makeDefaultAbout().sections[sections.length]);
                                const nextSections = sections.map((s, idx) => (idx === 0 ? { ...s, title: { ...(s?.title || {}), [aboutLang]: v } } : s));
                                return { ...prev, about: { ...base, sections: nextSections } };
                              });
                            }}
                            placeholder={aboutLang === 'pt' ? 'A HISTÓRIA' : 'THE STORY'}
                          />
                          <div className="admin-muted" style={{ marginTop: 6 }}>
                            (O título principal "SOBRE" é fixo e não é editável aqui.)
                          </div>
                        </div>

                        <div className="admin-field">
                          <div className="admin-label">TEXTO 1 ({aboutLang.toUpperCase()})</div>
                          <div
                            className="admin-richtext"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(e) => {
                              const html = e.currentTarget.innerHTML;
                              setConfig((prev) => {
                                const base = prev.about ?? makeDefaultAbout();
                                const sections = (Array.isArray(base.sections) ? base.sections : makeDefaultAbout().sections).slice(0, 2);
                                while (sections.length < 2) sections.push(makeDefaultAbout().sections[sections.length]);
                                const nextSections = sections.map((s, idx) => (idx === 0 ? { ...s, text: { ...(s?.text || {}), [aboutLang]: html } } : s));
                                return { ...prev, about: { ...base, sections: nextSections } };
                              });
                            }}
                            dangerouslySetInnerHTML={{ __html: String(aboutS1?.text?.[aboutLang] ?? '') }}
                          />
                        </div>

                        <div className="admin-field">
                          <div className="admin-label">SUBTÍTULO 2 ({aboutLang.toUpperCase()})</div>
                          <input
                            className="admin-input"
                            value={String(aboutS2?.title?.[aboutLang] ?? '')}
                            onChange={(e) => {
                              const v = e.target.value;
                              setConfig((prev) => {
                                const base = prev.about ?? makeDefaultAbout();
                                const sections = (Array.isArray(base.sections) ? base.sections : makeDefaultAbout().sections).slice(0, 2);
                                while (sections.length < 2) sections.push(makeDefaultAbout().sections[sections.length]);
                                const nextSections = sections.map((s, idx) => (idx === 1 ? { ...s, title: { ...(s?.title || {}), [aboutLang]: v } } : s));
                                return { ...prev, about: { ...base, sections: nextSections } };
                              });
                            }}
                            placeholder={aboutLang === 'pt' ? 'A FILOSOFIA' : 'THE PHILOSOPHY'}
                          />
                        </div>

                        <div className="admin-field">
                          <div className="admin-label">TEXTO 2 ({aboutLang.toUpperCase()})</div>
                          <div
                            className="admin-richtext"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(e) => {
                              const html = e.currentTarget.innerHTML;
                              setConfig((prev) => {
                                const base = prev.about ?? makeDefaultAbout();
                                const sections = (Array.isArray(base.sections) ? base.sections : makeDefaultAbout().sections).slice(0, 2);
                                while (sections.length < 2) sections.push(makeDefaultAbout().sections[sections.length]);
                                const nextSections = sections.map((s, idx) => (idx === 1 ? { ...s, text: { ...(s?.text || {}), [aboutLang]: html } } : s));
                                return { ...prev, about: { ...base, sections: nextSections } };
                              });
                            }}
                            dangerouslySetInnerHTML={{ __html: String(aboutS2?.text?.[aboutLang] ?? '') }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="admin-pages-editor-bottom">
                  <div className="admin-pages-preview-top">
                    <div className="admin-pages-preview-title">PREVIEW</div>
                    <div className="admin-pages-preview-note">(Seção: {sectionLabel})</div>
                  </div>

                  <div className="admin-pages-preview-box admin-pages-preview-box-lg" style={previewStyle}>
                    <div className="admin-pages-preview-overlay" />
                    <div className="admin-pages-preview-content">
                      <div className="admin-pages-preview-h1">MIND OF A</div>
                      <div className="admin-pages-preview-h1">DEAD BODY</div>
                      <div className="admin-pages-preview-chip">{sectionLabel}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button type="button" className="admin-btn" onClick={closeEditor}>
                  FECHAR
                </button>
                {editorMode === 'visual' ? (
                  <button type="button" className="admin-btn admin-btn-primary" onClick={applyDraft}>
                    APLICAR
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {isGalleryOpen ? (
        <ImageGalleryModal
          title={`MÍDIA — ${sectionLabel}`}
          allFolder="uploads"
          tabs={[
            { key: 'uploads', label: 'UPLOADS', folder: 'uploads' },
            { key: 'pages', label: 'PÁGINAS', folder: 'pages/background' },
          ]}
          initialTabKey="all"
          onClose={() => setIsGalleryOpen(false)}
          onSelect={(url) => {
            if (selectedSection === 'sobre') {
              setConfig((prev) => {
                const base = prev.about ?? makeDefaultAbout();
                const sections = (Array.isArray(base.sections) ? base.sections : makeDefaultAbout().sections).slice(0, 2);
                while (sections.length < 2) sections.push(makeDefaultAbout().sections[sections.length]);
                const nextSections = sections.map((s, idx) => (idx === 0 ? { ...s, imageUrl: url } : s));
                return { ...prev, about: { ...base, sections: nextSections } };
              });
            } else {
              setDraft((v) => ({
                ...v,
                imageUrl: url,
              }));
            }
            setIsGalleryOpen(false);
          }}
        />
      ) : null}

      {loading ? <div className="admin-muted">Carregando…</div> : null}
    </section>
  );
}
