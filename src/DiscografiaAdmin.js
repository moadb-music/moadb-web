import { useMemo, useRef, useState } from 'react';
import YouTubeSegmentPicker from './YouTubeSegmentPicker';

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

export default function DiscografiaAdmin() {
  const [items, setItems] = useState(() => {
    return [
      {
        id: 'demo-1',
        type: 'single',
        title: 'Demo Single',
        year: '2026',
        coverUrl: '',
        spotifyUrl: '',
        appleUrl: '',
        deezerUrl: '',
        youtubeMusicUrl: '',
        tracks: [
          { id: 't1', name: 'Demo Track', youtubeUrl: '', lyrics: '', startSec: 0, endSec: 15 },
        ],
      },
    ];
  });

  const [selectedId, setSelectedId] = useState(items[0]?.id || null);
  const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId]);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [openPickerByTrackId, setOpenPickerByTrackId] = useState(() => ({}));

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

  const fileInputRef = useRef(null);

  function selectItem(id) {
    setSelectedId(id);
    const next = items.find(i => i.id === id);
    if (!next) return;
    setOpenPickerByTrackId({});
    setForm({
      ...DEFAULT_FORM,
      ...next,
      coverFile: null,
      coverPreviewUrl: next.coverUrl || '',
      tracks: (next.tracks || []).map(t => ({
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
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setOpenPickerByTrackId({});
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

  function addTrack() {
    setForm(prev => ({
      ...prev,
      tracks: [...prev.tracks, { id: uid(), name: '', youtubeUrl: '', lyrics: '', startSec: 0, endSec: 15 }],
    }));
  }

  function updateTrack(id, patch) {
    setForm(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  function removeTrack(id) {
    setForm(prev => ({
      ...prev,
      tracks: prev.tracks.filter(t => t.id !== id),
    }));
    setOpenPickerByTrackId(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function moveTrack(id, dir) {
    setForm(prev => {
      const idx = prev.tracks.findIndex(t => t.id === id);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.tracks.length) return prev;
      const next = [...prev.tracks];
      const temp = next[idx];
      next[idx] = next[nextIdx];
      next[nextIdx] = temp;
      return { ...prev, tracks: next };
    });
  }

  function upsertLocal() {
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

    if (!selectedId) {
      const newId = `local-${Date.now()}`;
      setItems(prev => [{ id: newId, ...payload }, ...prev]);
      setSelectedId(newId);
      return;
    }

    setItems(prev => prev.map(i => (i.id === selectedId ? { ...i, ...payload } : i)));
  }

  function removeLocal() {
    if (!selectedId) return;
    setItems(prev => prev.filter(i => i.id !== selectedId));
    setSelectedId(null);
    setForm(DEFAULT_FORM);
  }

  return (
    <section className="admin-section">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-h2">DISCOGRAFIA</h2>
          <div className="admin-subtitle">Gerencie lançamentos (single/EP/álbum), capa e links.</div>
        </div>
        <div className="admin-section-actions">
          <button type="button" className="admin-btn" onClick={newItem}>+ NOVO LANÇAMENTO</button>
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
                <div className="admin-list-item-title">{i.title}</div>
                <div className="admin-list-item-meta">
                  <span>{i.type.toUpperCase()}</span>
                  <span>•</span>
                  <span>{i.year || '—'}</span>
                  <span>•</span>
                  <span>{(i.tracks?.length || 0)} faixas</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="admin-panel">
          <div className="admin-panel-title">{isEditorOpen ? 'DETALHES' : 'PREVIEW'}</div>

          {!isEditorOpen ? (
            <div className="admin-form">
              <div className="admin-hint">
                Selecione um lançamento na lista para editar ou clique em <b>+ NOVO LANÇAMENTO</b>.
              </div>
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
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={onDropCover}
                    onDragOver={onDragOver}
                  >
                    {form.coverPreviewUrl ? (
                      <img className="admin-dropzone-square-img" src={form.coverPreviewUrl} alt="Prévia da capa" />
                    ) : (
                      <div className="admin-dropzone-placeholder">
                        <div className="admin-dropzone-title">Solte aqui</div>
                        <div className="admin-dropzone-sub">ou clique</div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    name="coverFile"
                    onChange={onChange}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
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
                </div>
              </div>

              <div className="admin-divider" style={{ margin: '18px 0' }} />

              <div className="admin-tracks-header">
                <div>
                  <div className="admin-panel-title" style={{ borderBottom: 0, padding: 0 }}>FAIXAS</div>
                  <div className="admin-subtitle" style={{ marginTop: 6 }}>Nome, link do YouTube e letra. Você pode reordenar.</div>
                </div>
                <button type="button" className="admin-btn" onClick={addTrack}>+ ADICIONAR FAIXA</button>
              </div>

              <div className="admin-tracks">
                {form.tracks.length === 0 ? (
                  <div className="admin-hint">Nenhuma faixa adicionada ainda.</div>
                ) : (
                  form.tracks.map((t, idx) => (
                    <div key={t.id} className="admin-track">
                      <div className="admin-track-top">
                        <div className="admin-track-index">{idx + 1}</div>
                        <input
                          className="admin-input"
                          placeholder="Nome da música"
                          value={t.name}
                          onChange={e => updateTrack(t.id, { name: e.target.value })}
                        />
                        <div className="admin-track-actions">
                          <button type="button" className="admin-track-btn" onClick={() => moveTrack(t.id, -1)} disabled={idx === 0}>↑</button>
                          <button type="button" className="admin-track-btn" onClick={() => moveTrack(t.id, 1)} disabled={idx === form.tracks.length - 1}>↓</button>
                          <button type="button" className="admin-track-btn admin-track-btn-danger" onClick={() => removeTrack(t.id)}>×</button>
                        </div>
                      </div>

                      <label className="admin-field" style={{ marginBottom: 10 }}>
                        <span className="admin-label">YouTube</span>
                        <div className="admin-inline" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input
                            className="admin-input"
                            placeholder="https://youtube.com/..."
                            value={t.youtubeUrl}
                            onChange={e => {
                              updateTrack(t.id, { youtubeUrl: e.target.value });
                              // If the URL changes, force user to re-open preview (lazy-load picker)
                              setOpenPickerByTrackId(prev => ({ ...prev, [t.id]: false }));
                            }}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className="admin-btn"
                            onClick={() => setOpenPickerByTrackId(prev => ({ ...prev, [t.id]: true }))}
                            disabled={!String(t.youtubeUrl || '').trim()}
                            title="Abrir preview e selecionar trecho"
                          >
                            PREVIEW
                          </button>
                        </div>
                      </label>

                      {openPickerByTrackId[t.id] ? (
                        <YouTubeSegmentPicker
                          value={{
                            youtubeUrl: t.youtubeUrl,
                            startSec: t.startSec,
                            endSec: t.endSec,
                          }}
                          onChange={next => updateTrack(t.id, { startSec: next.startSec, endSec: next.endSec })}
                        />
                      ) : null}

                      <label className="admin-field" style={{ marginTop: 12 }}>
                        <span className="admin-label">Letra</span>
                        <textarea
                          className="admin-input admin-textarea"
                          rows={6}
                          value={t.lyrics}
                          onChange={e => updateTrack(t.id, { lyrics: e.target.value })}
                          placeholder="Cole a letra aqui..."
                        />
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
