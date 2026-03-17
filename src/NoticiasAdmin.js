import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import ImageGalleryModal from './components/ImageGalleryModal';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Tenta extrair thumbnail de vídeo (YouTube) a partir de uma URL.
function getVideoThumbnail(url) {
  if (!url || typeof url !== 'string') return '';

  try {
    const u = new URL(url);
    const host = (u.hostname || '').toLowerCase();

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

      if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  } catch {
    // ignore
  }

  return '';
}

function safeHref(url) {
  const v = String(url || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

// Firestore schema:
// siteData/moadb_news {
//   content: { items: [ { id, tags: string[], date: string(YYYY-MM-DD), title, excerptHtml, ctaText, ctaUrl, imageUrl, mediaUrl, mediaKind } ] }
// }
const DOC_PATH = { collection: 'siteData', docId: 'moadb_news' };

function splitTags(input) {
  return String(input || '')
    .split(/[,/]/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeNewsFromDb(data) {
  const d = data || {};
  const content = d.content && typeof d.content === 'object' ? d.content : {};
  const rawItems = Array.isArray(content.items) ? content.items : [];

  return {
    items: rawItems
      .map((it, idx) => {
        const tags = Array.isArray(it?.tags)
          ? it.tags.map((t) => String(t).trim()).filter(Boolean)
          : splitTags(it?.tags || it?.type || it?.tag || '');

        // compat: campos antigos
        const date = String(it?.date || it?.publishedAt || '').trim();
        const excerptHtml = String(it?.excerptHtml || it?.excerpt || it?.description || it?.text || '').trim();

        const ctaText = String(it?.ctaText || it?.cta || '').trim();
        const ctaUrl = String(it?.ctaUrl || it?.url || it?.href || it?.link || '').trim();

        const imageUrl = String(it?.imageUrl || it?.image || it?.thumbUrl || '').trim();
        const mediaUrl = String(it?.mediaUrl || it?.media || it?.videoUrl || '').trim();
        const mediaKind = String(it?.mediaKind || (mediaUrl ? 'video' : 'image'));

        return {
          id: String(it?.id ?? idx),
          tags,
          date,
          title: String(it?.title || '').trim(),
          excerptHtml,
          ctaText,
          ctaUrl,
          imageUrl,
          mediaUrl,
          mediaKind,
        };
      })
      .filter((x) => x.title || x.excerptHtml || x.ctaUrl || x.imageUrl || x.mediaUrl),
  };
}

function serializeNewsToDb(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    content: {
      items: list.map((it) => ({
        id: String(it?.id || uid()),
        tags: Array.isArray(it?.tags) ? it.tags.map((t) => String(t).trim()).filter(Boolean) : [],
        date: String(it?.date || '').trim(),
        title: String(it?.title || '').trim(),
        excerptHtml: String(it?.excerptHtml || '').trim(),
        ctaText: String(it?.ctaText || '').trim(),
        ctaUrl: String(it?.ctaUrl || '').trim(),
        imageUrl: String(it?.imageUrl || '').trim(),
        mediaUrl: String(it?.mediaUrl || '').trim(),
        mediaKind: String(it?.mediaKind || (it?.mediaUrl ? 'video' : 'image')),
      })),
    },
  };
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function plainTextToHtml(text) {
  const safe = escapeHtml(text);
  // mantém parágrafos simples
  const lines = safe.split(/\r?\n/);
  return lines
    .map((l) => l.trim())
    .filter((l, idx, arr) => l || (idx > 0 && arr[idx - 1]))
    .map((l) => (l ? `<p>${l}</p>` : '<p><br/></p>'))
    .join('');
}

function insertTextAtSelection(text) {
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  // move cursor para o fim do texto inserido
  range.setStartAfter(node);
  range.setEndAfter(node);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

export default function NoticiasAdmin() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // draft: só publica no site ao salvar
  const [draft, setDraft] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState(''); // '', 'saving', 'saved', 'error'

  // Gallery modal
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // upload "padrão do site"
  const [uploadState, setUploadState] = useState(''); // '', 'uploading', 'error'

  // UI: preview x edição
  const [mode, setMode] = useState('preview'); // 'preview' | 'edit'

  const selected = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError('');
      try {
        const ref = doc(db, DOC_PATH.collection, DOC_PATH.docId);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};
        const normalized = normalizeNewsFromDb(data);
        if (cancelled) return;

        setItems(normalized.items);
        setSelectedId(normalized.items[0]?.id || null);
      } catch {
        if (!cancelled) setLoadError('Falha ao carregar notícias do Firestore.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // quando seleciona outro item, carrega o draft do item (sem abrir modal)
  useEffect(() => {
    if (!selected) {
      setDraft(null);
      setIsDirty(false);
      setSaveState('');
      setMode('preview');
      return;
    }
    setDraft({
      ...selected,
      tagsText: (selected.tags || []).join(', '),
      mediaKind: selected.mediaKind || (selected.mediaUrl ? 'video' : 'image'),
    });
    setIsDirty(false);
    setSaveState('');
    setMode('preview');
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persist(nextItems) {
    const payload = serializeNewsToDb(nextItems);
    const ref = doc(db, DOC_PATH.collection, DOC_PATH.docId);
    await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  }

  async function addItem() {
    const id = uid();
    const today = new Date().toISOString().slice(0, 10);
    const next = [
      {
        id,
        tags: ['NEWS'],
        date: today,
        title: 'NOVA NOTÍCIA',
        excerptHtml: '',
        ctaText: '',
        ctaUrl: '',
        imageUrl: '',
        mediaUrl: '',
        mediaKind: 'image',
      },
      ...items,
    ];

    // IMPORTANTE: não persiste aqui para não subir no site sem salvar
    setItems(next);
    setSelectedId(id);
    setDraft({ ...next[0], tagsText: 'NEWS', mediaKind: 'image' });
    setIsDirty(true);
    setSaveState('');
    setMode('edit');
  }

  async function deleteItemNow(id) {
    const ok = window.confirm('Excluir esta notícia?');
    if (!ok) return;

    // delete é uma ação explícita, então persiste
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    setSelectedId(next[0]?.id || null);

    try {
      setSaveState('saving');
      await persist(next);
      setSaveState('saved');
    } catch {
      setSaveState('error');
      window.alert('Falha ao excluir.');
    }
  }

  function applyDraft(patch) {
    setDraft((d) => ({ ...(d || {}), ...(patch || {}) }));
    setIsDirty(true);
    setSaveState('');
  }

  async function uploadNewsImage(file) {
    if (!file) return;
    try {
      setUploadState('uploading');
      const safeName = String(file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `news/images/${Date.now()}-${safeName}`;
      const r = storageRef(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      applyDraft({ imageUrl: url });
      setUploadState('');
    } catch {
      setUploadState('error');
      window.alert('Falha ao enviar imagem.');
    }
  }

  function onDropCover(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadNewsImage(file);
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  function exec(cmd) {
    try {
      document.execCommand(cmd);
    } catch {
      // ignore
    }
  }

  async function saveDraft() {
    if (!draft) return;

    // data obrigatória
    if (!String(draft.date || '').trim()) {
      window.alert('Preencha a data da notícia.');
      return;
    }

    const mediaKind = String(draft.mediaKind || 'image');

    const normalizedDraft = {
      ...draft,
      tags: splitTags(draft.tagsText),
      // garante string YYYY-MM-DD ou vazio
      date: String(draft.date || '').trim(),
      title: String(draft.title || '').trim(),
      excerptHtml: String(draft.excerptHtml || '').trim(),
      ctaText: String(draft.ctaText || '').trim(),
      ctaUrl: String(draft.ctaUrl || '').trim(),
      mediaKind,
      imageUrl: String(draft.imageUrl || '').trim(),
      mediaUrl: String(draft.mediaUrl || '').trim(),
    };

    // regra: se for imagem, limpamos mediaUrl. Se for vídeo, mantemos mediaUrl.
    if (mediaKind === 'image') {
      normalizedDraft.mediaUrl = '';
    }

    const next = items.map((it) => (it.id === normalizedDraft.id ? {
      id: normalizedDraft.id,
      tags: normalizedDraft.tags,
      date: normalizedDraft.date,
      title: normalizedDraft.title,
      excerptHtml: normalizedDraft.excerptHtml,
      ctaText: normalizedDraft.ctaText,
      ctaUrl: normalizedDraft.ctaUrl,
      imageUrl: normalizedDraft.imageUrl,
      mediaUrl: normalizedDraft.mediaUrl,
      mediaKind: normalizedDraft.mediaKind,
    } : it));

    setItems(next);
    setIsDirty(false);

    try {
      setSaveState('saving');
      await persist(next);
      setSaveState('saved');
      setMode('preview');
    } catch {
      setSaveState('error');
      window.alert('Falha ao salvar notícia.');
    }
  }

  function discardDraft() {
    if (!selected) return;
    setDraft({ ...selected, tagsText: (selected.tags || []).join(', ') });
    setIsDirty(false);
    setSaveState('');
    setMode('preview');
  }

  function safeText(html) {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (isLoading) {
    return (
      <div className="admin-empty" aria-label="Notícias">
        <div style={{ opacity: 0.7, letterSpacing: 2 }}>CARREGANDO…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="admin-empty" aria-label="Notícias">
        <div style={{ opacity: 0.8, letterSpacing: 1.5 }}>{loadError}</div>
      </div>
    );
  }

  return (
    <div className="admin-section" aria-label="Notícias">
      <div className="admin-section-header">
        <div>
          <h2 className="admin-h2">NOTÍCIAS</h2>
          <div className="admin-subtitle">A notícia só aparece no site depois de clicar em SALVAR.</div>
        </div>

        <div className="admin-section-actions">
          <button type="button" className="admin-btn" onClick={addItem}>
            + NOVA NOTÍCIA
          </button>
          <button type="button" className="admin-btn admin-btn-danger" onClick={() => selected && deleteItemNow(selected.id)} disabled={!selected}>
            EXCLUIR
          </button>
        </div>
      </div>

      <div className="admin-grid">
        <div className="admin-panel" role="list" aria-label="Lista de notícias">
          <div className="admin-panel-title">NOTÍCIAS</div>
          <div className="admin-list">
            {items.length === 0 ? (
              <div style={{ opacity: 0.7, letterSpacing: 1.5, padding: 18 }}>Nenhuma notícia cadastrada.</div>
            ) : (
              items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`admin-list-item ${selectedId === it.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(it.id)}
                >
                  <div className="admin-list-item-title">{(it.title || 'SEM TÍTULO').toUpperCase()}</div>
                  <div className="admin-list-item-meta">
                    {(it.tags || []).slice(0, 2).map((t) => String(t).toUpperCase()).join(' / ') || 'NEWS'}
                    {it.date ? ` • ${it.date}` : ''}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="admin-panel" aria-label="Preview/Editor">
          <div className="admin-panel-title">{mode === 'edit' ? 'EDITAR' : 'PREVIEW'}</div>

          {!draft ? (
            <div className="admin-form">
              <div style={{ opacity: 0.7, letterSpacing: 1.5 }}>Selecione ou crie uma notícia.</div>
            </div>
          ) : mode !== 'edit' ? (
            <div className="admin-form">
              <div className="admin-section-actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  {saveState === 'saved' ? 'Salvo.' : saveState === 'error' ? 'Erro ao salvar.' : isDirty ? 'Alterações pendentes.' : 'Sem alterações.'}
                </div>
                <button type="button" className="admin-btn admin-btn-primary" onClick={() => setMode('edit')}>
                  EDITAR
                </button>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div className="admin-label">TAGS</div>
                  <div style={{ opacity: 0.9 }}>{(draft.tags || []).join(' / ') || safeText(draft.tagsText) || '—'}</div>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <div className="admin-label">DATA</div>
                  <div style={{ opacity: 0.9 }}>{draft.date || '—'}</div>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <div className="admin-label">TÍTULO</div>
                  <div style={{ opacity: 0.95, fontWeight: 900 }}>{draft.title || '—'}</div>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <div className="admin-label">RESUMO</div>
                  {draft.excerptHtml ? (
                    <div className="admin-input" style={{ padding: 12, borderRadius: 12 }} dangerouslySetInnerHTML={{ __html: draft.excerptHtml }} />
                  ) : (
                    <div style={{ opacity: 0.8 }}>—</div>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div className="admin-label">MÍDIA</div>
                  {(() => {
                    const kind = String(draft.mediaKind || (draft.mediaUrl ? 'video' : 'image'));
                    const href = safeHref(draft.mediaUrl || draft.ctaUrl || '');

                    if (kind === 'image') {
                      return draft.imageUrl ? (
                        <a
                          href={safeHref(draft.imageUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-dropzone-preview"
                          style={{ padding: 0, display: 'block', textDecoration: 'none' }}
                          title="Abrir imagem"
                        >
                          <img src={draft.imageUrl} alt="" />
                        </a>
                      ) : null;
                    }

                    const thumb = getVideoThumbnail(draft.mediaUrl);
                    if (thumb) {
                      return (
                        <a
                          href={href || safeHref(draft.mediaUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-video-preview"
                          title={kind === 'video_vertical' ? 'Abrir vídeo vertical' : 'Abrir vídeo'}
                        >
                          <img src={thumb} alt="" className="admin-video-preview-img" />
                          <div className="admin-video-preview-play" aria-hidden="true" />
                          {kind === 'video_vertical' ? <div className="admin-video-preview-badge">VERTICAL</div> : null}
                        </a>
                      );
                    }

                    return null;
                  })()}

                  {draft.mediaUrl ? (
                    <a href={safeHref(draft.mediaUrl)} target="_blank" rel="noreferrer" style={{ opacity: 0.85, textDecoration: 'underline' }}>
                      {draft.mediaUrl}
                    </a>
                  ) : !draft.imageUrl ? (
                    <div style={{ opacity: 0.8 }}>—</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-form">
              <div className="admin-section-actions" style={{ marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={saveDraft}
                    disabled={!isDirty || saveState === 'saving'}
                  >
                    {saveState === 'saving' ? 'SALVANDO…' : 'SALVAR'}
                  </button>
                  <button type="button" className="admin-btn" onClick={discardDraft} disabled={saveState === 'saving'}>
                    {isDirty ? 'DESCARTAR' : 'CANCELAR'}
                  </button>
                </div>

                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  {saveState === 'saved' ? 'Salvo.' : saveState === 'error' ? 'Erro ao salvar.' : isDirty ? 'Alterações pendentes.' : 'Sem alterações.'}
                </div>
              </div>

              <div className="admin-field-row">
                <label className="admin-field">
                  <div className="admin-label">TAGS</div>
                  <input
                    className="admin-input"
                    value={draft.tagsText || ''}
                    onChange={(e) => applyDraft({ tagsText: e.target.value })}
                    placeholder="NEWS, RELEASE"
                  />
                </label>

                <label className="admin-field">
                  <div className="admin-label">DATA</div>
                  <input
                    className="admin-input"
                    type="date"
                    value={draft.date || ''}
                    onChange={(e) => applyDraft({ date: e.target.value })}
                    required
                  />
                </label>
              </div>

              <label className="admin-field">
                <div className="admin-label">TÍTULO</div>
                <input className="admin-input" value={draft.title || ''} onChange={(e) => applyDraft({ title: e.target.value })} />
              </label>

              <div className="admin-field">
                <div className="admin-label">RESUMO</div>

                <div className="admin-section-actions" style={{ gap: 8, marginBottom: 8 }}>
                  <button type="button" className="admin-btn" onClick={() => exec('bold')} title="Negrito">
                    B
                  </button>
                  <button type="button" className="admin-btn" onClick={() => exec('italic')} title="Itálico">
                    I
                  </button>
                  <button type="button" className="admin-btn" onClick={() => exec('underline')} title="Sublinhado">
                    U
                  </button>
                </div>

                <div
                  className="admin-input"
                  style={{ minHeight: 140, padding: 12, borderRadius: 12 }}
                  contentEditable
                  suppressContentEditableWarning
                  onPaste={(e) => {
                    // cola SOMENTE texto (sem estilos do Ctrl+V)
                    e.preventDefault();
                    const text = e.clipboardData?.getData('text/plain') ?? '';
                    if (text) {
                      insertTextAtSelection(text);
                      // salva com HTML mínimo (p/br), para o site renderizar sem herdar estilos
                      const html = plainTextToHtml(e.currentTarget.innerText);
                      applyDraft({ excerptHtml: html });
                    }
                  }}
                  onInput={(e) => {
                    // normaliza sempre para HTML limpo
                    const html = plainTextToHtml(e.currentTarget.innerText);
                    applyDraft({ excerptHtml: html });
                  }}
                  dangerouslySetInnerHTML={{ __html: draft.excerptHtml || '' }}
                />
              </div>

              <div className="admin-media-block" style={{ marginTop: 6 }}>
                <div className="admin-media-title">MÍDIA</div>

                <div className="admin-field-row">
                  <label className="admin-field">
                    <div className="admin-label">TEXTO DO BOTÃO</div>
                    <input
                      className="admin-input"
                      value={draft.ctaText || ''}
                      onChange={(e) => applyDraft({ ctaText: e.target.value })}
                      placeholder="LER MAIS"
                    />
                  </label>

                  <label className="admin-field">
                    <div className="admin-label">URL DO BOTÃO</div>
                    <input
                      className="admin-input"
                      value={draft.ctaUrl || ''}
                      onChange={(e) => applyDraft({ ctaUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </label>
                </div>

                {/* Tipo + URL (esquerda) + Thumb/Preview (direita) */}
                <div className="admin-field-row" style={{ gridTemplateColumns: '1fr 280px', alignItems: 'start' }}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <label className="admin-field" style={{ marginBottom: 0 }}>
                      <div className="admin-label">TIPO DE MÍDIA</div>
                      <select
                        className="admin-input"
                        value={draft.mediaKind || 'image'}
                        onChange={(e) => applyDraft({ mediaKind: e.target.value })}
                      >
                        <option value="image">Imagem</option>
                        <option value="video">Vídeo</option>
                        <option value="video_vertical">Vídeo vertical</option>
                      </select>
                    </label>

                    <label className="admin-field" style={{ marginBottom: 0 }}>
                      <div className="admin-label">URL DA MÍDIA</div>
                      <input
                        className="admin-input"
                        value={draft.mediaKind === 'image' ? (draft.imageUrl || '') : (draft.mediaUrl || '')}
                        onChange={(e) =>
                          applyDraft(
                            draft.mediaKind === 'image' ? { imageUrl: e.target.value } : { mediaUrl: e.target.value }
                          )
                        }
                        placeholder="https://..."
                      />
                    </label>
                  </div>

                  <div className="admin-field" style={{ marginBottom: 0 }}>
                    <div className="admin-label" style={{ marginBottom: 8 }}>THUMB / PRÉVIA</div>

                    {draft.mediaKind === 'image' ? (
                      <div
                        className="admin-dropzone admin-dropzone-square"
                        role="button"
                        tabIndex={0}
                        onClick={() => document.getElementById('news-cover-input')?.click()}
                        onDrop={onDropCover}
                        onDragOver={onDragOver}
                      >
                        {draft.imageUrl ? (
                          <img className="admin-dropzone-square-img" src={draft.imageUrl} alt="Prévia da imagem" />
                        ) : (
                          <div className="admin-dropzone-placeholder">
                            <div className="admin-dropzone-title">CLIQUE</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      (() => {
                        const href = safeHref(draft.mediaUrl);
                        const thumb = getVideoThumbnail(draft.mediaUrl);

                        if (thumb) {
                          return (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="admin-video-preview"
                              title={draft.mediaKind === 'video_vertical' ? 'Abrir vídeo vertical' : 'Abrir vídeo'}
                              style={{ maxWidth: 'none' }}
                            >
                              <img src={thumb} alt="" className="admin-video-preview-img" />
                              <div className="admin-video-preview-play" aria-hidden="true" />
                              {draft.mediaKind === 'video_vertical' ? (
                                <div className="admin-video-preview-badge">VERTICAL</div>
                              ) : null}
                            </a>
                          );
                        }

                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="admin-dropzone admin-dropzone-square"
                            style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}
                            title="Abrir vídeo"
                          >
                            <div className="admin-dropzone-placeholder" style={{ padding: 18 }}>
                              <div className="admin-dropzone-title">VÍDEO</div>
                            </div>
                          </a>
                        );
                      })()
                    )}

                    {draft.mediaKind === 'image' ? (
                      <input
                        id="news-cover-input"
                        type="file"
                        accept="image/*"
                        onChange={(e) => uploadNewsImage(e.target.files?.[0])}
                        style={{ display: 'none' }}
                        disabled={uploadState === 'uploading'}
                      />
                    ) : null}

                    {draft.mediaKind === 'image' ? (
                      uploadState === 'uploading' ? (
                        <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>Enviando…</div>
                      ) : uploadState === 'error' ? (
                        <div style={{ opacity: 0.85, fontSize: 12, marginTop: 6 }}>Erro ao enviar.</div>
                      ) : null
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isGalleryOpen ? (
        <ImageGalleryModal
          title="GALERIA (NOTÍCIAS)"
          initialTabKey="news"
          allFolder="uploads"
          tabs={[{ key: 'news', label: 'NOTÍCIAS', folder: 'news/images' }, { key: 'uploads', label: 'UPLOADS', folder: 'uploads' }]}
          onSelect={(url) => {
            applyDraft({ imageUrl: url });
            setIsGalleryOpen(false);
          }}
          onClose={() => setIsGalleryOpen(false)}
        />
      ) : null}
    </div>
  );
}
