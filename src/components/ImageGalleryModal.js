import { useEffect, useMemo, useState } from 'react';
import { deleteObject, getDownloadURL, listAll, ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

export default function ImageGalleryModal({
  title = 'GALERIA',
  tabs = [{ key: 'images', label: 'IMAGENS', folder: 'images' }],
  initialTabKey,
  allFolder,
  onSelect,
  onClose,
}) {
  const ALL_KEY = 'all';

  const preparedTabs = useMemo(() => {
    const clean = (tabs || []).filter(Boolean);
    const hasAll = clean.some((t) => t.key === ALL_KEY);
    // adiciona a aba TODOS automaticamente se houver mais de uma pasta
    if (!hasAll && clean.length > 1) {
      return [{ key: ALL_KEY, label: 'TODOS' }, ...clean];
    }
    return clean;
  }, [tabs]);

  const initialKey = useMemo(() => {
    if (initialTabKey && preparedTabs.some((t) => t.key === initialTabKey)) return initialTabKey;
    return preparedTabs[0]?.key || ALL_KEY;
  }, [initialTabKey, preparedTabs]);

  const [activeTab, setActiveTab] = useState(initialKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imagesByTab, setImagesByTab] = useState({}); // { [key]: [{path,url}] }
  const [uploadInputKey, setUploadInputKey] = useState(0);

  const tab = useMemo(() => preparedTabs.find((t) => t.key === activeTab) || preparedTabs[0], [activeTab, preparedTabs]);

  async function loadFolder(folder) {
    const root = storageRef(storage, folder);
    const res = await listAll(root);
    const urls = await Promise.all(
      (res.items || []).map(async (item) => {
        const url = await getDownloadURL(item);
        return { path: item.fullPath, url };
      })
    );
    return urls;
  }

  async function loadTab(key) {
    if (key === ALL_KEY) {
      setLoading(true);
      setError('');
      try {
        // Se allFolder foi definido, a aba TODOS lista apenas essa pasta.
        if (typeof allFolder === 'string' && allFolder.trim()) {
          const urls = await loadFolder(allFolder.trim());
          urls.sort((a, b) => a.path.localeCompare(b.path));
          setImagesByTab((prev) => ({ ...prev, [ALL_KEY]: urls }));
          return;
        }

        // fallback: merge de todas as pastas das tabs
        const folderTabs = preparedTabs.filter((t) => t.key !== ALL_KEY && t.folder);
        const allLists = await Promise.all(folderTabs.map((t) => loadFolder(t.folder)));
        const merged = allLists.flat();
        merged.sort((a, b) => a.path.localeCompare(b.path));
        setImagesByTab((prev) => ({ ...prev, [ALL_KEY]: merged }));
      } catch {
        setError('Não foi possível listar as imagens do Storage.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const t = preparedTabs.find((x) => x.key === key);
    if (!t?.folder) return;

    setLoading(true);
    setError('');
    try {
      const urls = await loadFolder(t.folder);
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

    // se estiver em TODOS, sobe arquivos na primeira pasta real
    const effective = tab.key === ALL_KEY ? preparedTabs.find((t) => t.key !== ALL_KEY && t.folder) : tab;
    if (!effective?.folder) return;

    setLoading(true);
    setError('');
    try {
      const stamp = Date.now();
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i];
        const safeName = String(file.name || `image-${i}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${effective.folder}/${stamp}-${safeName}`;
        await uploadBytes(storageRef(storage, path), file);
      }
      // recarrega aba atual e também TODOS, se existir
      await loadTab(activeTab);
      if (preparedTabs.some((t) => t.key === ALL_KEY) && activeTab !== ALL_KEY) {
        // invalida cache para refletir o upload em TODOS quando o usuário alternar
        setImagesByTab((prev) => {
          const next = { ...prev };
          delete next[ALL_KEY];
          return next;
        });
      }
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
      // limpa cache de todas as tabs, pois não sabemos de qual pasta veio
      setImagesByTab({});
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
            {preparedTabs.map((t) => (
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

        {!loading && images.length === 0 ? (
          <div className="admin-muted" style={{ marginTop: 10 }}>
            Sem imagens nesta pasta.
          </div>
        ) : null}
      </div>
    </div>
  );
}
