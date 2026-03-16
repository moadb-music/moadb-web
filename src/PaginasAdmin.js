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

const DEFAULT_CONFIG = {
  backgroundsBySection: SECTIONS.reduce((acc, s) => {
    acc[s.key] = makeDefaultBackground();
    return acc;
  }, {}),
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

  // new single switch, but honor old stored flags if they exist
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

  return { backgroundsBySection: acc };
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
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const selectedBg = config.backgroundsBySection?.[selectedSection] ?? makeDefaultBackground();

  const [draft, setDraft] = useState(selectedBg);

  useEffect(() => {
    setDraft(selectedBg);
    setIsEditorOpen(false);
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

  function openEditor() {
    setDraft(selectedBg);
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
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`admin-list-item ${selectedSection === s.key ? 'is-active' : ''}`}
                onClick={() => setSelectedSection(s.key)}
              >
                <div className="admin-list-item-title">{s.label}</div>
                <div className="admin-list-item-meta">
                  <span>{config.backgroundsBySection?.[s.key]?.imageUrl ? 'com imagem' : 'sem imagem'}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="admin-panel">
          <div className="admin-panel-title">{isEditorOpen ? `EDITAR — ${sectionLabel}` : `PREVIEW — ${sectionLabel}`}</div>

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

              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button type="button" className="admin-btn admin-btn-ghost" onClick={resetSelected} disabled={saving || loading}>
                  RESETAR SEÇÃO
                </button>
                <button type="button" className="admin-btn admin-btn-primary" onClick={openEditor}>
                  EDITAR
                </button>
              </div>
            </div>
          ) : (
            <div className="admin-form">
              <div className="admin-pages-editor-stack">
                <div className="admin-pages-editor-top">
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
                <button type="button" className="admin-btn admin-btn-primary" onClick={applyDraft}>
                  APLICAR
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isGalleryOpen ? (
        <ImageGalleryModal
          title={`BACKGROUND — ${sectionLabel}`}
          tabs={[
            {
              key: 'background',
              label: 'BACKGROUND',
              folder: 'pages/background',
            },
          ]}
          initialTabKey="background"
          onClose={() => setIsGalleryOpen(false)}
          onSelect={(url) => {
            setDraft((v) => ({
              ...v,
              imageUrl: url,
            }));
            setIsGalleryOpen(false);
          }}
        />
      ) : null}

      {loading ? <div className="admin-muted">Carregando…</div> : null}
    </section>
  );
}
