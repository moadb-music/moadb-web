import { useEffect, useMemo, useState, useRef } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const HOME_DOC_PATH = ['siteData', 'moadb_home'];
const DISCO_DOC_PATH = ['siteData', 'moadb_discography'];

const DEFAULT_CONFIG = {
  featuredEnabled: false,
  featuredReleaseIds: [],
  featuredTitle: { pt: 'OUÇA AGORA', en: 'LISTEN NOW' },
  featuredButtonLabel: { pt: 'OUVIR AGORA', en: 'LISTEN NOW' },
};

function normalizeI18n(value, fallbackPt = '', fallbackEn = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { pt: String(value.pt || fallbackPt).trim(), en: String(value.en || fallbackEn).trim() };
  }
  const str = String(value || fallbackPt).trim();
  return { pt: str, en: fallbackEn };
}

function normalizeHomeDoc(data) {
  const raw = data?.content ?? data ?? {};
  return {
    featuredEnabled: typeof raw.featuredEnabled === 'boolean' ? raw.featuredEnabled : false,
    featuredReleaseIds: Array.isArray(raw.featuredReleaseIds) ? raw.featuredReleaseIds.map(String) : [],
    featuredTitle: normalizeI18n(raw.featuredTitle, 'OUÇA AGORA', 'LISTEN NOW'),
    featuredButtonLabel: normalizeI18n(raw.featuredButtonLabel, 'OUVIR AGORA', 'LISTEN NOW'),
  };
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
      <button
        type="button"
        className="lang-dropdown-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        style={{ fontSize: '0.9rem', padding: '4px 8px' }}
      >
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

function normalizeDiscographyDoc(data) {
  const raw = data?.content ?? data ?? {};
  const content = Array.isArray(raw) ? raw : Array.isArray(raw.content) ? raw.content : Array.isArray(data?.content) ? data.content : [];
  const list = (content || []).map((e) => ({
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
  })).filter(x => x.id);

  list.sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')));
  return list;
}

export default function HomeAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [discography, setDiscography] = useState([]);
  const [draft, setDraft] = useState(DEFAULT_CONFIG);

  const [homeLang, setHomeLang] = useState('pt');
  const [homeLangOpen, setHomeLangOpen] = useState(false);
  const homeLangRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (homeLangRef.current && !homeLangRef.current.contains(e.target)) setHomeLangOpen(false);
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
        const [homeSnap, discoSnap] = await Promise.all([
          getDoc(doc(db, ...HOME_DOC_PATH)),
          getDoc(doc(db, ...DISCO_DOC_PATH)),
        ]);

        const nextConfig = homeSnap.exists() ? normalizeHomeDoc(homeSnap.data()) : DEFAULT_CONFIG;
        const nextDisco = discoSnap.exists() ? normalizeDiscographyDoc(discoSnap.data()) : [];

        if (cancelled) return;
        setDraft(nextConfig);
        setDiscography(nextDisco);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Falha ao carregar configurações da HOME.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCount = draft.featuredReleaseIds?.length || 0;

  const primarySelected = useMemo(() => {
    const id = (draft.featuredReleaseIds || [])[0];
    if (!id) return null;
    return discography.find((d) => String(d.id) === String(id)) || null;
  }, [discography, draft.featuredReleaseIds]);

  function toggleSelected(id) {
    const key = String(id);
    setDraft(prev => {
      const curr = Array.isArray(prev.featuredReleaseIds) ? prev.featuredReleaseIds.map(String) : [];
      const has = curr.includes(key);
      // single-select: clicking current selection toggles off, otherwise replace with new
      const next = has ? [] : [key];
      return { ...prev, featuredReleaseIds: next };
    });
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const ref = doc(db, ...HOME_DOC_PATH);
      const payload = {
        featuredEnabled: !!draft.featuredEnabled,
        featuredReleaseIds: Array.isArray(draft.featuredReleaseIds) ? draft.featuredReleaseIds.map(String) : [],
        featuredTitle: {
          pt: String(draft.featuredTitle?.pt || '').trim(),
          en: String(draft.featuredTitle?.en || '').trim(),
        },
        featuredButtonLabel: {
          pt: String(draft.featuredButtonLabel?.pt || '').trim(),
          en: String(draft.featuredButtonLabel?.en || '').trim(),
        },
      };

      await setDoc(ref, { content: payload, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      setError(e?.message || 'Falha ao salvar HOME.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-section" aria-label="Admin Home">
      <div className="admin-section-header">
        <div>
          <h2 className="admin-h2">HOME</h2>
          <div className="admin-subtitle">Selecione quais lançamentos da Discografia devem aparecer como destaque na Home.</div>
        </div>

        <div className="admin-section-actions">
          <button type="button" className="admin-btn admin-btn-primary" onClick={save} disabled={saving || loading}>
            {saving ? 'SALVANDO…' : 'SALVAR'}
          </button>
        </div>
      </div>

      {error ? <div className="admin-error">{error}</div> : null}

      <div className="admin-panel">
        <div className="admin-panel-title">NOVOS LANÇAMENTOS</div>

        <div className="admin-form">
          <div className="admin-pages-degrade-head admin-home-featured-head">
            <div className="admin-pages-label admin-home-featured-title">DESTACAR NA HOME</div>
            <button
              type="button"
              className={`admin-switch ${draft.featuredEnabled ? 'is-on' : ''}`}
              onClick={() => setDraft((v) => ({ ...v, featuredEnabled: !v.featuredEnabled }))}
              aria-label="Ativar/desativar destaques na Home"
              title="Ativar/desativar destaques na Home"
              disabled={loading}
            />
          </div>

          <div className="admin-pages-divider" />

          {!draft.featuredEnabled ? <div className="admin-hint">Desativado: a Home fica no padrão (apenas o nome da banda).</div> : null}

          <div className="admin-home-featured-body">
            {draft.featuredEnabled ? (
              <div className="admin-card admin-home-featured-settings">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div className="admin-label" style={{ margin: 0 }}>TEXTOS</div>
                  <LangDropdown
                    lang={homeLang}
                    open={homeLangOpen}
                    onToggle={() => setHomeLangOpen(v => !v)}
                    onSelect={(l) => { setHomeLang(l); setHomeLangOpen(false); }}
                    dropRef={homeLangRef}
                  />
                </div>
                <div className="admin-field-row admin-home-featured-settings-row">
                  <div className="admin-field">
                    <div className="admin-label">TÍTULO</div>
                    <input
                      className="admin-input"
                      value={draft.featuredTitle?.[homeLang] || ''}
                      onChange={(e) => setDraft((v) => ({
                        ...v,
                        featuredTitle: { ...(v.featuredTitle || {}), [homeLang]: e.target.value },
                      }))}
                      placeholder={homeLang === 'pt' ? 'Ouça agora' : 'Listen now'}
                    />
                  </div>

                  <div className="admin-field">
                    <div className="admin-label">BOTÃO</div>
                    <input
                      className="admin-input"
                      value={draft.featuredButtonLabel?.[homeLang] || ''}
                      onChange={(e) => setDraft((v) => ({
                        ...v,
                        featuredButtonLabel: { ...(v.featuredButtonLabel || {}), [homeLang]: e.target.value },
                      }))}
                      placeholder={homeLang === 'pt' ? 'Ouvir agora' : 'Listen now'}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="admin-hint admin-home-featured-meta">
              Selecionados: <strong>{selectedCount}</strong> (máx. 1)
            </div>

            <div
              className={`admin-cover-grid admin-home-featured-grid ${draft.featuredEnabled ? '' : 'is-disabled'}`}
              aria-label="Lista de lançamentos da discografia"
            >
              {discography.map((r) => {
                const isOn = (draft.featuredReleaseIds || []).map(String).includes(String(r.id));
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`admin-cover-tile admin-home-featured-tile ${isOn ? 'is-selected' : ''}`}
                    onClick={() => toggleSelected(r.id)}
                    aria-label={`Selecionar ${r.title}`}
                    title={r.title}
                  >
                    {r.coverUrl ? <img src={r.coverUrl} alt="" /> : <div className="admin-thumb-empty">SEM CAPA</div>}
                  </button>
                );
              })}
            </div>

            {draft.featuredEnabled ? (
              <div className="admin-card admin-home-featured-preview">
                <div className="admin-label">PREVIEW</div>
                {!primarySelected ? (
                  <div className="admin-hint">Selecione 1 lançamento para ver o preview.</div>
                ) : (
                  <div className="admin-home-featured-preview-inner">
                    <div className="admin-home-featured-preview-cover">
                      {primarySelected.coverUrl ? <img src={primarySelected.coverUrl} alt="" /> : <div className="admin-thumb-empty">SEM CAPA</div>}
                    </div>
                    <div className="admin-home-featured-preview-meta">
                      <div className="admin-home-featured-preview-kicker">{String(draft.featuredTitle?.[homeLang] || draft.featuredTitle?.pt || 'OUÇA AGORA').toUpperCase()}</div>
                      <div className="admin-home-featured-preview-title">{primarySelected.title}</div>
                      <div className="admin-home-featured-preview-sub">
                        {primarySelected.type ? String(primarySelected.type).toUpperCase() : ''}
                        {primarySelected.year ? ` • ${primarySelected.year}` : ''}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
