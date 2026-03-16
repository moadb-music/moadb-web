import { useMemo, useState } from 'react';
import YouTubeSegmentPicker from './YouTubeSegmentPicker';
import { useEffect } from 'react';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  getDownloadURL,
  listAll,
  ref as storageRef,
  uploadBytes,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from './firebase';

const DEFAULT_FORM = {
  type: 'single',
  title: '',
  year: new Date().getFullYear().toString(),
  coverFile: null,
  coverPreviewUrl: '',
  spotifyUrl: '',
  appleUrl: '',
  deezerUrl: '',
  youtubeMusicUrl: '',
  tracks: [], // [{ id, name, youtubeUrl, lyrics, startSec, endSec }]
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function mapTypeFromDb(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'album') return 'album';
  if (t === 'ep') return 'ep';
  if (t === 'single') return 'single';
  return 'single';
}

function normalizeReleaseFromContent(entry) {
  const e = entry || {};
  const rawTracks = e.tracks;
  const tracksArray = Array.isArray(rawTracks)
    ? rawTracks
    : rawTracks && typeof rawTracks === 'object'
      ? Object.values(rawTracks)
      : [];

  return {
    id: String(e.id || uid()),
    type: mapTypeFromDb(e.type),
    title: e.title || '',
    year: String(e.year || ''),
    coverUrl: e.coverUrl || e.coverURL || e.cover || '',
    spotifyUrl: e.links?.spotify || '',
    appleUrl: e.links?.apple || '',
    deezerUrl: e.links?.deezer || '',
    youtubeMusicUrl: e.links?.youtube || e.links?.youtubeMusic || '',
    tracks: tracksArray.map(t => ({
      id: t?.id || uid(),
      name: t?.name || t?.title || '',
      youtubeUrl: t?.youtubeUrl || t?.youtube || t?.url || '',
      lyrics: t?.lyrics || '',
      startSec: Number(t?.startSec ?? t?.start ?? t?.segmentStart ?? 0),
      endSec: Number(t?.endSec ?? t?.end ?? t?.segmentEnd ?? 15),
    })),
  };
}

function serializeReleaseToContent(r) {
  return {
    id: String(r.id || uid()),
    type: String(r.type || 'single').toUpperCase(),
    title: String(r.title || '').trim(),
    year: String(r.year || '').trim(),
    coverUrl: r.coverUrl || '',
    links: {
      spotify: r.spotifyUrl || '',
      apple: r.appleUrl || '',
      deezer: r.deezerUrl || '',
      youtube: r.youtubeMusicUrl || '',
    },
    tracks: Array.isArray(r.tracks)
      ? r.tracks.map(t => ({
        id: t.id || uid(),
        name: String(t.name || '').trim(),
        youtubeUrl: String(t.youtubeUrl || '').trim(),
        lyrics: t.lyrics || '',
        startSec: Number(t.startSec ?? 0),
        endSec: Number(t.endSec ?? 0),
      }))
      : [],
  };
}

export default function DiscografiaAdmin() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rawContent, setRawContent] = useState([]);

  const [selectedId, setSelectedId] = useState(items[0]?.id || null);
  const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId]);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [openPickerByTrackId, setOpenPickerByTrackId] = useState(() => ({}));
  const [editingTrackId, setEditingTrackId] = useState(null); // 'new' | trackId | null

  const [form, setForm] = useState(() => {
    if (!selected) return DEFAULT_FORM;
    return {
      ...DEFAULT_FORM,
      ...selected,
      coverFile: null,
      coverPreviewUrl: selected.coverUrl || '',
      tracks: (selected.tracks || []).map(t => ({
        id: t.id || uid(),
        name: t.name || '',
        youtubeUrl: t.youtubeUrl || '',
        lyrics: t.lyrics || '',
        startSec: Number(t.startSec ?? 0),
        endSec: Number(t.endSec ?? 15),
      })),
    };
  });

  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [coverPickerLoading, setCoverPickerLoading] = useState(false);
  const [coverPickerError, setCoverPickerError] = useState('');
  const [coverPickerImages, setCoverPickerImages] = useState([]); // [{ path, url }]
  const [galleryTab, setGalleryTab] = useState('covers');

  // Hidden file input for the gallery upload tile
  const [galleryUploadInputKey, setGalleryUploadInputKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError('');
      try {
        const ref = doc(db, 'siteData', 'moadb_discography');
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};
        const content = Array.isArray(data?.content) ? data.content : [];
        const list = content.map(normalizeReleaseFromContent);
        list.sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')));
        if (cancelled) return;
        setRawContent(content);
        setItems(list);
        // Always default to the latest release in preview
        setSelectedId(list[0]?.id || null);
        setIsEditorOpen(false);
      } catch (e) {
        if (cancelled) return;
        setLoadError('Falha ao carregar discografia do Firestore.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadCoversFromStorage({ force } = { force: false }) {
    if (!force && coverPickerImages.length > 0) return;

    setCoverPickerLoading(true);
    setCoverPickerError('');
    try {
      const root = storageRef(storage, 'discography/covers');
      const res = await listAll(root);

      const urls = await Promise.all(
        (res.items || []).map(async (item) => {
          const url = await getDownloadURL(item);
          return { path: item.fullPath, url };
        })
      );

      urls.sort((a, b) => a.path.localeCompare(b.path));
      setCoverPickerImages(urls);
    } catch {
      setCoverPickerError('Não foi possível listar as imagens do Storage.');
    } finally {
      setCoverPickerLoading(false);
    }
  }

  async function openCoverPicker() {
    setIsCoverPickerOpen(true);
    setGalleryTab('covers');
    await loadCoversFromStorage({ force: false });
  }

  function closeCoverPicker() {
    setIsCoverPickerOpen(false);
  }

  async function uploadCoverFiles(files) {
    const list = Array.from(files || []).filter(Boolean);
    if (list.length === 0) return;

    setCoverPickerLoading(true);
    setCoverPickerError('');
    try {
      const stamp = Date.now();
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i];
        const safeName = String(file.name || `cover-${i}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `discography/covers/${stamp}-${safeName}`;
        const r = storageRef(storage, path);
        await uploadBytes(r, file);
      }
      await loadCoversFromStorage({ force: true });
    } catch {
      setCoverPickerError('Falha ao enviar imagem para o Storage.');
    } finally {
      setCoverPickerLoading(false);
      // reset the file input so the same file can be selected again
      setGalleryUploadInputKey(k => k + 1);
    }
  }

  async function deleteCoverFromStorage(path) {
    const ok = window.confirm('Excluir esta imagem do Storage?');
    if (!ok) return;

    setCoverPickerLoading(true);
    setCoverPickerError('');
    try {
      const r = storageRef(storage, path);
      await deleteObject(r);
      await loadCoversFromStorage({ force: true });
    } catch {
      setCoverPickerError('Falha ao excluir imagem do Storage.');
    } finally {
      setCoverPickerLoading(false);
    }
  }

  function onGalleryDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length) uploadCoverFiles(files);
  }

  function onGalleryDragOver(e) {
    e.preventDefault();
  }

  function selectCoverFromStorage(url) {
    setForm(prev => ({
      ...prev,
      coverFile: null,
      coverPreviewUrl: url,
      coverUrl: url,
    }));
    setIsCoverPickerOpen(false);
  }

  function selectItem(id) {
    // Menu click should only change preview selection;
    // editing happens exclusively via the EDITAR button on preview.
    setSelectedId(id);
    setIsEditorOpen(false);
    setOpenPickerByTrackId({});
    setEditingTrackId(null);
  }

  function openEditorForSelected() {
    if (!selected) return;
    setOpenPickerByTrackId({});
    setEditingTrackId(null);
    setForm({
      ...DEFAULT_FORM,
      ...selected,
      coverFile: null,
      coverPreviewUrl: selected.coverUrl || '',
      tracks: (selected.tracks || []).map(t => ({
        id: t.id || uid(),
        name: t.name || '',
        youtubeUrl: t.youtubeUrl || '',
        lyrics: t.lyrics || '',
        startSec: Number(t.startSec ?? 0),
        endSec: Number(t.endSec ?? 15),
      })),
    });
    setIsEditorOpen(true);
  }

  function newItem() {
    setSelectedId(null);
    setForm(DEFAULT_FORM);
    setOpenPickerByTrackId({});
    setEditingTrackId(null);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setOpenPickerByTrackId({});
    setEditingTrackId(null);
  }

  function onChange(e) {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') {
      setForm(prev => ({ ...prev, [name]: checked }));
      return;
    }
    if (type === 'file') {
      const f = files?.[0] || null;
      setCoverFile(f);
      return;
    }
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function setCoverFile(file) {
    if (!file) {
      setForm(prev => ({ ...prev, coverFile: null, coverPreviewUrl: prev.coverPreviewUrl }));
      return;
    }
    const preview = URL.createObjectURL(file);
    setForm(prev => ({ ...prev, coverFile: file, coverPreviewUrl: preview }));
  }

  function onDropCover(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setCoverFile(file);
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  function startAddTrack() {
    setEditingTrackId('new');
  }

  function cancelTrackEdit() {
    setEditingTrackId(null);
  }

  function startEditTrack(id) {
    setEditingTrackId(id);
  }

  async function upsertLocal() {
    const payload = {
      ...form,
      coverFile: null,
      // Keep coverPreviewUrl out of persisted payload
      coverPreviewUrl: '',
      tracks: (form.tracks || []).map(t => ({
        id: t.id || uid(),
        name: (t.name || '').trim(),
        youtubeUrl: (t.youtubeUrl || '').trim(),
        lyrics: t.lyrics || '',
        startSec: Number(t.startSec ?? 0),
        endSec: Number(t.endSec ?? 0),
      })),
    };

    if (!payload.title.trim()) return;

    try {
      const ref = doc(db, 'siteData', 'moadb_discography');

      const nextId = selectedId ? String(selectedId) : String(Date.now());
      const next = { ...payload, id: nextId };
      const nextEntry = serializeReleaseToContent(next);

      const nextContent = (() => {
        const existing = Array.isArray(rawContent) ? rawContent : [];
        const idx = existing.findIndex(x => String(x?.id) === String(nextId));
        if (idx >= 0) {
          const copy = [...existing];
          copy[idx] = nextEntry;
          return copy;
        }
        return [nextEntry, ...existing];
      })();

      await setDoc(ref, { content: nextContent, updatedAt: serverTimestamp() }, { merge: true });

      setRawContent(nextContent);
      const list = nextContent.map(normalizeReleaseFromContent);
      list.sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')));
      setItems(list);
      setSelectedId(nextId);
    } catch {
      // keep silent for now (UI can be added later)
    }
  }

  async function persistTracksNow() {
    if (!isEditorOpen) return;
    if (!String(form.title || '').trim()) return;
    await upsertLocal();
  }

  function commitNewTrack() {
    const t = form._newTrack;
    if (!t) return;
    const name = String(t.name || '').trim();
    if (!name) return;

    const youtubeUrl = String(t.youtubeUrl || '').trim();
    const startSec = Number(t.startSec ?? 0);
    const endSec = Number(t.endSec ?? 15);

    setForm(prev => {
      const nextTrack = {
        id: uid(),
        name,
        youtubeUrl,
        lyrics: t.lyrics || '',
        startSec,
        endSec,
      };
      const { _newTrack, ...rest } = prev;
      return { ...rest, tracks: [...(prev.tracks || []), nextTrack] };
    });

    setEditingTrackId(null);

    setTimeout(() => {
      persistTracksNow();
    }, 0);
  }

  function commitEditTrack(id) {
    const t = form._editTrack;
    if (!t) return;
    const name = String(t.name || '').trim();
    if (!name) return;

    setForm(prev => {
      const patch = {
        name,
        youtubeUrl: String(t.youtubeUrl || '').trim(),
        lyrics: t.lyrics || '',
        startSec: Number(t.startSec ?? 0),
        endSec: Number(t.endSec ?? 15),
      };
      const nextTracks = (prev.tracks || []).map(x => (x.id === id ? { ...x, ...patch } : x));
      const { _editTrack, ...rest } = prev;
      return { ...rest, tracks: nextTracks };
    });

    setOpenPickerByTrackId(prev => ({ ...prev, [id]: false }));

    setEditingTrackId(null);

    setTimeout(() => {
      persistTracksNow();
    }, 0);
  }

  function beginNewTrackDraft() {
    setForm(prev => ({
      ...prev,
      _newTrack: { id: 'new', name: '', youtubeUrl: '', lyrics: '', startSec: 0, endSec: 15 },
    }));
    setOpenPickerByTrackId(prev => ({ ...prev, new: false }));
  }

  function beginEditTrackDraft(id) {
    const existing = (form.tracks || []).find(x => x.id === id);
    if (!existing) return;
    setForm(prev => ({
      ...prev,
      _editTrack: {
        id,
        name: existing.name || '',
        youtubeUrl: existing.youtubeUrl || '',
        lyrics: existing.lyrics || '',
        startSec: Number(existing.startSec ?? 0),
        endSec: Number(existing.endSec ?? 15),
      },
    }));
    setOpenPickerByTrackId(prev => ({ ...prev, [id]: false }));
  }

  function updateTrackDraft(kind, patch) {
    setForm(prev => {
      const key = kind === 'new' ? '_newTrack' : '_editTrack';
      const curr = prev[key] || { id: kind };
      return { ...prev, [key]: { ...curr, ...patch } };
    });
  }

  function removeTrack(id) {
    const ok = window.confirm('Excluir esta faixa?');
    if (!ok) return;

    setForm(prev => ({
      ...prev,
      tracks: (prev.tracks || []).filter(t => t.id !== id),
    }));
    setOpenPickerByTrackId(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (editingTrackId === id) setEditingTrackId(null);

    setTimeout(() => {
      persistTracksNow();
    }, 0);
  }

  function moveTrack(id, dir) {
    setForm(prev => {
      const tracks = prev.tracks || [];
      const idx = tracks.findIndex(t => t.id === id);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= tracks.length) return prev;
      const next = [...tracks];
      const temp = next[idx];
      next[idx] = next[nextIdx];
      next[nextIdx] = temp;
      return { ...prev, tracks: next };
    });

    setTimeout(() => {
      persistTracksNow();
    }, 0);
  }

  async function removeLocal() {
    if (!selectedId) return;
    const ok = window.confirm('Tem certeza que deseja EXCLUIR este lançamento? Esta ação não pode ser desfeita.');
    if (!ok) return;
    try {
      const ref = doc(db, 'siteData', 'moadb_discography');
      const existing = Array.isArray(rawContent) ? rawContent : [];
      const nextContent = existing.filter(x => String(x?.id) !== String(selectedId));
      await setDoc(ref, { content: nextContent, updatedAt: serverTimestamp() }, { merge: true });
      setRawContent(nextContent);
      const list = nextContent.map(normalizeReleaseFromContent);
      list.sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')));
      setItems(list);
    } catch {
      // ignore
    }
    setSelectedId(null);
    setForm(DEFAULT_FORM);
  }

  return (
    <section className="admin-section">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-h2">DISCOGRAFIA</h2>
          <div className="admin-subtitle">Gerencie lançamentos (single/EP/álbum), capa e links.</div>
          {isLoading ? <div className="admin-subtitle" style={{ marginTop: 6 }}>Carregando do Firestore…</div> : null}
          {loadError ? <div className="admin-subtitle" style={{ marginTop: 6, color: '#ffb3b3' }}>{loadError}</div> : null}
        </div>
        <div className="admin-section-actions">
          {!isEditorOpen ? (
            <button type="button" className="admin-btn" onClick={newItem}>+ NOVO LANÇAMENTO</button>
          ) : null}
          {isEditorOpen && (
            <>
              <button type="button" className="admin-btn admin-btn-primary" onClick={upsertLocal}>SALVAR</button>
              <button type="button" className="admin-btn admin-btn-danger" onClick={removeLocal} disabled={!selectedId}>EXCLUIR</button>
              <button type="button" className="admin-btn" onClick={closeEditor}>FECHAR</button>
            </>
          )}
        </div>
      </header>

      <div className="admin-grid">
        <aside className="admin-panel">
          <div className="admin-panel-title">LANÇAMENTOS</div>
          <div className="admin-list">
            {items.map(i => (
              <button
                key={i.id}
                type="button"
                className={`admin-list-item ${i.id === selectedId ? 'is-active' : ''}`}
                onClick={() => selectItem(i.id)}
              >
                <div className="admin-list-item-row">
                  <div className="admin-list-item-thumb">
                    {i.coverUrl ? <img src={i.coverUrl} alt="" /> : <div className="admin-list-item-thumb-empty" />}
                  </div>
                  <div className="admin-list-item-text">
                    <div className="admin-list-item-title">{i.title}</div>
                    <div className="admin-list-item-meta">
                      <span>{i.type.toUpperCase()}</span>
                      <span>•</span>
                      <span>{i.year || '—'}</span>
                      <span>•</span>
                      <span>{(i.tracks?.length || 0)} faixas</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="admin-panel">
          <div className="admin-panel-title">{isEditorOpen ? 'DETALHES' : 'PREVIEW'}</div>

          {!isEditorOpen ? (
            <div className="admin-form">
              {selected ? (
                <div className="admin-release-preview">
                  <div className="admin-release-preview-top">
                    <div className="admin-release-preview-cover">
                      {selected.coverUrl ? (
                        <img src={selected.coverUrl} alt={`Capa de ${selected.title}`} />
                      ) : (
                        <div className="admin-release-preview-cover-empty">SEM CAPA</div>
                      )}
                    </div>

                    <div className="admin-release-preview-meta">
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="admin-release-preview-title">{selected.title || '—'}</div>
                          <div className="admin-release-preview-sub">
                            <span>{String(selected.type || '').toUpperCase()}</span>
                            <span>•</span>
                            <span>{selected.year || '—'}</span>
                            <span>•</span>
                            <span>{(selected.tracks?.length || 0)} faixas</span>
                          </div>
                        </div>
                        <button type="button" className="admin-btn admin-btn-primary" onClick={openEditorForSelected}>EDITAR</button>
                      </div>

                      <div className="admin-release-preview-links">
                        {selected.spotifyUrl ? (
                          <a className="admin-linkchip" href={selected.spotifyUrl} target="_blank" rel="noreferrer">Spotify</a>
                        ) : null}
                        {selected.appleUrl ? (
                          <a className="admin-linkchip" href={selected.appleUrl} target="_blank" rel="noreferrer">Apple</a>
                        ) : null}
                        {selected.deezerUrl ? (
                          <a className="admin-linkchip" href={selected.deezerUrl} target="_blank" rel="noreferrer">Deezer</a>
                        ) : null}
                        {selected.youtubeMusicUrl ? (
                          <a className="admin-linkchip" href={selected.youtubeMusicUrl} target="_blank" rel="noreferrer">YouTube Music</a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="admin-divider" style={{ margin: '14px 0' }} />

                  <div className="admin-release-preview-tracks">
                    <div className="admin-panel-title" style={{ borderBottom: 0, padding: 0 }}>FAIXAS</div>

                    {(selected.tracks?.length || 0) === 0 ? (
                      <div className="admin-hint">Nenhuma faixa cadastrada.</div>
                    ) : (
                      <div className="admin-tracklist">
                        {(selected.tracks || []).map((t, idx) => (
                          <div key={t.id || idx} className="admin-tracklist-row">
                            <div className="admin-tracklist-idx">{idx + 1}</div>
                            <div className="admin-tracklist-name" title={t.name}>{t.name || '—'}</div>
                            <div className="admin-tracklist-meta">
                              {t.youtubeUrl ? <span className="admin-tag">YT</span> : <span className="admin-tag admin-tag-muted">sem YT</span>}
                              <span className="admin-tag">{Math.max(0, Number(t.startSec ?? 0))}s → {Math.max(0, Number(t.endSec ?? 0))}s</span>
                              {t.youtubeUrl ? (
                                <a className="admin-tag admin-tag-link" href={t.youtubeUrl} target="_blank" rel="noreferrer">abrir</a>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="admin-hint">
                  Selecione um lançamento na lista para editar ou clique em <b>+ NOVO LANÇAMENTO</b>.
                </div>
              )}
            </div>
          ) : (
            <div className="admin-form">
              {/* Linha 1: Título, Tipo, Ano */}
              <div className="admin-field-row admin-release-row-1">
                <label className="admin-field admin-release-title">
                  <span className="admin-label">Título</span>
                  <input
                    name="title"
                    value={form.title}
                    onChange={onChange}
                    placeholder="Ex: Silent Rebirth"
                    className="admin-input"
                  />
                </label>

                <label className="admin-field admin-release-type">
                  <span className="admin-label">Tipo</span>
                  <select name="type" value={form.type} onChange={onChange} className="admin-input">
                    <option value="single">Single</option>
                    <option value="ep">EP</option>
                    <option value="album">Álbum</option>
                  </select>
                </label>

                <label className="admin-field admin-release-year">
                  <span className="admin-label">Ano</span>
                  <input
                    name="year"
                    value={form.year}
                    onChange={onChange}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="2026"
                    className="admin-input"
                  />
                </label>
              </div>

              {/* Linha 2: capa 1:1 esquerda + links direita */}
              <div className="admin-release-row-2">
                <div className="admin-release-cover">
                  <div className="admin-label" style={{ marginBottom: 8 }}>Capa</div>
                  <div
                    className="admin-dropzone admin-dropzone-square"
                    role="button"
                    tabIndex={0}
                    onClick={openCoverPicker}
                    onDrop={onDropCover}
                    onDragOver={onDragOver}
                  >
                    {form.coverPreviewUrl ? (
                      <img className="admin-dropzone-square-img" src={form.coverPreviewUrl} alt="Prévia da capa" />
                    ) : (
                      <div className="admin-dropzone-placeholder">
                        <div className="admin-dropzone-title">CLIQUE</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="admin-release-links">
                  <div className="admin-field-row">
                    <label className="admin-field">
                      <span className="admin-label">Spotify</span>
                      <input name="spotifyUrl" value={form.spotifyUrl} onChange={onChange} placeholder="https://open.spotify.com/..." className="admin-input" />
                    </label>
                    <label className="admin-field">
                      <span className="admin-label">Apple Music</span>
                      <input name="appleUrl" value={form.appleUrl} onChange={onChange} placeholder="https://music.apple.com/..." className="admin-input" />
                    </label>
                  </div>

                  <div className="admin-field-row">
                    <label className="admin-field">
                      <span className="admin-label">Deezer</span>
                      <input name="deezerUrl" value={form.deezerUrl} onChange={onChange} placeholder="https://www.deezer.com/..." className="admin-input" />
                    </label>
                    <label className="admin-field">
                      <span className="admin-label">YouTube Music</span>
                      <input name="youtubeMusicUrl" value={form.youtubeMusicUrl} onChange={onChange} placeholder="https://music.youtube.com/..." className="admin-input" />
                    </label>
                  </div>

                  {/* + ADICIONAR FAIXA (bottom-right of this section) */}
                  <div className="admin-release-links-actions">
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => {
                        startAddTrack();
                        beginNewTrackDraft();
                      }}
                    >
                      + ADICIONAR FAIXA
                    </button>
                  </div>
                </div>
              </div>

              {isCoverPickerOpen ? (
                <div
                  className="admin-modal-backdrop"
                  role="dialog"
                  aria-modal="true"
                  onDrop={onGalleryDrop}
                  onDragOver={onGalleryDragOver}
                >
                  <div className="admin-modal">
                    <div className="admin-modal-header">
                      <div>
                        <div className="admin-panel-title" style={{ borderBottom: 0, padding: 0 }}>GALERIA</div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button type="button" className="admin-btn" onClick={closeCoverPicker}>FECHAR</button>
                      </div>
                    </div>

                    <div className="admin-gallery-tabs admin-tabs-wrap">
                      <div className="admin-tabs" style={{ padding: '8px 0' }}>
                        <button
                          type="button"
                          className={`admin-tab ${galleryTab === 'covers' ? 'is-active' : ''}`}
                          onClick={() => setGalleryTab('covers')}
                        >
                          COVERS
                        </button>
                      </div>
                    </div>

                    {coverPickerLoading ? (
                      <div className="admin-hint">Carregando…</div>
                    ) : null}
                    {coverPickerError ? (
                      <div className="admin-hint" style={{ color: '#ffb3b3' }}>{coverPickerError}</div>
                    ) : null}

                    {galleryTab === 'covers' ? (
                      <div className="admin-cover-grid">
                        <label
                          className={`admin-cover-tile admin-cover-tile-upload ${coverPickerLoading ? 'is-loading' : ''}`}
                          title="Enviar imagens"
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const files = e.dataTransfer?.files;
                            if (files && files.length) uploadCoverFiles(files);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <input
                            key={galleryUploadInputKey}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={e => uploadCoverFiles(e.target.files)}
                            style={{ display: 'none' }}
                          />
                          <div className="admin-cover-upload-inner">
                            <div className="admin-cover-upload-plus">+</div>
                            <div className="admin-cover-upload-text">ENVIAR</div>
                          </div>
                        </label>

                        {coverPickerImages.length === 0 ? (
                          <div className="admin-hint">Nenhuma imagem encontrada em <b>discography/covers</b>.</div>
                        ) : (
                          coverPickerImages.map(img => (
                            <button
                              key={img.path}
                              type="button"
                              className="admin-cover-tile"
                              onClick={() => selectCoverFromStorage(img.url)}
                              title={img.path}
                            >
                              <img src={img.url} alt={img.path} />
                              <button
                                type="button"
                                className="admin-cover-tile-delete"
                                title="Excluir"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deleteCoverFromStorage(img.path);
                                }}
                              >
                                ×
                              </button>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="admin-divider" style={{ margin: '18px 0' }} />

              {((form.tracks?.length || 0) > 0 || editingTrackId) ? (
                <div className="admin-tracks-header" style={{ marginBottom: 10 }}>
                  <div>
                    <div className="admin-panel-title" style={{ borderBottom: 0, padding: 0 }}>FAIXAS</div>
                    <div className="admin-subtitle" style={{ marginTop: 6 }}>
                      Clique em uma faixa para editar. Use ↑/↓ para reordenar.
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="admin-tracks">
                {/* Empty state only when nothing and not adding/editing */}
                {(form.tracks?.length || 0) === 0 && !editingTrackId ? (
                  <div className="admin-hint">Nenhuma faixa adicionada ainda.</div>
                ) : null}

                {/* New track editor */}
                {editingTrackId === 'new' && form._newTrack ? (
                  <div className="admin-track">
                    <div className="admin-track-top">
                      <div className="admin-track-index">+</div>
                      <input
                        className="admin-input"
                        placeholder="Nome da música"
                        value={form._newTrack.name}
                        onChange={e => updateTrackDraft('new', { name: e.target.value })}
                      />
                      <div className="admin-track-actions">
                        <button type="button" className="admin-track-btn" onClick={commitNewTrack} title="Gravar">
                          GRAVAR
                        </button>
                        <button
                          type="button"
                          className="admin-track-btn admin-track-btn-danger"
                          onClick={() => {
                            setForm(prev => {
                              const { _newTrack, ...rest } = prev;
                              return rest;
                            });
                            setOpenPickerByTrackId(prev => {
                              const next = { ...prev };
                              delete next.new;
                              return next;
                            });
                            cancelTrackEdit();
                          }}
                          title="Cancelar"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    <label className="admin-field" style={{ marginBottom: 10 }}>
                      <span className="admin-label">YouTube</span>
                      <div className="admin-inline" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                          className="admin-input"
                          placeholder="https://youtube.com/..."
                          value={form._newTrack.youtubeUrl}
                          onChange={e => {
                            updateTrackDraft('new', { youtubeUrl: e.target.value });
                            setOpenPickerByTrackId(prev => ({ ...prev, new: false }));
                          }}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => setOpenPickerByTrackId(prev => ({ ...prev, new: true }))}
                          disabled={!String(form._newTrack.youtubeUrl || '').trim()}
                          title="Abrir preview e selecionar trecho"
                        >
                          PREVIEW
                        </button>
                      </div>
                    </label>

                    {openPickerByTrackId.new ? (
                      <YouTubeSegmentPicker
                        value={{
                          youtubeUrl: form._newTrack.youtubeUrl,
                          startSec: form._newTrack.startSec,
                          endSec: form._newTrack.endSec,
                        }}
                        onChange={next => updateTrackDraft('new', { startSec: next.startSec, endSec: next.endSec })}
                      />
                    ) : null}

                    <label className="admin-field" style={{ marginTop: 12 }}>
                      <span className="admin-label">Letra</span>
                      <textarea
                        className="admin-input admin-textarea"
                        rows={6}
                        value={form._newTrack.lyrics}
                        onChange={e => updateTrackDraft('new', { lyrics: e.target.value })}
                        placeholder="Cole a letra aqui..."
                      />
                    </label>
                  </div>
                ) : null}

                {/* Existing tracks as collapsed rows or editor */}
                {(form.tracks || []).map((t, idx) => {
                  const isEditing = editingTrackId === t.id;
                  const draft = isEditing ? form._editTrack : null;

                  if (!isEditing) {
                    return (
                      <div key={t.id} className="admin-track admin-track-collapsed">
                        <div className="admin-track-top">
                          <div className="admin-track-index">{idx + 1}</div>
                          <div
                            className="admin-track-collapsed-name"
                            style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={t.name}
                          >
                            {t.name || '—'}
                          </div>
                          <div className="admin-track-actions">
                            <button
                              type="button"
                              className="admin-track-btn"
                              onClick={() => {
                                startEditTrack(t.id);
                                beginEditTrackDraft(t.id);
                              }}
                            >
                              EDITAR
                            </button>
                            <button type="button" className="admin-track-btn" onClick={() => moveTrack(t.id, -1)} disabled={idx === 0}>↑</button>
                            <button type="button" className="admin-track-btn" onClick={() => moveTrack(t.id, 1)} disabled={idx === form.tracks.length - 1}>↓</button>
                            <button type="button" className="admin-track-btn admin-track-btn-danger" onClick={() => removeTrack(t.id)}>×</button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={t.id} className="admin-track">
                      <div className="admin-track-top">
                        <div className="admin-track-index">{idx + 1}</div>
                        <input
                          className="admin-input"
                          placeholder="Nome da música"
                          value={draft?.name || ''}
                          onChange={e => updateTrackDraft('edit', { name: e.target.value })}
                        />
                        <div className="admin-track-actions">
                          <button type="button" className="admin-track-btn" onClick={() => commitEditTrack(t.id)} title="Gravar">GRAVAR</button>
                          <button type="button" className="admin-track-btn" onClick={() => { cancelTrackEdit(); }} title="Fechar">FECHAR</button>
                        </div>
                      </div>

                      <label className="admin-field" style={{ marginBottom: 10 }}>
                        <span className="admin-label">YouTube</span>
                        <div className="admin-inline" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input
                            className="admin-input"
                            placeholder="https://youtube.com/..."
                            value={draft?.youtubeUrl || ''}
                            onChange={e => {
                              updateTrackDraft('edit', { youtubeUrl: e.target.value });
                              setOpenPickerByTrackId(prev => ({ ...prev, [t.id]: false }));
                            }}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className="admin-btn"
                            onClick={() => setOpenPickerByTrackId(prev => ({ ...prev, [t.id]: true }))}
                            disabled={!String(draft?.youtubeUrl || '').trim()}
                            title="Abrir preview e selecionar trecho"
                          >
                            PREVIEW
                          </button>
                        </div>
                      </label>

                      {openPickerByTrackId[t.id] ? (
                        <YouTubeSegmentPicker
                          value={{
                            youtubeUrl: draft?.youtubeUrl || '',
                            startSec: Number(draft?.startSec ?? 0),
                            endSec: Number(draft?.endSec ?? 15),
                          }}
                          onChange={next => updateTrackDraft('edit', { startSec: next.startSec, endSec: next.endSec })}
                        />
                      ) : null}

                      <label className="admin-field" style={{ marginTop: 12 }}>
                        <span className="admin-label">Letra</span>
                        <textarea
                          className="admin-input admin-textarea"
                          rows={6}
                          value={draft?.lyrics || ''}
                          onChange={e => updateTrackDraft('edit', { lyrics: e.target.value })}
                          placeholder="Cole a letra aqui..."
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
