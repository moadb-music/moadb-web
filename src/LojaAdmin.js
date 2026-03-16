import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { db, storage } from './firebase';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Firestore schema (per print): siteData/moadb_shop { content: { items: [...] , storeUrl? } }
const DOC_PATH = { collection: 'siteData', docId: 'moadb_shop' };

function normalizeShopFromDb(data) {
  const d = data || {};
  const content = d.content && typeof d.content === 'object' ? d.content : {};
  const rawItems = Array.isArray(content.items) ? content.items : [];

  return {
    storeUrl: String(content.storeUrl || content.url || d.storeUrl || d.url || ''),
    items: rawItems.map((it) => ({
      id: String(it?.id || uid()),
      name: String(it?.title || it?.name || ''),
      productUrl: String(it?.url || it?.productUrl || it?.href || it?.link || ''),
      imageUrl: String(it?.imageUrl || it?.image || ''),
      bgColor: String(it?.bgColor || ''),
    })),
  };
}

function serializeShopToDb(shop) {
  const s = shop || {};
  return {
    content: {
      storeUrl: String(s.storeUrl || '').trim(),
      items: Array.isArray(s.items)
        ? s.items.map((it) => ({
            id: String(it.id || uid()),
            title: String(it.name || '').trim(),
            url: String(it.productUrl || '').trim(),
            imageUrl: String(it.imageUrl || '').trim(),
            bgColor: String(it.bgColor || '#070707'),
          }))
        : [],
    },
  };
}

export default function LojaAdmin() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [storeUrl, setStoreUrl] = useState('');
  const [items, setItems] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) || null,
    [items, selectedId]
  );

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', productUrl: '', imageUrl: '', bgColor: '#070707' });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDraftUrl, setSettingsDraftUrl] = useState('');

  // Gallery modal state
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState('loja');
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [galleryUploadInputKey, setGalleryUploadInputKey] = useState(0);

  const [galleryImages, setGalleryImages] = useState({
    covers: [],
    loja: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError('');
      try {
        const ref = doc(db, DOC_PATH.collection, DOC_PATH.docId);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};
        const normalized = normalizeShopFromDb(data);
        if (cancelled) return;

        setStoreUrl(normalized.storeUrl);
        setItems(normalized.items);
        setSelectedId(normalized.items[0]?.id || null);
        setIsEditorOpen(false);
      } catch {
        if (!cancelled) setLoadError('Falha ao carregar dados da loja do Firestore.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    setForm({
      id: selected.id,
      name: selected.name || '',
      productUrl: selected.productUrl || '',
      imageUrl: selected.imageUrl || '',
      bgColor: selected.bgColor || '#070707',
    });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persist(nextItems, nextStoreUrl) {
    const payload = serializeShopToDb({
      storeUrl: nextStoreUrl,
      items: nextItems,
    });

    const ref = doc(db, DOC_PATH.collection, DOC_PATH.docId);
    await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  }

  function openSettings() {
    setSettingsDraftUrl(storeUrl);
    setIsSettingsOpen(true);
  }

  function closeSettings() {
    setIsSettingsOpen(false);
  }

  async function saveSettings() {
    const nextUrl = String(settingsDraftUrl || '').trim();
    setStoreUrl(nextUrl);
    setIsSettingsOpen(false);
    try {
      await persist(items, nextUrl);
    } catch {
      window.alert('Falha ao salvar link geral.');
    }
  }

  function selectItemOnly(id) {
    setSelectedId(id);
  }

  function openEditorForSelected() {
    if (!selected) return;
    setIsEditorOpen(true);
    setForm({
      id: selected.id,
      name: selected.name || '',
      productUrl: selected.productUrl || '',
      imageUrl: selected.imageUrl || '',
      bgColor: selected.bgColor || '#070707',
    });
  }

  function closeEditor() {
    setIsEditorOpen(false);
    if (!selected) return;
    setForm({
      id: selected.id,
      name: selected.name || '',
      productUrl: selected.productUrl || '',
      imageUrl: selected.imageUrl || '',
      bgColor: selected.bgColor || '#070707',
    });
  }

  async function saveItem() {
    const next = items.map((it) => (it.id === form.id ? { ...it, ...form } : it));
    setItems(next);
    setIsEditorOpen(false);
    try {
      await persist(next, storeUrl);
    } catch {
      window.alert('Falha ao salvar item.');
    }
  }

  async function addItem() {
    const id = uid();
    const next = [
      {
        id,
        name: 'NOVO ITEM',
        productUrl: '',
        imageUrl: '',
        bgColor: '#070707',
      },
      ...items,
    ];
    setItems(next);
    setSelectedId(id);
    setIsEditorOpen(true);
    setForm({ id, name: 'NOVO ITEM', productUrl: '', imageUrl: '', bgColor: '#070707' });

    try {
      await persist(next, storeUrl);
    } catch {
      // ignore
    }
  }

  async function deleteItemNow(id) {
    const ok = window.confirm('Excluir este item da loja?');
    if (!ok) return;

    const next = items.filter((it) => it.id !== id);
    setItems(next);
    setSelectedId(next[0]?.id || null);
    setIsEditorOpen(false);

    try {
      await persist(next, storeUrl);
    } catch {
      window.alert('Falha ao excluir.');
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    await deleteItemNow(selected.id);
  }

  async function listImagesForTab(tab) {
    setGalleryLoading(true);
    setGalleryError('');
    try {
      const rootPath = tab === 'covers' ? 'discography/covers' : 'loja/images';
      const root = storageRef(storage, rootPath);
      const res = await listAll(root);
      const urls = await Promise.all(
        (res.items || []).map(async (item) => {
          const url = await getDownloadURL(item);
          return { path: item.fullPath, url };
        })
      );
      urls.sort((a, b) => a.path.localeCompare(b.path));
      setGalleryImages((prev) => ({ ...prev, [tab]: urls }));
    } catch {
      setGalleryError('Não foi possível listar as imagens do Storage.');
    } finally {
      setGalleryLoading(false);
    }
  }

  async function openGallery() {
    setIsGalleryOpen(true);
    setGalleryTab('loja');
    await listImagesForTab('loja');
  }

  function closeGallery() {
    setIsGalleryOpen(false);
  }

  async function uploadGalleryFiles(tab, files) {
    const list = Array.from(files || []).filter(Boolean);
    if (list.length === 0) return;

    setGalleryLoading(true);
    setGalleryError('');
    try {
      const stamp = Date.now();
      const basePath = tab === 'covers' ? 'discography/covers' : 'loja/images';
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i];
        const safeName = String(file.name || `image-${i}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${basePath}/${stamp}-${safeName}`;
        await uploadBytes(storageRef(storage, path), file);
      }
      await listImagesForTab(tab);
    } catch {
      setGalleryError('Falha ao enviar imagem para o Storage.');
    } finally {
      setGalleryLoading(false);
      setGalleryUploadInputKey((k) => k + 1);
    }
  }

  async function deleteGalleryImage(path) {
    const ok = window.confirm('Excluir esta imagem do Storage?');
    if (!ok) return;

    setGalleryLoading(true);
    setGalleryError('');
    try {
      await deleteObject(storageRef(storage, path));
      await listImagesForTab(galleryTab);
    } catch {
      setGalleryError('Falha ao excluir imagem do Storage.');
    } finally {
      setGalleryLoading(false);
    }
  }

  function onGalleryDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length) uploadGalleryFiles(galleryTab, files);
  }

  function onGalleryDragOver(e) {
    e.preventDefault();
  }

  function selectImageUrl(url) {
    setForm((prev) => ({ ...prev, imageUrl: url }));
    setIsGalleryOpen(false);
  }

  if (isLoading) {
    return (
      <section className="admin-section">
        <header className="admin-section-header">
          <div>
            <h2 className="admin-h2">LOJA</h2>
            <div className="admin-subtitle">Carregando…</div>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="admin-section" aria-label="Admin Loja">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-h2">LOJA</h2>
          <div className="admin-subtitle">Gerencie os itens e o link geral.</div>
          {loadError ? (
            <div className="admin-subtitle" style={{ marginTop: 6, color: '#ffb3b3' }}>{loadError}</div>
          ) : null}
        </div>

        <div className="admin-section-actions">
          <button type="button" className="admin-btn admin-icon-btn" onClick={openSettings} title="Configurações">
            ⚙
          </button>

          {!isEditorOpen ? (
            <button type="button" className="admin-btn" onClick={addItem}>+ NOVO ITEM</button>
          ) : null}
          {isEditorOpen ? (
            <>
              <button type="button" className="admin-btn admin-btn-primary" onClick={saveItem}>SALVAR</button>
              <button type="button" className="admin-btn admin-btn-danger" onClick={deleteSelected} disabled={!selected}>EXCLUIR</button>
              <button type="button" className="admin-btn" onClick={closeEditor}>FECHAR</button>
            </>
          ) : null}
        </div>
      </header>

      <div className="admin-grid">
        <aside className="admin-panel">
          <div className="admin-panel-title">ITENS</div>
          <div className="admin-list">
            {items.length === 0 ? (
              <div className="admin-form">
                <div className="admin-hint">Nenhum item cadastrado. Clique em <b>+ NOVO ITEM</b>.</div>
              </div>
            ) : (
              items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`admin-list-item ${selectedId === it.id ? 'is-active' : ''}`}
                  onClick={() => selectItemOnly(it.id)}
                >
                  <div className="admin-list-item-row">
                    <div className="admin-list-item-thumb">
                      {it.imageUrl ? <img src={it.imageUrl} alt="" /> : <div className="admin-list-item-thumb-empty" />}
                    </div>
                    <div className="admin-list-item-text">
                      <div className="admin-list-item-title">{it.name || 'Sem nome'}</div>
                      <div className="admin-list-item-meta">
                        <span>{it.productUrl ? 'com link' : 'sem link'}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="admin-panel">
          <div className="admin-panel-title">{isEditorOpen ? 'DETALHES' : 'PREVIEW'}</div>

          {!isEditorOpen ? (
            <div className="admin-form">
              {selected ? (
                <div className="admin-store-preview">
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="admin-store-preview-title">{selected.name || '—'}</div>
                    </div>
                    <button type="button" className="admin-btn admin-btn-primary" onClick={openEditorForSelected}>EDITAR</button>
                  </div>

                  <div className="admin-divider" style={{ margin: '14px 0' }} />

                  <div className="admin-store-preview-grid">
                    <div className="admin-store-preview-image" style={{ background: selected.bgColor || 'rgba(255, 255, 255, 0.04)' }}>
                      {selected.imageUrl ? <img src={selected.imageUrl} alt="" /> : <div className="admin-thumb-empty">SEM IMAGEM</div>}
                    </div>
                    <div className="admin-store-preview-meta">
                      {selected.productUrl ? (
                        <a className="admin-linkchip" href={selected.productUrl} target="_blank" rel="noreferrer">
                          ABRIR PRODUTO
                        </a>
                      ) : (
                        <div className="admin-hint">Sem link de produto.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="admin-hint">Selecione um item na lista para visualizar.</div>
              )}
            </div>
          ) : (
            <div className="admin-form">
              <div className="admin-field-row">
                <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="admin-label">Nome</span>
                  <input
                    className="admin-input"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>
              </div>

              <div className="admin-field-row">
                <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="admin-label">Link do produto</span>
                  <input
                    className="admin-input"
                    value={form.productUrl}
                    onChange={(e) => setForm((p) => ({ ...p, productUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </label>
              </div>

              <div className="admin-field-row" style={{ gridTemplateColumns: '220px 1fr' }}>
                <div>
                  <div className="admin-label" style={{ marginBottom: 8 }}>Imagem</div>
                  <div
                    className="admin-dropzone admin-dropzone-square"
                    role="button"
                    tabIndex={0}
                    onClick={openGallery}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = e.dataTransfer?.files;
                      if (files && files.length) {
                        setIsGalleryOpen(true);
                        setGalleryTab('loja');
                        uploadGalleryFiles('loja', files);
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {form.imageUrl ? (
                      <img className="admin-dropzone-square-img" src={form.imageUrl} alt="Prévia da imagem" />
                    ) : (
                      <div className="admin-dropzone-placeholder">
                        <div className="admin-dropzone-title">CLIQUE</div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="admin-field" style={{ marginBottom: 12 }}>
                    <span className="admin-label">Cor de fundo</span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={form.bgColor || '#070707'}
                        onChange={(e) => setForm((p) => ({ ...p, bgColor: e.target.value }))}
                        style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
                        aria-label="Selecionar cor de fundo"
                      />
                      <input
                        className="admin-input"
                        value={form.bgColor || ''}
                        onChange={(e) => setForm((p) => ({ ...p, bgColor: e.target.value }))}
                        placeholder="#070707"
                      />
                    </div>
                  </label>

                  {/* Removido: URL da imagem e botão remover imagem (edita pela galeria) */}
                </div>
              </div>
            </div>
          )}

          {isSettingsOpen ? (
            <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
              <div className="admin-modal" style={{ width: 'min(760px, 96vw)' }}>
                <div className="admin-modal-header">
                  <div>
                    <div className="admin-panel-title" style={{ borderBottom: 0, padding: 0 }}>CONFIGURAÇÕES</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button type="button" className="admin-btn" onClick={closeSettings}>FECHAR</button>
                  </div>
                </div>

                <div className="admin-form" style={{ padding: 0 }}>
                  <label className="admin-field" style={{ marginTop: 10 }}>
                    <span className="admin-label">Link geral da loja</span>
                    <input
                      className="admin-input"
                      value={settingsDraftUrl}
                      onChange={(e) => setSettingsDraftUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </label>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="admin-btn" onClick={closeSettings}>CANCELAR</button>
                    <button type="button" className="admin-btn admin-btn-primary" onClick={saveSettings}>SALVAR</button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isGalleryOpen ? (
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
                    <button type="button" className="admin-btn" onClick={closeGallery}>FECHAR</button>
                  </div>
                </div>

                <div className="admin-gallery-tabs admin-tabs-wrap">
                  <div className="admin-tabs" style={{ padding: '8px 0' }}>
                    <button
                      type="button"
                      className={`admin-tab ${galleryTab === 'covers' ? 'is-active' : ''}`}
                      onClick={async () => {
                        setGalleryTab('covers');
                        await listImagesForTab('covers');
                      }}
                    >
                      COVERS
                    </button>
                    <button
                      type="button"
                      className={`admin-tab ${galleryTab === 'loja' ? 'is-active' : ''}`}
                      onClick={async () => {
                        setGalleryTab('loja');
                        await listImagesForTab('loja');
                      }}
                    >
                      LOJA
                    </button>
                  </div>
                </div>

                {galleryLoading ? <div className="admin-hint">Carregando…</div> : null}
                {galleryError ? (
                  <div className="admin-hint" style={{ color: '#ffb3b3' }}>{galleryError}</div>
                ) : null}

                <div className="admin-cover-grid">
                  <label
                    className={`admin-cover-tile admin-cover-tile-upload ${galleryLoading ? 'is-loading' : ''}`}
                    title="Enviar imagens"
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const files = e.dataTransfer?.files;
                      if (files && files.length) uploadGalleryFiles(galleryTab, files);
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
                      onChange={(e) => uploadGalleryFiles(galleryTab, e.target.files)}
                      style={{ display: 'none' }}
                    />
                    <div className="admin-cover-upload-inner">
                      <div className="admin-cover-upload-plus">+</div>
                      <div className="admin-cover-upload-text">ENVIAR</div>
                    </div>
                  </label>

                  {(galleryImages[galleryTab] || []).length === 0 ? (
                    <div className="admin-hint">
                      Nenhuma imagem encontrada em{' '}
                      <b>{galleryTab === 'covers' ? 'discography/covers' : 'loja/images'}</b>.
                    </div>
                  ) : (
                    (galleryImages[galleryTab] || []).map((img) => (
                      <button
                        key={img.path}
                        type="button"
                        className="admin-cover-tile"
                        onClick={() => selectImageUrl(img.url)}
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
                            deleteGalleryImage(img.path);
                          }}
                        >
                          ×
                        </button>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
