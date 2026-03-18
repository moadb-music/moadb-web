import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import ImageGalleryModal from './components/ImageGalleryModal';

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

// Normaliza um campo de texto que pode ser string (legado) ou { pt, en }
function normalizeI18n(value, fallback = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { pt: String(value.pt || '').trim(), en: String(value.en || '').trim() };
  }
  const str = String(value || fallback).trim();
  return { pt: str, en: '' };
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

        const date = String(it?.date || it?.publishedAt || '').trim();
        const ctaUrl = String(it?.ctaUrl || it?.url || it?.href || it?.link || '').trim();
        const imageUrl = String(it?.imageUrl || it?.image || it?.thumbUrl || '').trim();
        const mediaUrl = String(it?.mediaUrl || it?.media || it?.videoUrl || '').trim();
        const mediaKind = String(it?.mediaKind || (mediaUrl ? 'video' : 'image'));

        // campos i18n
        const excerptFallback = String(it?.excerptHtml || it?.excerpt || it?.description || it?.text || '').trim();
        const title = normalizeI18n(it?.title, '');
        const excerptHtml = normalizeI18n(it?.excerptHtml, excerptFallback);
        const ctaText = normalizeI18n(it?.ctaText || it?.cta, '');

        return {
          id: String(it?.id ?? idx),
          tags,
          date,
          title,
          excerptHtml,
          ctaText,
          ctaUrl,
          imageUrl,
          mediaUrl,
          mediaKind,
        };
      })
      .filter((x) => x.title?.pt || x.title?.en || x.excerptHtml?.pt || x.excerptHtml?.en || x.ctaUrl || x.imageUrl || x.mediaUrl),
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
        title: { pt: String(it?.title?.pt || '').trim(), en: String(it?.title?.en || '').trim() },
        excerptHtml: { pt: String(it?.excerptHtml?.pt || '').trim(), en: String(it?.excerptHtml?.en || '').trim() },
        ctaText: { pt: String(it?.ctaText?.pt || '').trim(), en: String(it?.ctaText?.en || '').trim() },
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
              onClick={() => { onSelect('pt'); }}>
              <span className="lang-flag" aria-hidden="true"><FlagBR /></span>
              <span>Português</span>
            </button>
          </li>
          <li>
            <button type="button" className={`lang-dropdown-item${!isPt ? ' active' : ''}`} role="menuitem"
              onClick={() => { onSelect('en'); }}>
              <span className="lang-flag" aria-hidden="true"><FlagUK /></span>
              <span>English</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export default function NoticiasAdmin({ onDirtyChange }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // draft: só publica no site ao salvar
  const [draft, setDraft] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState(''); // '', 'saving', 'saved', 'error'

  // notícia nova ainda não salva (não aparece na lista)
  const [pendingNew, setPendingNew] = useState(null);

  // Gallery modal
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // idioma do formulário de edição
  const [newsLang, setNewsLang] = useState('pt');
  const [newsLangOpen, setNewsLangOpen] = useState(false);
  const newsLangRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (newsLangRef.current && !newsLangRef.current.contains(e.target)) setNewsLangOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // upload "padrão do site"
  const [uploadState, setUploadState] = useState(''); // '', 'uploading', 'error'

  // UI: preview x edição
  const [mode, setMode] = useState('preview'); // 'preview' | 'edit'

  // clamp do excerpt no preview
  const previewExcerptRef = useRef(null);
  const [previewClamped, setPreviewClamped] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId]);

  const excerptRef = useRef(null);
  const lastExcerptHtmlRef = useRef('');

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

  const [pendingSelectId, setPendingSelectId] = useState(undefined);

  function trySelectId(id) {
    if (isDirty && mode === 'edit') {
      setPendingSelectId(id);
    } else {
      setSelectedId(id);
    }
  }

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

  // quando troca a notícia selecionada OU entra no modo edit OU muda o idioma, sincroniza o HTML do editor
  useEffect(() => {
    if (mode !== 'edit') return;
    if (!excerptRef.current) return;
    const nextHtml = String(draft?.excerptHtml?.[newsLang] || draft?.excerptHtml || '');
    if (excerptRef.current.innerHTML !== nextHtml) {
      excerptRef.current.innerHTML = nextHtml;
      lastExcerptHtmlRef.current = nextHtml;
    }
  }, [selectedId, mode, newsLang]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persist(nextItems) {
    const payload = serializeNewsToDb(nextItems);
    const ref = doc(db, DOC_PATH.collection, DOC_PATH.docId);
    await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  }

  function addItem() {
    if (isDirty && mode === 'edit') {
      setPendingSelectId('__new__');
      return;
    }
    _createNewItem();
  }

  function _createNewItem() {
    const id = uid();
    const today = new Date().toISOString().slice(0, 10);
    const newItem = {
      id,
      tags: ['NEWS'],
      date: today,
      title: { pt: 'NOVA NOTÍCIA', en: 'NEW POST' },
      excerptHtml: { pt: '', en: '' },
      ctaText: { pt: '', en: '' },
      ctaUrl: '',
      imageUrl: '',
      mediaUrl: '',
      mediaKind: 'image',
    };
    setPendingNew(newItem);
    setSelectedId(null);
    setDraft({ ...newItem, tagsText: 'NEWS' });
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

  const I18N_FIELDS = ['title', 'excerptHtml', 'ctaText'];

  function applyDraft(patch) {
    setDraft((d) => {
      const next = { ...(d || {}) };
      for (const [k, v] of Object.entries(patch || {})) {
        if (I18N_FIELDS.includes(k)) {
          // escreve só no idioma atual
          const prev = next[k] && typeof next[k] === 'object' ? next[k] : { pt: '', en: '' };
          next[k] = { ...prev, [newsLang]: v };
          if (k === 'excerptHtml') {
            lastExcerptHtmlRef.current = String(v || '');
          }
        } else {
          next[k] = v;
        }
      }
      return next;
    });
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
      date: String(draft.date || '').trim(),
      title: {
        pt: String(draft.title?.pt || '').trim(),
        en: String(draft.title?.en || '').trim(),
      },
      excerptHtml: {
        pt: String(draft.excerptHtml?.pt || '').trim(),
        en: String(draft.excerptHtml?.en || '').trim(),
      },
      ctaText: {
        pt: String(draft.ctaText?.pt || '').trim(),
        en: String(draft.ctaText?.en || '').trim(),
      },
      ctaUrl: String(draft.ctaUrl || '').trim(),
      mediaKind,
      imageUrl: String(draft.imageUrl || '').trim(),
      mediaUrl: String(draft.mediaUrl || '').trim(),
    };

    // regra: se for imagem, limpamos mediaUrl. Se for vídeo, mantemos mediaUrl.
    if (mediaKind === 'image') {
      normalizedDraft.mediaUrl = '';
    }

    const savedItem = {
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
    };

    // se era nova (pendente), insere no topo da lista
    const isNew = pendingNew && pendingNew.id === normalizedDraft.id;
    const next = isNew
      ? [savedItem, ...items]
      : items.map((it) => (it.id === savedItem.id ? savedItem : it));

    setItems(next);
    if (isNew) {
      setPendingNew(null);
      setSelectedId(savedItem.id);
    }
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
    // se era nova pendente, descarta sem adicionar à lista
    if (pendingNew) {
      setPendingNew(null);
      setDraft(null);
      setIsDirty(false);
      setSaveState('');
      setMode('preview');
      return;
    }
    if (!selected) return;
    setDraft({ ...selected, tagsText: (selected.tags || []).join(', ') });
    setIsDirty(false);
    setSaveState('');
    setMode('preview');

    if (excerptRef.current) {
      const html = String(selected.excerptHtml?.[newsLang] || selected.excerptHtml || '');
      excerptRef.current.innerHTML = html;
      lastExcerptHtmlRef.current = html;
    }
  }

  useEffect(() => {
    onDirtyChange?.(isDirty && mode === 'edit');
  }, [isDirty, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPreviewExpanded(false);
    const raf = requestAnimationFrame(() => {
      const el = previewExcerptRef.current;
      if (!el) return;
      setPreviewClamped(el.scrollHeight - el.clientHeight > 1);
    });
    return () => cancelAnimationFrame(raf);
  }, [draft?.excerptHtml, mode, newsLang]);

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
        </div>
      </div>

      <div className="admin-grid">
        <div className="admin-panel" role="list" aria-label="Lista de notícias">
          <div className="admin-panel-title">NOTÍCIAS</div>
          <div className="admin-list">
            {items.length === 0 ? (
              <div style={{ opacity: 0.7, letterSpacing: 1.5, padding: 18 }}>Nenhuma notícia cadastrada.</div>
            ) : (
              items.map((it) => {
                const isVideo = it.mediaKind === 'video' || it.mediaKind === 'video_vertical';
                const thumb = it.imageUrl || (isVideo ? getVideoThumbnail(it.mediaUrl) : '');
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`admin-list-item ${selectedId === it.id ? 'is-active' : ''}`}
                    onClick={() => trySelectId(it.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.06)', borderRadius: 6, flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="admin-list-item-title">{(it.title?.pt || it.title?.en || 'SEM TÍTULO').toUpperCase()}</div>
                      <div className="admin-list-item-meta">
                        {(it.tags || []).slice(0, 2).map((t) => String(t).toUpperCase()).join(' / ') || 'NEWS'}
                        {it.date ? ` • ${it.date}` : ''}
                      </div>
                    </div>
                  </button>
                );
              })
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
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="admin-btn admin-btn-primary" onClick={() => setMode('edit')}>
                    EDITAR
                  </button>
                  {selected && !pendingNew ? (
                    <button type="button" className="admin-btn admin-btn-danger" onClick={() => deleteItemNow(selected.id)}>
                      EXCLUIR
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Card (300px) + painel completo */}
              {(() => {
                const isVideo = draft.mediaKind === 'video' || draft.mediaKind === 'video_vertical';
                const thumbSrc = draft.imageUrl || (isVideo ? getVideoThumbnail(draft.mediaUrl) : '') || '';
                const hasMedia = Boolean(thumbSrc || (isVideo && draft.mediaUrl));
                const hasCtaLink = Boolean(draft.ctaUrl);
                const tags = draft.tags && draft.tags.length ? draft.tags : splitTags(draft.tagsText || '');
                const previewTitle = draft.title?.[newsLang] || draft.title?.pt || '—';
                const previewExcerpt = draft.excerptHtml?.[newsLang] || draft.excerptHtml?.pt || '';
                const previewCta = draft.ctaText?.[newsLang] || draft.ctaText?.pt || 'LER MAIS';

                return (
                  <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                    {/* Card */}
                    <article
                      className={`news-card ${hasMedia ? '' : 'news-card--text'}`.trim()}
                      style={{ flex: 'none', width: 300 }}
                    >
                      {hasMedia ? (
                        <div
                          className={`news-media ${thumbSrc ? 'has-thumb-bg' : ''}`.trim()}
                          style={thumbSrc ? { '--news-thumb-url': `url(${thumbSrc})`, cursor: 'pointer' } : { cursor: 'pointer' }}
                          onClick={() => setPreviewModalOpen(true)}
                        >
                          {thumbSrc ? <img src={thumbSrc} alt="" /> : null}
                          {isVideo ? <div className="news-play" aria-hidden="true" /> : null}
                        </div>
                      ) : null}
                      <div className="news-body">
                        {tags.length ? (
                          <div className="news-tags">
                            {tags.map((t) => <span key={t} className="news-tag">{String(t).toUpperCase()}</span>)}
                          </div>
                        ) : null}
                        <h3 className="news-headline">{previewTitle}</h3>
                        {draft.date ? <div className="news-date">{draft.date}</div> : null}
                        {previewExcerpt ? (
                          <div
                            ref={previewExcerptRef}
                            className={`news-excerpt${previewExpanded ? ' news-excerpt--expanded' : ''}${previewClamped && !previewExpanded ? ' is-overflow' : ''}`}
                            dangerouslySetInnerHTML={{ __html: previewExcerpt }}
                          />
                        ) : null}
                        {previewClamped ? (
                          <button type="button" className="news-readmore" onClick={() => setPreviewModalOpen(true)}>Ler mais…</button>
                        ) : null}
                        {hasCtaLink ? (
                          <span className="news-cta" style={{ cursor: 'pointer' }} onClick={() => setPreviewModalOpen(true)}>{previewCta}</span>
                        ) : null}
                      </div>
                    </article>

                    {/* Informações completas */}
                    <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <div className="admin-label">INFORMAÇÕES</div>
                        <div style={{ marginLeft: 'auto' }}>
                          <LangDropdown
                            lang={newsLang}
                            open={newsLangOpen}
                            onToggle={() => setNewsLangOpen(v => !v)}
                            onSelect={(l) => { setNewsLang(l); setNewsLangOpen(false); }}
                            dropRef={newsLangRef}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="admin-muted">TÍTULO</div>
                        <div style={{ fontWeight: 700, marginTop: 2 }}>{previewTitle}</div>
                      </div>

                      <div>
                        <div className="admin-muted">DATA</div>
                        <div style={{ marginTop: 2 }}>{draft.date || '—'}</div>
                      </div>

                      <div>
                        <div className="admin-muted">TAGS</div>
                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {tags.length ? tags.map(t => <span key={t} className="news-tag">{t.toUpperCase()}</span>) : <span style={{ opacity: 0.5 }}>—</span>}
                        </div>
                      </div>

                      <div>
                        <div className="admin-muted">TIPO DE MÍDIA</div>
                        <div style={{ marginTop: 2 }}>{draft.mediaKind === 'video' ? 'Vídeo' : draft.mediaKind === 'video_vertical' ? 'Vídeo vertical' : 'Imagem'}</div>
                      </div>

                      {draft.ctaUrl ? (
                        <div>
                          <div className="admin-muted">BOTÃO CTA</div>
                          <div style={{ marginTop: 2 }}>{previewCta}</div>
                          <div style={{ marginTop: 2, wordBreak: 'break-all', fontSize: 12, opacity: 0.8 }}>{draft.ctaUrl}</div>
                        </div>
                      ) : null}

                      {previewExcerpt ? (
                        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
                          <div className="admin-muted">TEXTO</div>
                          <div
                            className="news-modal-text"
                            style={{
                              marginTop: 6,
                              overflowY: 'auto',
                              overflowX: 'hidden',
                              maxHeight: 220,
                              paddingRight: 6,
                              scrollbarWidth: 'thin',
                              scrollbarColor: 'rgba(139,0,0,0.4) transparent',
                            }}
                            dangerouslySetInnerHTML={{ __html: previewExcerpt }}
                          />
                        </div>
                      ) : null}
                    </div>

                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="admin-form">
              <div className="admin-section-actions" style={{ marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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

                  {/* Dropdown de idioma */}
                  <div style={{ marginLeft: 8 }}>
                    <LangDropdown
                      lang={newsLang}
                      open={newsLangOpen}
                      onToggle={() => setNewsLangOpen(v => !v)}
                      onSelect={(l) => { setNewsLang(l); setNewsLangOpen(false); }}
                      dropRef={newsLangRef}
                    />
                  </div>
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
                <input className="admin-input" value={draft.title?.[newsLang] || ''} onChange={(e) => applyDraft({ title: e.target.value })} />
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
                  ref={excerptRef}
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
                      const html = plainTextToHtml(e.currentTarget.innerText);
                      applyDraft({ excerptHtml: html });
                    }
                  }}
                  onInput={(e) => {
                    // normaliza sempre para HTML limpo
                    const html = plainTextToHtml(e.currentTarget.innerText);
                    // evita setState em loop quando nada mudou (isso é o que geralmente “inverte” o cursor)
                    if (html !== lastExcerptHtmlRef.current) {
                      lastExcerptHtmlRef.current = html;
                      applyDraft({ excerptHtml: html });
                    }
                  }}
                  onBlur={(e) => {
                    // garante sincronização final ao sair do campo
                    const html = plainTextToHtml(e.currentTarget.innerText);
                    if (html !== lastExcerptHtmlRef.current) {
                      lastExcerptHtmlRef.current = html;
                      applyDraft({ excerptHtml: html });
                    }
                  }}
                />
              </div>

              <div className="admin-media-block" style={{ marginTop: 6 }}>
                <div className="admin-media-title">MÍDIA</div>

                <div className="admin-field-row">
                  <label className="admin-field">
                    <div className="admin-label">TEXTO DO BOTÃO</div>
                    <input
                      className="admin-input"
                      value={draft.ctaText?.[newsLang] || ''}
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

              {/* Preview do card durante edição */}
              {(() => {
                const isVideo = draft.mediaKind === 'video' || draft.mediaKind === 'video_vertical';
                const thumbSrc = draft.imageUrl || (isVideo ? getVideoThumbnail(draft.mediaUrl) : '') || '';
                const hasMedia = Boolean(thumbSrc || (isVideo && draft.mediaUrl));
                const hasCtaLink = Boolean(draft.ctaUrl);
                const tags = draft.tags && draft.tags.length ? draft.tags : splitTags(draft.tagsText || '');
                const previewTitle = draft.title?.[newsLang] || draft.title?.pt || '—';
                const previewExcerpt = draft.excerptHtml?.[newsLang] || draft.excerptHtml?.pt || '';
                const previewCta = draft.ctaText?.[newsLang] || draft.ctaText?.pt || 'LER MAIS';
                return (
                  <div style={{ marginTop: 18 }}>
                    <div className="admin-label" style={{ marginBottom: 10 }}>PREVIEW DO CARD</div>
                    <article
                      className={`news-card ${hasMedia ? '' : 'news-card--text'}`.trim()}
                      style={{ flex: 'none', width: 300, pointerEvents: 'none' }}
                    >
                      {hasMedia ? (
                        <div
                          className={`news-media ${thumbSrc ? 'has-thumb-bg' : ''}`.trim()}
                          style={thumbSrc ? { '--news-thumb-url': `url(${thumbSrc})` } : undefined}
                        >
                          {thumbSrc ? <img src={thumbSrc} alt="" /> : null}
                          {isVideo ? <div className="news-play" aria-hidden="true" /> : null}
                        </div>
                      ) : null}
                      <div className="news-body">
                        {tags.length ? (
                          <div className="news-tags">
                            {tags.map((t) => <span key={t} className="news-tag">{String(t).toUpperCase()}</span>)}
                          </div>
                        ) : null}
                        <h3 className="news-headline">{previewTitle}</h3>
                        {draft.date ? <div className="news-date">{draft.date}</div> : null}
                        {previewExcerpt ? (
                          <div className="news-excerpt is-overflow" dangerouslySetInnerHTML={{ __html: previewExcerpt }} />
                        ) : null}
                        {hasCtaLink ? (
                          <span className="news-cta">{previewCta}</span>
                        ) : null}
                      </div>
                    </article>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {pendingSelectId !== undefined ? (
        <div className="news-modal-backdrop" onMouseDown={() => setPendingSelectId(undefined)}>
          <div
            className="news-modal"
            style={{ maxWidth: 420, height: 'auto', minHeight: 'unset' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="news-modal-close" onClick={() => setPendingSelectId(undefined)} aria-label="Fechar">×</button>
            <div style={{ padding: '36px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ margin: 0, fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', letterSpacing: 2, textTransform: 'uppercase', color: '#fff' }}>SAIR SEM SALVAR?</h2>
              <p style={{ margin: 0, opacity: 0.7, lineHeight: 1.6, fontSize: '0.9rem' }}>Você tem alterações não salvas. Deseja sair mesmo assim?</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="admin-btn" onClick={() => setPendingSelectId(undefined)}>CANCELAR</button>
                <button type="button" className="admin-btn admin-btn-danger" onClick={() => {
                  const id = pendingSelectId;
                  setPendingSelectId(undefined);
                  if (id === '__new__') {
                    discardDraft();
                    setTimeout(_createNewItem, 0);
                  } else {
                    discardDraft();
                    setSelectedId(id ?? null);
                  }
                }}>SAIR SEM SALVAR</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {previewModalOpen && draft ? (
        <div className="news-modal-backdrop" onMouseDown={() => setPreviewModalOpen(false)}>
          <div className="news-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="news-modal-close" onClick={() => setPreviewModalOpen(false)} aria-label="Fechar">×</button>
            <div className="news-modal-inner">
              {(() => {
                const isVideo = draft.mediaKind === 'video' || draft.mediaKind === 'video_vertical';
                const thumbSrc = draft.imageUrl || (isVideo ? getVideoThumbnail(draft.mediaUrl) : '') || '';
                const tags = draft.tags && draft.tags.length ? draft.tags : splitTags(draft.tagsText || '');
                const modalTitle = draft.title?.[newsLang] || draft.title?.pt || '';
                const modalExcerpt = draft.excerptHtml?.[newsLang] || draft.excerptHtml?.pt || '';
                const modalCta = draft.ctaText?.[newsLang] || draft.ctaText?.pt || 'LER MAIS';
                return (
                  <>
                    {isVideo && draft.mediaUrl ? (
                      draft.mediaUrl.includes('instagram.com') ? (
                        <a className="news-modal-external" href={draft.mediaUrl} target="_blank" rel="noreferrer">
                          <span>&#9654;</span> Assistir no Instagram
                        </a>
                      ) : (
                        <div className="news-modal-video">
                          <iframe
                            src={(() => { try { const u = new URL(draft.mediaUrl); const id = u.searchParams.get('v') || (u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.pathname.split('/shorts/')[1]?.split('?')[0] || u.pathname.split('/embed/')[1]?.split('/')[0] || u.pathname.slice(1)); return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : draft.mediaUrl; } catch { return draft.mediaUrl; } })()}
                            title={modalTitle}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )
                    ) : thumbSrc ? (
                      <img className="news-modal-img" src={thumbSrc} alt="" />
                    ) : null}
                    <div className="news-modal-body">
                      {tags.length ? (
                        <div className="news-tags">{tags.map(t => <span key={t} className="news-tag">{t.toUpperCase()}</span>)}</div>
                      ) : null}
                      <h2 className="news-modal-title">{modalTitle}</h2>
                      {draft.date ? <div className="news-date">{draft.date}</div> : null}
                      {modalExcerpt ? (
                        <div className="news-modal-text" dangerouslySetInnerHTML={{ __html: modalExcerpt }} />
                      ) : null}
                      {draft.ctaUrl ? (
                        <a className="news-cta" href={draft.ctaUrl} target="_blank" rel="noreferrer">
                          {modalCta}
                        </a>
                      ) : null}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

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
