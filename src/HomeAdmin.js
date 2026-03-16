import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const HOME_DOC_PATH = ['siteData', 'moadb_home'];
const DISCO_DOC_PATH = ['siteData', 'moadb_discography'];

const DEFAULT_CONFIG = {
  featuredEnabled: false,
  featuredReleaseIds: [],
  featuredTitle: 'OUÇA AGORA',
  featuredButtonLabel: 'OUVIR AGORA',
};

function normalizeHomeDoc(data) {
  const raw = data?.content ?? data ?? {};
  return {
    featuredEnabled: typeof raw.featuredEnabled === 'boolean' ? raw.featuredEnabled : false,
    featuredReleaseIds: Array.isArray(raw.featuredReleaseIds) ? raw.featuredReleaseIds.map(String) : [],
    featuredTitle: typeof raw.featuredTitle === 'string' && raw.featuredTitle.trim() ? raw.featuredTitle : 'OUÇA AGORA',
    featuredButtonLabel:
      typeof raw.featuredButtonLabel === 'string' && raw.featuredButtonLabel.trim() ? raw.featuredButtonLabel : 'OUVIR AGORA',
  };
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

  const selectedItems = useMemo(() => {
    const set = new Set((draft.featuredReleaseIds || []).map(String));
    return discography.filter(d => set.has(String(d.id)));
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
        featuredTitle: String(draft.featuredTitle || '').trim(),
        featuredButtonLabel: String(draft.featuredButtonLabel || '').trim(),
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
                <div className="admin-field-row admin-home-featured-settings-row">
                  <div className="admin-field">
                    <div className="admin-label">TÍTULO</div>
                    <input
                      className="admin-input"
                      value={draft.featuredTitle}
                      onChange={(e) => setDraft((v) => ({ ...v, featuredTitle: e.target.value }))}
                      placeholder="Ouça agora"
                    />
                  </div>
                </div>

                <div className="admin-field-row admin-home-featured-settings-row">
                  <div className="admin-field">
                    <div className="admin-label">BOTÃO</div>
                    <input
                      className="admin-input"
                      value={draft.featuredButtonLabel}
                      onChange={(e) => setDraft((v) => ({ ...v, featuredButtonLabel: e.target.value }))}
                      placeholder="Ouvir agora"
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
                      <div className="admin-home-featured-preview-kicker">{String(draft.featuredTitle || 'OUÇA AGORA').toUpperCase()}</div>
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

            {draft.featuredEnabled ? (
              <div className="admin-card admin-home-featured-selected">
                <div className="admin-label">SELECIONADO</div>
                {selectedItems.length === 0 ? (
                  <div className="admin-muted">Nenhum lançamento selecionado.</div>
                ) : (
                  <div className="admin-home-featured-selected-list">
                    {selectedItems.map((r) => (
                      <div key={r.id} className="admin-home-featured-selected-row">
                        <div className="admin-home-featured-selected-left">
                          <div className="admin-list-item-thumb">
                            {r.coverUrl ? <img src={r.coverUrl} alt="" /> : <div className="admin-thumb-empty" />}
                          </div>
                          <div className="admin-home-featured-selected-text">
                            <div className="admin-home-featured-selected-name">{r.title}</div>
                            <div className="admin-muted admin-home-featured-selected-meta">
                              {r.type ? String(r.type).toUpperCase() : ''}
                              {r.year ? ` • ${r.year}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="admin-hint" style={{ marginTop: 0 }}>
                          Clique novamente no item acima (grid) para desmarcar.
                        </div>
                      </div>
                    ))}
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
