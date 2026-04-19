import { useEffect, useMemo, useRef, useState } from 'react';
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

const DOC_PATH = { collection: 'siteData', docId: 'moadb_shop' };

const PRINT_SIDE_OPTIONS = ['Frente', 'Costas', 'Frente e Costas'];
const PRINT_TYPE_OPTIONS = ['DTG', 'DTF'];

// Categoria → subcategorias
const CATEGORIAS = {
  'Acessórios': [
    'bone_snap',
    'chapeu_bucket',
    'chinelo_nuvem',
    'copo_termico',
    'gorro_lenhador',
    'touca_pompom',
  ],
  'Calças e Shorts': [
    'calca_legging',
    'short_praia',
  ],
  'Camisetas': [
    'camiseta_babylook',
    'camiseta_heavy_oversized',
    'camiseta_infantil',
    'camiseta_long',
    'camiseta_oversized',
    'camiseta_oversized_ps',
    'camiseta_pima',
    'camiseta_super_oversized',
    'camiseta_tradicional_premium',
    'camiseta_tradicional_ps',
    'camiseta_tradicional_regular',
    'camiseta_tubular',
  ],
  'Regatas': [
    'cropped_street',
    'regata_machao',
    'regata_tradicional',
  ],
  'Moletons': [
    'moletom_bermuda',
    'moletom_calca',
    'moletom_canguru_2_cabos',
    'moletom_canguru_3_cabos',
    'moletom_careca',
    'moletom_cropped',
  ],
  'Óculos': [
    'oculos_acqua_polo',
    'oculos_boss',
    'oculos_esportivo',
    'oculos_hollywood',
    'oculos_ibiza_vintage',
    'oculos_kalifa',
    'oculos_madri',
    'oculos_medusa',
    'oculos_milionaire',
    'oculos_stripes',
  ],
};
const CATEGORIA_KEYS = Object.keys(CATEGORIAS);

// formata subcategoria: troca _ por espaço e capitaliza cada palavra
function formatSubcat(s) {
  return String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeShopFromDb(data) {
  const d = data || {};
  const content = d.content && typeof d.content === 'object' ? d.content : {};
  const rawItems = Array.isArray(content.items) ? content.items : [];
  return {
    storeUrl: String(content.storeUrl || content.url || d.storeUrl || d.url || ''),
    items: rawItems.map((it) => ({
      id: String(it?.id || uid()),
      name: String(it?.title || it?.name || ''),
      descricao: String(it?.descricao || it?.description || ''),
      productUrl: String(it?.url || it?.productUrl || it?.href || it?.link || ''),
      // legado: imageUrl vira images[0]
      images: Array.isArray(it?.images) && it.images.length
        ? it.images.map(String)
        : (it?.imageUrl ? [String(it.imageUrl)] : []),
      bgColor: String(it?.bgColor || ''),
      categoria: String(it?.categoria || ''),
      subcategoria: String(it?.subcategoria || ''),
      cor: String(it?.cor || ''),
      printSide: String(it?.printSide || ''),
      printType: String(it?.printType || ''),
      printSize: String(it?.printSize || ''),
      printSizes: {
        frente: String(it?.printSizes?.frente || ''),
        costas: String(it?.printSizes?.costas || ''),
        ladoD:  String(it?.printSizes?.ladoD  || ''),
        ladoE:  String(it?.printSizes?.ladoE  || ''),
      },
      destaque: it?.destaque === true,
      edicaoEspecial: it?.edicaoEspecial === true,
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
            descricao: String(it.descricao || '').trim(),
            // mantém imageUrl = primeira imagem para compatibilidade com App.js
            imageUrl: Array.isArray(it.images) && it.images[0] ? String(it.images[0]) : '',
            images: Array.isArray(it.images) ? it.images.map(String).filter(Boolean) : [],
            bgColor: String(it.bgColor || '#070707'),
            categoria: String(it.categoria || '').trim(),
            subcategoria: String(it.subcategoria || '').trim(),
            cor: String(it.cor || '').trim(),
            printSide: String(it.printSide || '').trim(),
            printType: String(it.printType || '').trim(),
            printSize: String(it.printSize || '').trim(),
            printSizes: {
              frente: String(it.printSizes?.frente || '').trim(),
              costas: String(it.printSizes?.costas || '').trim(),
              ladoD:  String(it.printSizes?.ladoD  || '').trim(),
              ladoE:  String(it.printSizes?.ladoE  || '').trim(),
            },
            destaque: it.destaque === true,
            edicaoEspecial: it.edicaoEspecial === true,
          }))
        : [],
    },
  };
}

const EMPTY_FORM = {
  id: '', name: '', descricao: '', productUrl: '', images: [], bgColor: '#070707',
  categoria: '', subcategoria: '', cor: '', printSide: '', printType: '', printSize: '',
  printSizes: { frente: '', costas: '', ladoD: '', ladoE: '' },
  destaque: false, edicaoEspecial: false,
};

// ─── histórico de valores por campo (localStorage) ───────────────────────────

const HISTORY_KEY = 'loja_admin_field_history';
const HISTORY_MAX = 12;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); } catch { return {}; }
}

function saveHistory(field, value) {
  const v = String(value || '').trim();
  if (!v) return;
  const h = loadHistory();
  const list = [v, ...(h[field] || []).filter((x) => x !== v)].slice(0, HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify({ ...h, [field]: list }));
}

function useFieldHistory(field) {
  const [suggestions, setSuggestions] = useState(() => loadHistory()[field] || []);
  function record(value) {
    saveHistory(field, value);
    setSuggestions(loadHistory()[field] || []);
  }
  return [suggestions, record];
}

// ─── input com datalist de sugestões ─────────────────────────────────────────

function SuggestInput({ id, field, value, onChange, onBlur, placeholder, style, className }) {
  const listId = `suggest-${field}`;
  const [suggestions] = useState(() => loadHistory()[field] || []);
  return (
    <>
      <input
        id={id}
        list={listId}
        className={className || 'admin-input'}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        style={style}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </>
  );
}

// ─── slot de imagem com upload direto e drag & drop de arquivo ───────────────

const SLOT_LABELS = ['Frente', 'Costas', 'Lado D', 'Lado E'];

function LojaImgSlot({ slot, url, bgColor, imagesCount, isUploading, dragSlot, onDragStart, onDragOver, onDrop, onDragEnd, onUpload, onRemove }) {
  const [fileDragOver, setFileDragOver] = useState(false);
  const isReorderDrag = dragSlot !== null && dragSlot !== slot;
  const label = SLOT_LABELS[slot];
  const disabled = imagesCount < slot;

  function handleFileDragOver(e) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(true);
  }
  function handleFileDragLeave(e) {
    e.preventDefault();
    setFileDragOver(false);
  }
  function handleFileDrop(e) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) onUpload(slot, file);
  }

  const slotClass = [
    'loja-img-slot',
    isReorderDrag && url ? 'drag-over' : '',
    fileDragOver ? 'file-drag-over' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={slotClass}
      draggable={!!url && !isUploading}
      onDragStart={() => onDragStart(slot)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) handleFileDragOver(e);
        else onDragOver(e, slot);
      }}
      onDragLeave={handleFileDragLeave}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes('Files')) handleFileDrop(e);
        else onDrop(slot);
      }}
      onDragEnd={() => { onDragEnd(); setFileDragOver(false); }}
    >
      {isUploading ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: '.6rem', letterSpacing: 2, opacity: .5 }}>ENVIANDO…</span>
        </div>
      ) : url ? (
        <>
          <label
            className="loja-img-slot-filled"
            style={{ background: bgColor || '#111', cursor: 'pointer' }}
            title="Clique para trocar ou arraste uma imagem"
          >
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.[0]) onUpload(slot, e.target.files[0]); e.target.value = ''; }}
            />
            <img src={url} alt={label} />
          </label>
          <button
            type="button"
            className="loja-img-slot-remove"
            onClick={(e) => { e.stopPropagation(); onRemove(slot); }}
            title="Remover"
            aria-label="Remover imagem"
          >×</button>
        </>
      ) : (
        <label
          className="loja-img-slot-empty"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .25 : 1 }}
          title={`${label} — clique ou arraste`}
        >
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            disabled={disabled}
            onChange={(e) => { if (e.target.files?.[0]) onUpload(slot, e.target.files[0]); e.target.value = ''; }}
          />
          <span className="loja-img-slot-plus">{fileDragOver ? '↓' : '+'}</span>
          <span className="loja-img-slot-label">{fileDragOver ? 'SOLTAR' : label}</span>
        </label>
      )}
    </div>
  );
}

export default function LojaAdmin() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [items, setItems] = useState([]);

  // Editor modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formDirty, setFormDirty] = useState(false);

  // wrapper para setForm que marca dirty
  function updateForm(updater) {
    setForm(updater);
    setFormDirty(true);
  }

  function tryCloseEditor() {
    if (formDirty) {
      if (!window.confirm('Há alterações não salvas. Deseja sair sem salvar?')) return;
    }
    setEditorOpen(false);
    setFormDirty(false);
  }

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraftUrl, setSettingsDraftUrl] = useState('');
  const [settingsDraftBgColor, setSettingsDraftBgColor] = useState('#070707');

  const [dragSlot, setDragSlot] = useState(null);

  // ── drag & drop de reordenação de itens ───────────────────────────────────
  const [rowDragId, setRowDragId] = useState(null);   // id do item sendo arrastado
  const [rowDragOver, setRowDragOver] = useState(null); // id do item sob o cursor
  const rowDragCounter = useRef(0); // evita flickering do dragover

  function onRowDragStart(e, id) {
    setRowDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    // ghost transparente para não mostrar a imagem padrão do browser
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }

  function onRowDragEnter(e, id) {
    e.preventDefault();
    rowDragCounter.current += 1;
    if (id !== rowDragId) setRowDragOver(id);
  }

  function onRowDragLeave(id) {
    rowDragCounter.current -= 1;
    if (rowDragCounter.current <= 0) {
      rowDragCounter.current = 0;
      if (rowDragOver === id) setRowDragOver(null);
    }
  }

  function onRowDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function onRowDrop(e, targetId) {
    e.preventDefault();
    rowDragCounter.current = 0;
    setRowDragOver(null);
    setRowDragId(null);
    if (!rowDragId || rowDragId === targetId) return;
    const from = items.findIndex((i) => i.id === rowDragId);
    const to   = items.findIndex((i) => i.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    try { await persist(next, storeUrl); } catch { /* silent */ }
  }

  function onRowDragEnd() {
    rowDragCounter.current = 0;
    setRowDragId(null);
    setRowDragOver(null);
  }

  // ── drag & drop de reordenação de grupos (subcategorias) ─────────────────
  const [groupDragKey, setGroupDragKey] = useState(null);
  const [groupDragOver, setGroupDragOver] = useState(null);
  const groupDragCounter = useRef(0);

  function onGroupDragStart(e, key) {
    // só ativa se o drag veio do handle do grupo (não de um row filho)
    setGroupDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  }

  function onGroupDragEnter(e, key) {
    e.preventDefault();
    e.stopPropagation();
    groupDragCounter.current += 1;
    if (key !== groupDragKey) setGroupDragOver(key);
  }

  function onGroupDragLeave(e, key) {
    e.stopPropagation();
    groupDragCounter.current -= 1;
    if (groupDragCounter.current <= 0) {
      groupDragCounter.current = 0;
      if (groupDragOver === key) setGroupDragOver(null);
    }
  }

  function onGroupDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  }

  async function onGroupDrop(e, targetKey, groups) {
    e.preventDefault();
    e.stopPropagation();
    groupDragCounter.current = 0;
    setGroupDragOver(null);
    setGroupDragKey(null);
    if (!groupDragKey || groupDragKey === targetKey) return;

    // reordena os itens: move todos os itens do grupo arrastado para antes do grupo alvo
    const fromItems = groups.find((g) => g.key === groupDragKey)?.items || [];
    const toItems   = groups.find((g) => g.key === targetKey)?.items || [];
    if (!fromItems.length) return;

    const fromIds = new Set(fromItems.map((i) => i.id));
    const toFirstId = toItems[0]?.id;

    const rest = items.filter((i) => !fromIds.has(i.id));
    const insertAt = toFirstId ? rest.findIndex((i) => i.id === toFirstId) : rest.length;
    const next = [
      ...rest.slice(0, insertAt),
      ...fromItems,
      ...rest.slice(insertAt),
    ];
    setItems(next);
    try { await persist(next, storeUrl); } catch { /* silent */ }
  }

  function onGroupDragEnd() {
    groupDragCounter.current = 0;
    setGroupDragKey(null);
    setGroupDragOver(null);
  }

  // Gallery modal
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [gallerySlot, setGallerySlot] = useState(null); // índice 0-3 do slot de imagem
  const [galleryTab, setGalleryTab] = useState('loja');
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [galleryUploadKey, setGalleryUploadKey] = useState(0);
  const [galleryImages, setGalleryImages] = useState({ covers: [], loja: [] });

  // ── load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError('');
      try {
        const snap = await getDoc(doc(db, DOC_PATH.collection, DOC_PATH.docId));
        const normalized = normalizeShopFromDb(snap.exists() ? snap.data() : {});
        if (cancelled) return;
        setStoreUrl(normalized.storeUrl);
        setItems(normalized.items);
      } catch {
        if (!cancelled) setLoadError('Falha ao carregar dados da loja.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── persist ───────────────────────────────────────────────────────────────
  async function persist(nextItems, nextStoreUrl) {
    const payload = serializeShopToDb({ storeUrl: nextStoreUrl, items: nextItems });
    await setDoc(
      doc(db, DOC_PATH.collection, DOC_PATH.docId),
      { ...payload, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

  // ── item actions ──────────────────────────────────────────────────────────
  function openNewItem() {
    const id = uid();
    setForm({ ...EMPTY_FORM, id });
    setFormDirty(false);
    setEditorOpen(true);
  }

  function openEditItem(it) {
    setForm({
      id: it.id,
      name: it.name,
      descricao: it.descricao || '',
      productUrl: it.productUrl,
      images: Array.isArray(it.images) ? [...it.images] : [],
      bgColor: it.bgColor || '#070707',
      categoria: it.categoria || '',
      subcategoria: it.subcategoria || '',
      cor: it.cor || '',
      printSide: it.printSide || '',
      printType: it.printType || '',
      printSize: it.printSize || '',
      printSizes: {
        frente: it.printSizes?.frente || '',
        costas: it.printSizes?.costas || '',
        ladoD:  it.printSizes?.ladoD  || '',
        ladoE:  it.printSizes?.ladoE  || '',
      },
      destaque: it.destaque || false,
      edicaoEspecial: it.edicaoEspecial || false,
    });
    setFormDirty(false);
    setEditorOpen(true);
  }

  async function saveItem() {
    const isNew = !items.find((i) => i.id === form.id);
    let next;
    if (isNew) {
      // insere logo após o último item da mesma subcategoria,
      // ou no final da lista se a subcategoria for nova
      const sub = form.subcategoria || '';
      const lastIdx = sub
        ? items.reduce((acc, it, idx) => (it.subcategoria === sub ? idx : acc), -1)
        : -1;
      if (lastIdx >= 0) {
        next = [...items.slice(0, lastIdx + 1), { ...form }, ...items.slice(lastIdx + 1)];
      } else {
        next = [...items, { ...form }];
      }
    } else {
      next = items.map((it) => (it.id === form.id ? { ...it, ...form } : it));
    }
    setItems(next);
    setFormDirty(false);
    setEditorOpen(false);
    try { await persist(next, storeUrl); } catch { window.alert('Falha ao salvar item.'); }
  }

  function cloneItem(it) {
    setForm({
      id: uid(),
      name: it.name,
      descricao: it.descricao || '',
      productUrl: '',
      images: Array.isArray(it.images) ? [...it.images] : [],
      bgColor: it.bgColor || '#070707',
      categoria: it.categoria || '',
      subcategoria: it.subcategoria || '',
      cor: it.cor || '',
      printSide: it.printSide || '',
      printType: it.printType || '',
      printSize: it.printSize || '',
      printSizes: {
        frente: it.printSizes?.frente || '',
        costas: it.printSizes?.costas || '',
        ladoD:  it.printSizes?.ladoD  || '',
        ladoE:  it.printSizes?.ladoE  || '',
      },
      destaque: false,
      edicaoEspecial: it.edicaoEspecial || false,
    });
    setFormDirty(true);
    setEditorOpen(true);
  }

  async function deleteItem(id) {
    if (!window.confirm('Excluir este item da loja?')) return;
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    try { await persist(next, storeUrl); } catch { window.alert('Falha ao excluir.'); }
  }

  async function toggleDestaque(id) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const destaqueCount = items.filter((i) => i.destaque).length;
    // se vai marcar e já tem 6, avisa
    if (!item.destaque && destaqueCount >= 6) {
      window.alert('Máximo de 6 itens em destaque. Remova um antes de adicionar outro.');
      return;
    }
    const next = items.map((i) => i.id === id ? { ...i, destaque: !i.destaque } : i);
    setItems(next);
    try { await persist(next, storeUrl); } catch { /* silent */ }
  }

  async function moveItem(id, dir) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setItems(next);
    try { await persist(next, storeUrl); } catch { /* silent */ }
  }

  // ── settings ──────────────────────────────────────────────────────────────
  function openSettings() { setSettingsDraftUrl(storeUrl); setSettingsDraftBgColor('#070707'); setSettingsOpen(true); }
  async function saveSettings() {
    const next = String(settingsDraftUrl || '').trim();
    setStoreUrl(next);
    setSettingsOpen(false);
    try { await persist(items, next); } catch { window.alert('Falha ao salvar configurações.'); }
  }

  async function applyGlobalBgColor() {
    const color = settingsDraftBgColor || '#070707';
    if (!window.confirm(`Aplicar a cor "${color}" como fundo de todos os ${items.length} produtos?`)) return;
    const next = items.map((it) => ({ ...it, bgColor: color }));
    setItems(next);
    try { await persist(next, storeUrl); window.alert('Cor de fundo aplicada a todos os produtos.'); } catch { window.alert('Falha ao salvar.'); }
  }

  // ── gallery ───────────────────────────────────────────────────────────────
  async function listImagesForTab(tab) {
    setGalleryLoading(true);
    setGalleryError('');
    try {
      const rootPath = tab === 'covers' ? 'discography/covers' : 'loja/images';
      const res = await listAll(storageRef(storage, rootPath));
      const urls = await Promise.all(
        res.items.map(async (item) => ({ path: item.fullPath, url: await getDownloadURL(item) }))
      );
      urls.sort((a, b) => a.path.localeCompare(b.path));
      setGalleryImages((prev) => ({ ...prev, [tab]: urls }));
    } catch {
      setGalleryError('Não foi possível listar as imagens.');
    } finally {
      setGalleryLoading(false);
    }
  }

  async function openGallery() {
    setGalleryOpen(true);
    setGalleryTab('loja');
    await listImagesForTab('loja');
  }

  async function openGalleryForSlot(slotIdx) {
    setGallerySlot(slotIdx);
    setGalleryOpen(true);
    setGalleryTab('loja');
    await listImagesForTab('loja');
  }

  // upload direto de arquivo para um slot específico
  const [slotUploading, setSlotUploading] = useState({});

  async function uploadFileToSlot(slotIdx, file) {
    if (!file) return;
    setSlotUploading((p) => ({ ...p, [slotIdx]: true }));
    try {
      const stamp = Date.now();
      const safe = String(file.name || `img`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `loja/images/${stamp}-${safe}`;
      await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(storageRef(storage, path));
      setForm((p) => {
        const imgs = [...(p.images || [])];
        imgs[slotIdx] = url;
        return { ...p, images: imgs.slice(0, 4) };
      });
      setFormDirty(true);
    } catch {
      window.alert('Falha ao enviar imagem.');
    } finally {
      setSlotUploading((p) => ({ ...p, [slotIdx]: false }));
    }
  }

  async function uploadGalleryFiles(tab, files) {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setGalleryLoading(true);
    setGalleryError('');
    try {
      const stamp = Date.now();
      const base = tab === 'covers' ? 'discography/covers' : 'loja/images';
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        const safe = String(f.name || `img-${i}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        await uploadBytes(storageRef(storage, `${base}/${stamp}-${safe}`), f);
      }
      await listImagesForTab(tab);
    } catch {
      setGalleryError('Falha ao enviar imagem.');
    } finally {
      setGalleryLoading(false);
      setGalleryUploadKey((k) => k + 1);
    }
  }

  async function deleteGalleryImage(path) {
    if (!window.confirm('Excluir esta imagem do Storage?')) return;
    setGalleryLoading(true);
    try {
      await deleteObject(storageRef(storage, path));
      await listImagesForTab(galleryTab);
    } catch {
      setGalleryError('Falha ao excluir imagem.');
    } finally {
      setGalleryLoading(false);
    }
  }

  function selectImageUrl(url) {
    setForm((p) => {
      const imgs = [...(p.images || [])];
      const slot = gallerySlot ?? imgs.length;
      imgs[slot] = url;
      return { ...p, images: imgs.slice(0, 4) };
    });
    setGalleryOpen(false);
    setGallerySlot(null);
  }

  function removeImage(idx) {
    setForm((p) => {
      const imgs = [...(p.images || [])];
      imgs.splice(idx, 1);
      return { ...p, images: imgs };
    });
  }

  function moveImage(idx, dir) {
    setForm((p) => {
      const imgs = [...(p.images || [])];
      const swap = idx + dir;
      if (swap < 0 || swap >= imgs.length) return p;
      [imgs[idx], imgs[swap]] = [imgs[swap], imgs[idx]];
      return { ...p, images: imgs };
    });
  }

  // ── gerar nome automático ─────────────────────────────────────────────────
  function gerarNome() {
    const f = form;
    const partes = [];

    if (f.name) partes.push(f.name);

    // estampa: mapeia para FrontPrint / Backprint / etc.
    const printSideMap = {
      'Frente':          'FrontPrint',
      'Costas':          'BackPrint',
      'Frente e Costas': 'Front & BackPrint',
    };
    const printLabel = printSideMap[f.printSide] || f.printSide;

    // subcategoria formatada (sem categoria)
    const subLabel = f.subcategoria ? formatSubcat(f.subcategoria) : '';

    // monta segmento central: "FrontPrint (Tradicional Regular)" ou só "FrontPrint"
    if (printLabel && subLabel) {
      partes.push(`${printLabel} (${subLabel})`);
    } else if (printLabel) {
      partes.push(printLabel);
    } else if (subLabel) {
      partes.push(`(${subLabel})`);
    }

    if (f.printType) partes.push(f.printType);

    const nome = partes.join(' - ');
    updateForm((p) => ({ ...p, name: nome }));
  }

  // ── gerar descrição automática ────────────────────────────────────────────
  function gerarDescricao() {
    const f = form;
    const linhas = [];

    // parágrafo de abertura — sem especificações (já estão no card de impressão)
    const modelo = f.subcategoria ? formatSubcat(f.subcategoria) : (f.categoria || '');
    const cor = f.cor || '';

    if (f.name && modelo && cor) {
      linhas.push(`${f.name} na cor ${cor}. ${modelo} com acabamento de qualidade e estampa exclusiva da banda.`);
    } else if (f.name && modelo) {
      linhas.push(`${f.name}. ${modelo} com acabamento de qualidade e estampa exclusiva da banda.`);
    } else if (f.name) {
      linhas.push(`${f.name}. Peça exclusiva com estampa da banda.`);
    }

    updateForm((p) => ({ ...p, descricao: linhas.join('\n') }));
  }

  function onDragStart(slot) {
    setDragSlot(slot);
  }

  function onDragOver(e, slot) {
    e.preventDefault();
    // visual feedback via CSS class é feito no JSX
  }

  function onDrop(slot) {
    if (dragSlot === null || dragSlot === slot) { setDragSlot(null); return; }
    setForm((p) => {
      const imgs = [...(p.images || [])];
      // só permite trocar slots preenchidos
      if (!imgs[dragSlot]) { setDragSlot(null); return p; }
      const tmp = imgs[slot] || '';
      imgs[slot] = imgs[dragSlot];
      imgs[dragSlot] = tmp;
      return { ...p, images: imgs };
    });
    setDragSlot(null);
  }

  // ── render ────────────────────────────────────────────────────────────────
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

      {/* ── page header ── */}
      <header className="admin-section-header">
        <div>
          <h2 className="admin-h2">LOJA</h2>
          <div className="admin-subtitle">
            {items.length} {items.length === 1 ? 'produto' : 'produtos'} cadastrados
            {storeUrl ? <> · <a className="admin-linkchip" href={storeUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }}>loja externa ↗</a></> : null}
          </div>
          {loadError ? <div className="admin-subtitle" style={{ color: '#ffb3b3', marginTop: 4 }}>{loadError}</div> : null}
        </div>
        <div className="admin-section-actions">
          <button type="button" className="admin-btn admin-icon-btn" onClick={openSettings} title="Configurações">⚙</button>
          <button type="button" className="admin-btn admin-btn-primary" onClick={openNewItem}>+ NOVO PRODUTO</button>
        </div>
      </header>

      {/* ── product list ── */}
      <div className="loja-admin-list">
        {items.length === 0 ? (
          <div className="admin-hint" style={{ padding: '32px 0', textAlign: 'center' }}>
            Nenhum produto cadastrado. Clique em <b>+ NOVO PRODUTO</b> para começar.
          </div>
        ) : (() => {
          // agrupa por subcategoria (mantendo ordem de aparição)
          const groups = [];
          const seen = new Map(); // subcategoria → índice no groups

          for (const it of items) {
            const key = it.subcategoria || '__sem_subcat__';
            if (!seen.has(key)) {
              seen.set(key, groups.length);
              groups.push({ key, label: it.subcategoria ? formatSubcat(it.subcategoria) : 'Sem subcategoria', cat: it.categoria || '', items: [] });
            }
            groups[seen.get(key)].items.push(it);
          }

          return groups.map(({ key, label, cat, items: groupItems }) => (
            <div
              key={key}
              className={`loja-admin-group${groupDragOver === key ? ' is-group-drag-over' : ''}${groupDragKey === key ? ' is-group-dragging' : ''}`}
              onDragEnter={(e) => onGroupDragEnter(e, key)}
              onDragLeave={(e) => onGroupDragLeave(e, key)}
              onDragOver={onGroupDragOver}
              onDrop={(e) => onGroupDrop(e, key, groups)}
            >
              <div className="loja-admin-group-header">
                {/* handle de drag do grupo */}
                <div
                  className="loja-admin-group-drag-handle"
                  draggable
                  onDragStart={(e) => onGroupDragStart(e, key)}
                  onDragEnd={onGroupDragEnd}
                  title="Arrastar para reordenar grupo"
                  aria-hidden="true"
                >
                  ⠿
                </div>
                {cat && <span className="loja-admin-group-cat">{cat}</span>}
                <span className="loja-admin-group-label">{label}</span>
                <span className="loja-admin-group-count">{groupItems.length}</span>
              </div>
              {groupItems.map((it) => {
                const idx = items.indexOf(it);
                const isDragging = rowDragId === it.id;
                const isOver    = rowDragOver === it.id;
                return (
                  <div
                    key={it.id}
                    className={`loja-admin-row${isDragging ? ' is-dragging' : ''}${isOver ? ' is-drag-over' : ''}`}
                    draggable
                    onDragStart={(e) => onRowDragStart(e, it.id)}
                    onDragEnter={(e) => onRowDragEnter(e, it.id)}
                    onDragLeave={() => onRowDragLeave(it.id)}
                    onDragOver={onRowDragOver}
                    onDrop={(e) => onRowDrop(e, it.id)}
                    onDragEnd={onRowDragEnd}
                  >
                    {/* handle de drag */}
                    <div className="loja-admin-drag-handle" aria-hidden="true" title="Arrastar para reordenar">
                      ⠿
                    </div>

                    {/* thumbnail */}
                    <div className="loja-admin-thumb" style={{ background: it.bgColor || '#111' }}>
                      {(it.images && it.images[0])
                        ? <img src={it.images[0]} alt="" />
                        : <span className="loja-admin-thumb-empty">IMG</span>
                      }
                    </div>

                    {/* info */}
                    <div className="loja-admin-info">
                      <div className="loja-admin-name">{it.name || <span style={{ opacity: .4 }}>Sem nome</span>}</div>
                      <div className="loja-admin-meta">
                        {it.productUrl
                          ? <a className="admin-tag admin-tag-link" href={it.productUrl} target="_blank" rel="noreferrer">link ↗</a>
                          : <span className="admin-tag admin-tag-muted">sem link</span>
                        }
                        {it.cor ? <span className="admin-tag">{it.cor}</span> : null}
                        {it.printSide ? <span className="admin-tag">{it.printSide}</span> : null}
                        {it.printType ? <span className="admin-tag" style={{ background: 'rgba(139,0,0,.25)', color: '#ffb3b3' }}>{it.printType}</span> : null}
                        {it.edicaoEspecial ? <span className="admin-tag" style={{ background: 'rgba(229,201,126,.18)', color: '#e5c97e', border: '1px solid rgba(229,201,126,.35)' }}>✦ Ed. Especial</span> : null}
                        {it.bgColor
                          ? <span className="loja-admin-color-dot" style={{ background: it.bgColor }} title={it.bgColor} />
                          : null
                        }
                      </div>
                    </div>

                    {/* actions */}
                    <div className="loja-admin-actions">
                      <button
                        type="button"
                        className={`admin-btn${it.destaque ? ' admin-btn-destaque-on' : ''}`}
                        onClick={() => toggleDestaque(it.id)}
                        title={it.destaque ? 'Remover do destaque' : 'Destacar no index'}
                        aria-label={it.destaque ? 'Remover destaque' : 'Adicionar destaque'}
                      >
                        {it.destaque ? '★' : '☆'}
                      </button>
                      <button type="button" className="admin-btn" onClick={() => cloneItem(it)} title="Clonar e editar">⧉ Clonar</button>
                      <button type="button" className="admin-btn admin-btn-primary" onClick={() => openEditItem(it)}>Editar</button>
                      <button type="button" className="admin-btn admin-btn-danger" onClick={() => deleteItem(it.id)}>Remover</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ));
        })()}
      </div>

      {/* ── editor modal ── */}
      {editorOpen ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Editar produto">
          <div className="loja-editor-modal">

            {/* header */}
            <div className="loja-editor-header">
              <span className="loja-editor-title">
                {items.find((i) => i.id === form.id) ? 'Editar produto' : 'Novo produto'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="admin-btn admin-btn-primary" onClick={saveItem}>SALVAR</button>
                <button type="button" className="admin-btn" onClick={tryCloseEditor}>FECHAR</button>
              </div>
            </div>

            <div className="loja-editor-body" style={{ gridTemplateColumns: '300px 1fr' }}>

              {/* ── col 1: slots de imagem ── */}
              <div className="loja-editor-left">
                <div className="loja-editor-slots-label">
                  Imagens
                  <span className="loja-editor-slots-count">({(form.images || []).length}/4)</span>
                </div>

                <div className="loja-img-slots">
                  {[0, 1, 2, 3].map((slot) => (
                    <LojaImgSlot
                      key={slot}
                      slot={slot}
                      url={(form.images || [])[slot]}
                      bgColor={form.bgColor}
                      imagesCount={(form.images || []).length}
                      isUploading={!!slotUploading[slot]}
                      dragSlot={dragSlot}
                      onDragStart={onDragStart}
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                      onDragEnd={() => setDragSlot(null)}
                      onUpload={uploadFileToSlot}
                      onRemove={(s) => { removeImage(s); setFormDirty(true); }}
                    />
                  ))}
                </div>
              </div>

              {/* ── col 2: campos ── */}
              <div className="loja-editor-right">

                <label className="admin-field">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span className="admin-label" style={{ marginBottom: 0 }}>Nome do produto</span>
                    <button
                      type="button"
                      className="admin-btn"
                      style={{ padding: '4px 10px', fontSize: '.65rem', letterSpacing: '1.5px' }}
                      onClick={gerarNome}
                      title="Gerar nome com base nos campos preenchidos"
                    >
                      ↺ GERAR
                    </button>
                  </div>
                  <input
                    className="admin-input"
                    value={form.name}
                    onChange={(e) => updateForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Camiseta Preta - BackPrint (Tradicional Regular) - DTG"
                    autoFocus
                  />
                </label>

                <label className="admin-field">
                  <span className="admin-label">Link do produto</span>
                  <input
                    className="admin-input"
                    value={form.productUrl}
                    onChange={(e) => updateForm((p) => ({ ...p, productUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </label>

                {/* linha 1: categoria | subcategoria | cor */}
                <div className="loja-editor-row3">
                  <label className="admin-field" style={{ marginBottom: 0 }}>
                    <span className="admin-label">Categoria</span>
                    <select
                      className="admin-input"
                      value={form.categoria}
                      onChange={(e) => updateForm((p) => ({ ...p, categoria: e.target.value, subcategoria: '' }))}
                    >
                      <option value="">— selecione —</option>
                      {CATEGORIA_KEYS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>

                  <label className="admin-field" style={{ marginBottom: 0 }}>
                    <span className="admin-label">Subcategoria</span>
                    <select
                      className="admin-input"
                      value={form.subcategoria}
                      onChange={(e) => updateForm((p) => ({ ...p, subcategoria: e.target.value }))}
                      disabled={!form.categoria}
                    >
                      <option value="">— selecione —</option>
                      {(CATEGORIAS[form.categoria] || []).map((s) => (
                        <option key={s} value={s}>{formatSubcat(s)}</option>
                      ))}
                    </select>
                  </label>

                  <label className="admin-field" style={{ marginBottom: 0 }}>
                    <span className="admin-label">Cor</span>
                    <SuggestInput
                      field="cor"
                      value={form.cor}
                      onChange={(e) => updateForm((p) => ({ ...p, cor: e.target.value }))}
                      onBlur={(e) => saveHistory('cor', e.target.value)}
                      placeholder="Ex: Preto"
                    />
                  </label>
                </div>

                {/* linha 2: estampa | impressão | cor de fundo */}
                <div className="loja-editor-row3">
                  <label className="admin-field" style={{ marginBottom: 0 }}>
                    <span className="admin-label">Estampa</span>
                    <select
                      className="admin-input"
                      value={form.printSide}
                      onChange={(e) => updateForm((p) => ({ ...p, printSide: e.target.value }))}
                    >
                      <option value="">— selecione —</option>
                      {PRINT_SIDE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>

                  <label className="admin-field" style={{ marginBottom: 0 }}>
                    <span className="admin-label">Impressão</span>
                    <select
                      className="admin-input"
                      value={form.printType}
                      onChange={(e) => updateForm((p) => ({ ...p, printType: e.target.value }))}
                    >
                      <option value="">— selecione —</option>
                      {PRINT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>

                  <label className="admin-field" style={{ marginBottom: 0 }}>
                    <span className="admin-label">Cor de fundo</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={form.bgColor || '#070707'}
                        onChange={(e) => updateForm((p) => ({ ...p, bgColor: e.target.value }))}
                        onBlur={(e) => saveHistory('bgColor', e.target.value)}
                        style={{ width: 40, height: 40, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                        aria-label="Cor de fundo"
                      />
                      <SuggestInput
                        field="bgColor"
                        value={form.bgColor || ''}
                        onChange={(e) => updateForm((p) => ({ ...p, bgColor: e.target.value }))}
                        onBlur={(e) => saveHistory('bgColor', e.target.value)}
                        placeholder="#070707"
                        style={{ minWidth: 0 }}
                      />
                    </div>
                  </label>
                </div>

                {/* linha 3: tamanho por posição de estampa */}
                <div>
                  <div className="admin-label" style={{ marginBottom: 8 }}>Tamanho das estampas</div>
                  <div className="loja-editor-row4">
                    {[
                      { key: 'frente', label: 'Frente' },
                      { key: 'costas', label: 'Costas' },
                      { key: 'ladoD',  label: 'Lado D' },
                      { key: 'ladoE',  label: 'Lado E' },
                    ].map(({ key, label }) => (
                      <label key={key} className="admin-field" style={{ marginBottom: 0 }}>
                        <span className="admin-label" style={{ opacity: .65 }}>{label}</span>
                        <SuggestInput
                          field={`printSize_${key}`}
                          value={(form.printSizes || {})[key] || ''}
                          onChange={(e) => updateForm((p) => ({
                            ...p,
                            printSizes: { ...(p.printSizes || {}), [key]: e.target.value },
                          }))}
                          onBlur={(e) => saveHistory(`printSize_${key}`, e.target.value)}
                          placeholder="Ex: 30x40cm"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* ── flags: edição especial ── */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,.07)' }}>
                  <button
                    type="button"
                    className={`admin-switch${form.edicaoEspecial ? ' is-on' : ''}`}
                    onClick={() => updateForm((p) => ({ ...p, edicaoEspecial: !p.edicaoEspecial }))}
                    aria-label="Edição Especial"
                  />
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase', color: form.edicaoEspecial ? '#e5c97e' : 'rgba(255,255,255,.4)' }}>
                    Edição Especial
                  </span>
                  {form.edicaoEspecial && (
                    <span style={{ fontSize: '.65rem', color: 'rgba(229,201,126,.6)', fontFamily: 'Inter, sans-serif' }}>
                      Aparece em destaque no topo da loja
                    </span>
                  )}
                </div>

                <label className="admin-field loja-field-grow" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span className="admin-label" style={{ marginBottom: 0 }}>Descrição</span>
                    <button
                      type="button"
                      className="admin-btn"
                      style={{ padding: '4px 10px', fontSize: '.65rem', letterSpacing: '1.5px' }}
                      onClick={gerarDescricao}
                      title="Gerar descrição com base nos campos preenchidos"
                    >
                      ↺ GERAR
                    </button>
                  </div>
                  <textarea
                    className="admin-input admin-textarea"
                    value={form.descricao}
                    onChange={(e) => updateForm((p) => ({ ...p, descricao: e.target.value }))}
                    placeholder="Preencha os campos acima e clique em GERAR, ou escreva manualmente…"
                    rows={4}
                    style={{ minHeight: 90, resize: 'vertical' }}
                  />
                </label>

              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── settings modal ── */}
      {settingsOpen ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal" style={{ width: 'min(560px, 96vw)' }}>
            <div className="admin-modal-header">
              <div className="admin-panel-title" style={{ borderBottom: 0, padding: 0 }}>CONFIGURAÇÕES</div>
              <button type="button" className="admin-btn" onClick={() => setSettingsOpen(false)}>FECHAR</button>
            </div>
            <div className="admin-form" style={{ padding: 0, marginTop: 16 }}>
              <label className="admin-field">
                <span className="admin-label">Link geral da loja (externo)</span>
                <input
                  className="admin-input"
                  value={settingsDraftUrl}
                  onChange={(e) => setSettingsDraftUrl(e.target.value)}
                  placeholder="https://..."
                />
              </label>
              <div className="admin-hint" style={{ marginBottom: 16 }}>
                Aparece como botão "Acessar Loja Oficial" na página <b>/loja</b>.
              </div>

              {/* ── cor de fundo global ── */}
              <div className="admin-field" style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 16, marginTop: 4 }}>
                <span className="admin-label">Cor de fundo global dos mockups</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                  <input
                    type="color"
                    value={settingsDraftBgColor}
                    onChange={(e) => setSettingsDraftBgColor(e.target.value)}
                    style={{ width: 40, height: 40, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                    aria-label="Cor de fundo global"
                  />
                  <input
                    className="admin-input"
                    value={settingsDraftBgColor}
                    onChange={(e) => setSettingsDraftBgColor(e.target.value)}
                    placeholder="#070707"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={applyGlobalBgColor}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    APLICAR A TODOS
                  </button>
                </div>
                <div className="admin-hint" style={{ marginTop: 8 }}>
                  Substitui a cor de fundo de <b>todos os {items.length} produtos</b> de uma vez.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="admin-btn" onClick={() => setSettingsOpen(false)}>CANCELAR</button>
                <button type="button" className="admin-btn admin-btn-primary" onClick={saveSettings}>SALVAR</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── gallery modal ── */}
      {galleryOpen ? (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files; if (f?.length) uploadGalleryFiles(galleryTab, f); }}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="admin-modal">
            <div className="admin-modal-header">
              <div className="admin-panel-title" style={{ borderBottom: 0, padding: 0 }}>GALERIA</div>
              <button type="button" className="admin-btn" onClick={() => setGalleryOpen(false)}>FECHAR</button>
            </div>

            <div className="admin-gallery-tabs admin-tabs-wrap">
              <div className="admin-tabs" style={{ padding: '8px 0' }}>
                {['loja', 'covers'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`admin-tab ${galleryTab === tab ? 'is-active' : ''}`}
                    onClick={async () => { setGalleryTab(tab); await listImagesForTab(tab); }}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {galleryLoading ? <div className="admin-hint">Carregando…</div> : null}
            {galleryError ? <div className="admin-hint" style={{ color: '#ffb3b3' }}>{galleryError}</div> : null}

            <div className="admin-cover-grid">
              <label
                className={`admin-cover-tile admin-cover-tile-upload ${galleryLoading ? 'is-loading' : ''}`}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer?.files; if (f?.length) uploadGalleryFiles(galleryTab, f); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <input key={galleryUploadKey} type="file" accept="image/*" multiple onChange={(e) => uploadGalleryFiles(galleryTab, e.target.files)} style={{ display: 'none' }} />
                <div className="admin-cover-upload-inner">
                  <div className="admin-cover-upload-plus">+</div>
                  <div className="admin-cover-upload-text">ENVIAR</div>
                </div>
              </label>

              {(galleryImages[galleryTab] || []).length === 0 && !galleryLoading ? (
                <div className="admin-hint">Nenhuma imagem em <b>{galleryTab === 'covers' ? 'discography/covers' : 'loja/images'}</b>.</div>
              ) : (
                (galleryImages[galleryTab] || []).map((img) => (
                  <button key={img.path} type="button" className="admin-cover-tile" onClick={() => selectImageUrl(img.url)} title={img.path}>
                    <img src={img.url} alt={img.path} />
                    <button
                      type="button"
                      className="admin-cover-tile-delete"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteGalleryImage(img.path); }}
                    >×</button>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
