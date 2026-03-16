import { useEffect, useMemo, useState } from 'react';
import { deleteObject, getDownloadURL, listAll, ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

export default function ImageGalleryModal({
  title = 'GALERIA',
  tabs = [{ key: 'images', label: 'IMAGENS', folder: 'images' }],
  initialTabKey,
  onSelect,
  onClose,
}) {
  const initialKey = useMemo(() => {
    if (initialTabKey && tabs.some((t) => t.key === initialTabKey)) return initialTabKey;
    return tabs[0]?.key || 'images';
  }, [initialTabKey, tabs]);

  const [activeTab, setActiveTab] = useState(initialKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imagesByTab, setImagesByTab] = useState({}); // { [key]: [{path,url}] }
  const [uploadInputKey, setUploadInputKey] = useState(0);

  const tab = useMemo(() => tabs.find((t) => t.key === activeTab) || tabs[0], [activeTab, tabs]);

  async function loadTab(key) {
    const t = tabs.find((x) => x.key === key);
    if (!t) return;

    setLoading(true);
    setError('');
    try {
      const root = storageRef(storage, t.folder);
      const res = await listAll(root);
      const urls = await Promise.all(
        (res.items || []).map(async (item) => {
          const url = await getDownloadURL(item);
          return { path: item.fullPath, url };
        })
      );
      urls.sort((a, b) => a.path.localeCompare(b.path));
      setImagesByTab((prev) => ({ ...prev, [key]: urls }));
    } catch {
      setError('Não foi possível listar as imagens do Storage.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setActiveTab(initialKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  useEffect(() => {
    if (!imagesByTab[activeTab]) loadTab(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function uploadFiles(files) {
    const list = Array.from(files || []).filter(Boolean);
    if (!tab || list.length === 0) return;

    setLoading(true);
    setError('');
    try {
      const stamp = Date.now();
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i];
        const safeName = String(file.name || `image-${i}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${tab.folder}/${stamp}-${safeName}`;
        await uploadBytes(storageRef(storage, path), file);
      }
      await loadTab(activeTab);
    } catch {
      setError('Falha ao enviar imagem para o Storage.');
    } finally {
      setLoading(false);
      setUploadInputKey((k) => k + 1);
    }
  }

  async function deleteImage(path) {
    const ok = window.confirm('Excluir esta imagem do Storage?');
    if (!ok) return;

    setLoading(true);
    setError('');
    try {
      await deleteObject(storageRef(storage, path));
      await loadTab(activeTab);
    } catch {
      setError('Falha ao excluir imagem do Storage.');
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length) uploadFiles(files);
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  const images = imagesByTab[activeTab] || [];

  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
      <div className="admin-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-panel-title">{title}</div>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} aria-label="Fechar">
            FECHAR
          </button>
        </div>

        <div className="admin-gallery-tabs">
          <nav className="admin-tabs" aria-label="Pastas da galeria">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`admin-tab ${activeTab === t.key ? 'is-active' : ''}`}
                type="button"
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {error ? <div className="admin-error">{error}</div> : null}

        <div className="admin-cover-grid" onDrop={onDrop} onDragOver={onDragOver}>
          <label className={`admin-cover-tile admin-cover-tile-upload ${loading ? 'is-loading' : ''}`} title="Enviar imagens">
            <input
              key={uploadInputKey}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => uploadFiles(e.target.files)}
              style={{ display: 'none' }}
              disabled={loading}
            />
            <div className="admin-cover-upload-inner">
              <div className="admin-cover-upload-plus">+</div>
              <div className="admin-cover-upload-text">ENVIAR</div>
            </div>
          </label>

          {images.map((img) => (
            <div key={img.path} className="admin-cover-tile" title="Selecionar">
              <button type="button" className="admin-cover-tile-btn" onClick={() => onSelect?.(img.url)} aria-label="Selecionar imagem">
                <img src={img.url} alt="" />
              </button>
              <button
                type="button"
                className="admin-cover-tile-delete"
                title="Excluir"
                onClick={() => deleteImage(img.path)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {!loading && images.length === 0 ? <div className="admin-muted" style={{ marginTop: 10 }}>Sem imagens nesta pasta.</div> : null}
      </div>
    </div>
  );
}
