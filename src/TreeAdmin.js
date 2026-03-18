import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import ImageGalleryModal from './components/ImageGalleryModal';
import defaultLogo from './assets/logo-mark.png';
import bgImg from './assets/bg.png';

const TEXT_SIZE = { xs: '0.75rem', sm: '1.1rem', md: '1.6rem', lg: '2.4rem', xl: '3.6rem' };
const IMG_SIZE   = { xs: '60px', sm: '120px', md: '200px', lg: '320px', xl: '440px' };

function TreePreview({ draft, lang }) {
  const order = draft.headerOrder || ['headerImage', 'title', 'subtitle'];
  const t = draft.title?.[lang] || draft.title?.pt || 'MIND OF A DEAD BODY';
  const s = draft.subtitle?.[lang] || draft.subtitle?.pt || '';

  return (
    <div style={{
      background: `linear-gradient(#000000d9,#000000f2), url(${bgImg}) center/cover no-repeat`,
      borderRadius: 8,
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
      minHeight: 320,
      fontFamily: 'Oswald, sans-serif',
      color: '#fff',
      overflow: 'hidden',
    }}>
      {order.map((id) => {
        if (id === 'headerImage' && draft.headerImageEnabled) return (
          <div key="headerImage" style={{ marginBottom: 12, opacity: draft.headerImageOpacity ?? 1 }}>
            <img src={draft.headerImage || defaultLogo} alt=""
              style={{ width: IMG_SIZE[draft.headerImageSize], height: IMG_SIZE[draft.headerImageSize], objectFit: 'contain', display: 'block' }} />
          </div>
        );
        if (id === 'title' && draft.titleEnabled) return (
          <div key="title" style={{
            fontSize: TEXT_SIZE[draft.titleSize],
            textTransform: 'uppercase',
            textShadow: draft.titleShadow ? '3px 3px 0 #8b0000' : 'none',
            opacity: draft.titleOpacity ?? 1,
            textAlign: 'center',
            letterSpacing: 2,
            lineHeight: 0.9,
            marginBottom: 8,
          }}>{t}</div>
        );
        if (id === 'subtitle' && draft.subtitleEnabled && s) return (
          <div key="subtitle" style={{
            fontSize: TEXT_SIZE[draft.subtitleSize],
            textTransform: 'uppercase',
            textShadow: draft.subtitleShadow ? '2px 2px 0 #8b0000' : 'none',
            opacity: draft.subtitleOpacity ?? 1,
            textAlign: 'center',
            letterSpacing: 3,
            marginBottom: 12,
            color: '#fff',
          }}>{s}</div>
        );
        return null;
      })}
      {draft.footerImageEnabled && draft.footerImage ? (
        <img src={draft.footerImage} alt=""
          style={{ width: IMG_SIZE[draft.footerImageSize], maxWidth: '100%', height: 'auto', borderRadius: 8, marginTop: 8, opacity: draft.footerImageOpacity ?? 1 }} />
      ) : null}
      <div style={{ fontSize: 9, opacity: 0.3, letterSpacing: 2, marginTop: 16 }}>PREVIEW</div>
    </div>
  );
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

function LangDropdown({ lang, open, onToggle, onSelect, dropRef }) {
  const isPt = lang === 'pt';
  return (
    <div className="lang-dropdown" ref={dropRef} style={{ minWidth: 'unset' }}>
      <button type="button" className="lang-dropdown-toggle" onClick={onToggle}
        aria-haspopup="menu" aria-expanded={open}
        style={{ fontSize: '0.9rem', padding: '4px 8px' }}>
        <span className="lang-flag" aria-hidden="true">{isPt ? <FlagBR /> : <FlagUK />}</span>
        <span className="lang-current" style={{ fontSize: '0.8rem' }}>{isPt ? 'PT' : 'EN'}</span>
        <span className="lang-arrow" aria-hidden="true">▼</span>
      </button>
      {open && (
        <ul className="lang-dropdown-menu" role="menu" aria-label="Selecionar idioma">
          <li>
            <button type="button" className={`lang-dropdown-item${isPt ? ' active' : ''}`} role="menuitem"
              onClick={() => onSelect('pt')}>
              <span className="lang-flag" aria-hidden="true"><FlagBR /></span>
              <span>Português</span>
            </button>
          </li>
          <li>
            <button type="button" className={`lang-dropdown-item${!isPt ? ' active' : ''}`} role="menuitem"
              onClick={() => onSelect('en')}>
              <span className="lang-flag" aria-hidden="true"><FlagUK /></span>
              <span>English</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

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

const LINK_LABELS = {
  spotify:      'Spotify',
  apple:        'Apple Music',
  deezer:       'Deezer',
  youtubeMusic: 'YouTube Music',
  instagram:    'Instagram',
  tiktok:       'TikTok',
  youtube:      'YouTube',
  website:      'Site Oficial',
};

const DEFAULT_DRAFT = {
  headerImage: '',
  headerImageEnabled: true,
  headerImageSize: 'md',
  headerImageOpacity: 1,
  title: { pt: 'MIND OF A DEAD BODY', en: 'MIND OF A DEAD BODY' },
  titleEnabled: true,
  titleSize: 'md',
  titleShadow: true,
  titleOpacity: 1,
  subtitle: { pt: '', en: '' },
  subtitleEnabled: true,
  subtitleSize: 'md',
  subtitleShadow: true,
  subtitleOpacity: 1,
  headerOrder: ['headerImage', 'title', 'subtitle'],
  footerImage: '',
  footerImageEnabled: true,
  footerImageSize: 'md',
  footerImageOpacity: 1,
  links: { ...DEFAULT_LINKS },
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

function SizeSelect({ value, onChange }) {
  const sizes = [
    { key: 'xs', label: 'PP' },
    { key: 'sm', label: 'P' },
    { key: 'md', label: 'M' },
    { key: 'lg', label: 'G' },
    { key: 'xl', label: 'GG' },
  ];
  return (
    <select
      className="admin-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: '3px 6px', fontSize: 11, width: 'auto', minWidth: 60 }}
    >
      {sizes.map((s) => (
        <option key={s.key} value={s.key}>{s.label}</option>
      ))}
    </select>
  );
}

export default function TreeAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [galleryField, setGalleryField] = useState('');
  const [lang, setLang] = useState('pt');
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const snap = await getDoc(doc(db, ...TREE_DOC_PATH));
        if (cancelled) return;
        setDraft(snap.exists() ? normalizeTreeDoc(snap.data()) : DEFAULT_DRAFT);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Falha ao carregar configurações da Tree.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function patch(obj) {
    setDraft(d => ({ ...d, ...obj }));
    setSaveState('');
  }

  function patchLink(key, value) {
    setDraft(d => ({ ...d, links: { ...d.links, [key]: value } }));
    setSaveState('');
  }

  function moveOrder(id, dir) {
    setDraft(d => {
      const arr = [...(d.headerOrder || ['headerImage', 'title', 'subtitle'])];
      const i = arr.indexOf(id);
      if (i < 0) return d;
      const j = i + dir;
      if (j < 0 || j >= arr.length) return d;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...d, headerOrder: arr };
    });
    setSaveState('');
  }

  async function save() {
    setSaving(true);
    setSaveState('saving');
    setError('');
    try {
      const payload = {
        headerImage: String(draft.headerImage || '').trim(),
        headerImageEnabled: draft.headerImageEnabled !== false,
        headerImageSize: normalizeSize(draft.headerImageSize),
        headerImageOpacity: typeof draft.headerImageOpacity === 'number' ? draft.headerImageOpacity : 1,
        title: { pt: String(draft.title?.pt || '').trim(), en: String(draft.title?.en || '').trim() },
        titleEnabled: draft.titleEnabled !== false,
        titleSize: normalizeSize(draft.titleSize),
        titleShadow: draft.titleShadow !== false,
        titleOpacity: typeof draft.titleOpacity === 'number' ? draft.titleOpacity : 1,
        subtitle: { pt: String(draft.subtitle?.pt || '').trim(), en: String(draft.subtitle?.en || '').trim() },
        subtitleEnabled: draft.subtitleEnabled !== false,
        subtitleSize: normalizeSize(draft.subtitleSize),
        subtitleShadow: draft.subtitleShadow !== false,
        subtitleOpacity: typeof draft.subtitleOpacity === 'number' ? draft.subtitleOpacity : 1,
        headerOrder: Array.isArray(draft.headerOrder) ? draft.headerOrder : ['headerImage', 'title', 'subtitle'],
        footerImage: String(draft.footerImage || '').trim(),
        footerImageEnabled: draft.footerImageEnabled !== false,
        footerImageSize: normalizeSize(draft.footerImageSize),
        footerImageOpacity: typeof draft.footerImageOpacity === 'number' ? draft.footerImageOpacity : 1,
        links: Object.fromEntries(
          Object.entries(draft.links).map(([k, v]) => [k, String(v || '').trim()])
        ),
      };
      await setDoc(doc(db, ...TREE_DOC_PATH), { content: payload, updatedAt: serverTimestamp() }, { merge: true });
      setSaveState('saved');
    } catch (e) {
      setError(e?.message || 'Falha ao salvar.');
      setSaveState('error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-empty" aria-label="Tree">
        <div style={{ opacity: 0.7, letterSpacing: 2 }}>CARREGANDO…</div>
      </div>
    );
  }

  return (
    <section className="admin-section" aria-label="Admin Tree">
      <div className="admin-section-header">
        <div>
          <h2 className="admin-h2">TREE</h2>
          <div className="admin-subtitle">Personalize a página /tree — imagens, título e links dos botões.</div>
        </div>
        <div className="admin-section-actions" style={{ alignItems: 'center', gap: 12 }}>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            {saveState === 'saved' ? 'Salvo.' : saveState === 'error' ? 'Erro ao salvar.' : ''}
          </div>
          <button type="button" className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>
            {saving ? 'SALVANDO…' : 'SALVAR'}
          </button>
        </div>
      </div>

      {error ? <div className="admin-error">{error}</div> : null}

      <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Coluna esquerda — visual */}
        <div className="admin-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="admin-panel-title" style={{ margin: 0 }}>VISUAL</div>
            <LangDropdown lang={lang} open={langOpen} onToggle={() => setLangOpen(v => !v)}
              onSelect={(l) => { setLang(l); setLangOpen(false); }} dropRef={langRef} />
          </div>
          <div className="admin-form">

            {(draft.headerOrder || ['headerImage','title','subtitle']).map((id, idx, arr) => {
              const isFirst = idx === 0;
              const isLast = idx === arr.length - 1;

              const cardStyle = {
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6,
                padding: '10px 12px',
                marginBottom: 10,
                background: 'rgba(255,255,255,0.02)',
              };

              const row1 = (enabled, label, onToggle, extra) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <button type="button"
                    className={`admin-switch admin-switch-sm${enabled ? ' is-on' : ''}`}
                    onClick={onToggle} aria-label={`Ativar ${label}`} />
                  <span className="admin-label" style={{ margin: 0, flex: 1, fontSize: 10 }}>{label}</span>
                  {extra}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginLeft: 4 }}>
                    <button type="button" className="admin-btn"
                      style={{ padding: '1px 5px', fontSize: 9, lineHeight: 1 }}
                      disabled={isFirst} onClick={() => moveOrder(id, -1)}>▲</button>
                    <button type="button" className="admin-btn"
                      style={{ padding: '1px 5px', fontSize: 9, lineHeight: 1 }}
                      disabled={isLast} onClick={() => moveOrder(id, 1)}>▼</button>
                  </div>
                </div>
              );

              const opacityRow = (val, key) => (
                <div className="admin-pages-slider" style={{ marginBottom: 6 }}>
                  <div className="admin-range-top">
                    <span>OPACIDADE</span>
                    <span>{Math.round(val * 100)}%</span>
                  </div>
                  <input className="admin-slider" type="range" min="0" max="1" step="0.05" value={val}
                    onChange={(e) => patch({ [key]: parseFloat(e.target.value) })} />
                </div>
              );

              if (id === 'headerImage') return (
                <div key="headerImage" style={cardStyle}>
                  {row1(draft.headerImageEnabled, 'CABEÇALHO', () => patch({ headerImageEnabled: !draft.headerImageEnabled }),
                    <SizeSelect value={draft.headerImageSize} onChange={(v) => patch({ headerImageSize: v })} />
                  )}
                  {opacityRow(draft.headerImageOpacity ?? 1, 'headerImageOpacity')}
                  <div className="admin-dropzone admin-dropzone-square" role="button" tabIndex={0}
                    onClick={() => draft.headerImageEnabled && setGalleryField('headerImage')}
                    style={{ opacity: draft.headerImageEnabled ? 1 : 0.4, pointerEvents: draft.headerImageEnabled ? 'auto' : 'none' }}>
                    {draft.headerImage
                      ? <img className="admin-dropzone-square-img" src={draft.headerImage} alt="Cabeçalho" />
                      : <div className="admin-dropzone-placeholder"><div className="admin-dropzone-title">GALERIA</div></div>}
                  </div>
                  {draft.headerImage
                    ? <button type="button" className="admin-btn" style={{ marginTop: 8 }} onClick={() => patch({ headerImage: '' })}>REMOVER</button>
                    : null}
                </div>
              );

              if (id === 'title') return (
                <div key="title" style={cardStyle}>
                  {row1(draft.titleEnabled, 'TÍTULO', () => patch({ titleEnabled: !draft.titleEnabled }),
                    <>
                      <button type="button"
                        className={`admin-btn${draft.titleShadow ? ' admin-btn-primary' : ''}`}
                        style={{ padding: '2px 6px', fontSize: 9 }}
                        onClick={() => patch({ titleShadow: !draft.titleShadow })}>SOMBRA</button>
                      <SizeSelect value={draft.titleSize} onChange={(v) => patch({ titleSize: v })} />
                    </>
                  )}
                  {opacityRow(draft.titleOpacity ?? 1, 'titleOpacity')}
                  <input className="admin-input"
                    value={draft.title?.[lang] || ''}
                    onChange={(e) => patch({ title: { ...draft.title, [lang]: e.target.value } })}
                    placeholder="MIND OF A DEAD BODY"
                    disabled={!draft.titleEnabled}
                    style={{ opacity: draft.titleEnabled ? 1 : 0.4 }} />
                </div>
              );

              if (id === 'subtitle') return (
                <div key="subtitle" style={cardStyle}>
                  {row1(draft.subtitleEnabled, 'SUBTÍTULO', () => patch({ subtitleEnabled: !draft.subtitleEnabled }),
                    <>
                      <button type="button"
                        className={`admin-btn${draft.subtitleShadow ? ' admin-btn-primary' : ''}`}
                        style={{ padding: '2px 6px', fontSize: 9 }}
                        onClick={() => patch({ subtitleShadow: !draft.subtitleShadow })}>SOMBRA</button>
                      <SizeSelect value={draft.subtitleSize} onChange={(v) => patch({ subtitleSize: v })} />
                    </>
                  )}
                  {opacityRow(draft.subtitleOpacity ?? 1, 'subtitleOpacity')}
                  <input className="admin-input"
                    value={draft.subtitle?.[lang] || ''}
                    onChange={(e) => patch({ subtitle: { ...draft.subtitle, [lang]: e.target.value } })}
                    placeholder={lang === 'pt' ? 'Subtítulo opcional' : 'Optional subtitle'}
                    disabled={!draft.subtitleEnabled}
                    style={{ opacity: draft.subtitleEnabled ? 1 : 0.4 }} />
                </div>
              );

              return null;
            })}

            {/* Imagem final */}
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '10px 12px', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <button type="button"
                  className={`admin-switch admin-switch-sm${draft.footerImageEnabled ? ' is-on' : ''}`}
                  onClick={() => patch({ footerImageEnabled: !draft.footerImageEnabled })}
                  aria-label="Ativar imagem final" />
                <span className="admin-label" style={{ margin: 0, flex: 1, fontSize: 10 }}>IMAGEM FINAL</span>
                <SizeSelect value={draft.footerImageSize} onChange={(v) => patch({ footerImageSize: v })} />
              </div>
              <div className="admin-pages-slider" style={{ marginBottom: 6 }}>
                <div className="admin-range-top">
                  <span>OPACIDADE</span>
                  <span>{Math.round((draft.footerImageOpacity ?? 1) * 100)}%</span>
                </div>
                <input className="admin-slider" type="range" min="0" max="1" step="0.05"
                  value={draft.footerImageOpacity ?? 1}
                  onChange={(e) => patch({ footerImageOpacity: parseFloat(e.target.value) })} />
              </div>
              <div className="admin-dropzone admin-dropzone-square" role="button" tabIndex={0}
                onClick={() => draft.footerImageEnabled && setGalleryField('footerImage')}
                style={{ opacity: draft.footerImageEnabled ? 1 : 0.4, pointerEvents: draft.footerImageEnabled ? 'auto' : 'none' }}>
                {draft.footerImage
                  ? <img className="admin-dropzone-square-img" src={draft.footerImage} alt="Imagem final" />
                  : <div className="admin-dropzone-placeholder"><div className="admin-dropzone-title">GALERIA</div></div>}
              </div>
              {draft.footerImage
                ? <button type="button" className="admin-btn" style={{ marginTop: 8 }} onClick={() => patch({ footerImage: '' })}>REMOVER</button>
                : null}
            </div>

          </div>
        </div>

        {/* Coluna direita — links + preview */}
        <div className="admin-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="admin-panel-title">LINKS DOS BOTÕES</div>
            <div className="admin-form">
              {Object.keys(DEFAULT_LINKS).map((key) => (
                <label key={key} className="admin-field">
                  <div className="admin-label">{LINK_LABELS[key]}</div>
                  <input
                    className="admin-input"
                    value={draft.links?.[key] || ''}
                    onChange={(e) => patchLink(key, e.target.value)}
                    placeholder={DEFAULT_LINKS[key]}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <div className="admin-panel-title">PREVIEW</div>
            <TreePreview draft={draft} lang={lang} />
          </div>
        </div>

      </div>

      {galleryField ? (
        <ImageGalleryModal
          title="GALERIA"
          initialTabKey="all"
          allFolder="uploads"
          tabs={[
            { key: 'uploads', label: 'UPLOADS', folder: 'uploads' },
            { key: 'pages', label: 'PÁGINAS', folder: 'pages/background' },
          ]}
          onSelect={(url) => { patch({ [galleryField]: url }); setGalleryField(''); }}
          onClose={() => setGalleryField('')}
        />
      ) : null}
    </section>
  );
}
