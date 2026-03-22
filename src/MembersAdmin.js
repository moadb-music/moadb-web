import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query,
  doc, updateDoc, deleteDoc, addDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import ImageGalleryModal from './components/ImageGalleryModal';

const EMPTY_CONTENT = { type: 'video', title: '', description: '', downloadable: false };
const EXPIRY_DAYS = 30;

// Calcula data de expiração a partir do approvedAt
function getExpiryDate(member) {
  if (!member.approvedAt) return null;
  const approvedMs = member.approvedAt.toMillis
    ? member.approvedAt.toMillis()
    : member.approvedAt.seconds * 1000;
  return new Date(approvedMs + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

function daysLeft(expiryDate) {
  if (!expiryDate) return null;
  const diff = expiryDate - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ member }) {
  const expiry = getExpiryDate(member);
  if (!expiry) return null;
  const days = daysLeft(expiry);
  const expired = days <= 0;
  const soon = days > 0 && days <= 5;
  const color = expired ? '#ef5350' : soon ? '#ffb74d' : '#4caf50';
  const bg = expired ? 'rgba(180,0,0,0.15)' : soon ? 'rgba(255,183,0,0.15)' : 'rgba(0,160,60,0.12)';
  const label = expired
    ? 'EXPIRADO'
    : `${days}d restantes`;
  return (
    <span style={{
      fontSize: '0.6rem', background: bg, color, padding: '1px 7px',
      borderRadius: 10, letterSpacing: 1, fontFamily: 'Oswald,sans-serif',
      border: `1px solid ${color}44`,
    }}>
      {label}
    </span>
  );
}

export default function MembersAdmin() {
  const [members,  setMembers]  = useState([]);
  const [content,  setContent]  = useState([]);
  const [newItem,  setNewItem]  = useState({ ...EMPTY_CONTENT });
  const [file,     setFile]     = useState(null);
  const [progress, setProgress] = useState(null);
  const [adding,   setAdding]   = useState(false);
  const [tab,      setTab]      = useState('users');
  const [galleryOpen, setGalleryOpen] = useState(false); // 'new' | 'edit' | false
  const [editItem, setEditItem] = useState(null); // item being edited
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'membersContent'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setContent(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  // Aprova com timestamp de expiração
  const toggleApproval = async (id, current) => {
    const now = Timestamp.now();
    const expiry = new Timestamp(
      Math.floor(now.seconds + EXPIRY_DAYS * 24 * 60 * 60), 0
    );
    await updateDoc(doc(db, 'members', id), {
      approved: !current,
      status: !current ? 'approved' : 'revoked',
      approvedAt: !current ? now : null,
      expiresAt: !current ? expiry : null,
    });
  };

  const rejectMember = async (id) => {
    await updateDoc(doc(db, 'members', id), { approved: false, status: 'rejected' });
  };

  const removeMember = async (id) => {
    if (!window.confirm('Remover este membro?')) return;
    await deleteDoc(doc(db, 'members', id));
  };

  // Renova por mais 30 dias a partir de hoje
  const renewMember = async (id) => {
    const now = Timestamp.now();
    const expiry = new Timestamp(
      Math.floor(now.seconds + EXPIRY_DAYS * 24 * 60 * 60), 0
    );
    await updateDoc(doc(db, 'members', id), {
      approved: true,
      status: 'approved',
      approvedAt: now,
      expiresAt: expiry,
    });
  };

  // Upload de arquivo para Storage + salva no Firestore
  const addContent = async () => {
    if (!newItem.title.trim()) return;
    if (!file) { alert('Selecione um arquivo para upload.'); return; }
    setAdding(true); setProgress(0);

    try {
      // Upload do arquivo principal
      const ext = file.name.split('.').pop();
      const path = `members-content/${Date.now()}_${newItem.title.replace(/\s+/g, '_')}.${ext}`;
      const fileUrl = await uploadWithProgress(ref(storage, path), file, setProgress);

      await addDoc(collection(db, 'membersContent'), {
        type: newItem.type,
        title: newItem.title.trim(),
        description: newItem.description.trim(),
        lyrics: (newItem.lyrics || '').trim(),
        url: fileUrl,
        storagePath: path,
        thumbUrl: newItem.thumbUrl || '',
        fileName: file.name,
        fileSize: file.size,
        downloadable: newItem.downloadable === true,
        createdAt: serverTimestamp(),
      });

      setNewItem({ ...EMPTY_CONTENT });
      setFile(null);
      setProgress(null);
    } catch (err) {
      alert('Erro ao fazer upload: ' + err.message);
    } finally {
      setAdding(false);
    }
  };

  const removeContent = async (item) => {
    if (!window.confirm('Remover este conteúdo?')) return;
    if (item.storagePath) {
      try { await deleteObject(ref(storage, item.storagePath)); } catch (_) {}
    }
    await deleteDoc(doc(db, 'membersContent', item.id));
  };

  const saveEdit = async () => {
    if (!editItem || !editItem.title.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'membersContent', editItem.id), {
        title:        editItem.title.trim(),
        description:  (editItem.description || '').trim(),
        lyrics:       (editItem.lyrics || '').trim(),
        thumbUrl:     editItem.thumbUrl || '',
        downloadable: editItem.downloadable === true,
      });
      setEditItem(null);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const pending  = members.filter((m) => !m.approved);
  const approved = members.filter((m) => m.approved);

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div>
          <h2 className="admin-h2">MEMBROS</h2>
          <p className="admin-subtitle">Usuários e conteúdo exclusivo.</p>
        </div>
        <div className="admin-section-actions">
          <a href="/members" target="_blank" rel="noopener noreferrer" className="admin-btn admin-btn-ghost">
            VER PÁGINA ↗
          </a>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button type="button" className={`admin-btn${tab === 'users' ? ' admin-btn-primary' : ''}`} onClick={() => setTab('users')}>
          USUÁRIOS {pending.length > 0 && <span style={{ marginLeft: 6, background: 'var(--red,#8b0000)', borderRadius: 20, padding: '1px 7px', fontSize: '0.7rem' }}>{pending.length}</span>}
        </button>
        <button type="button" className={`admin-btn${tab === 'content' ? ' admin-btn-primary' : ''}`} onClick={() => setTab('content')}>
          CONTEÚDO
        </button>
      </div>

      {/* ===== USERS TAB ===== */}
      {tab === 'users' && (
        <>
          {pending.length > 0 && (
            <div className="admin-card" style={{ marginBottom: 16 }}>
              <div className="admin-panel-title" style={{ color: '#ffb74d' }}>
                AGUARDANDO APROVAÇÃO ({pending.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {pending.map((m) => (
                  <MemberRow key={m.id} member={m} onToggle={toggleApproval} onReject={rejectMember} onRemove={removeMember} onRenew={renewMember} />
                ))}
              </div>
            </div>
          )}
          <div className="admin-card">
            <div className="admin-panel-title">APROVADOS ({approved.length})</div>
            {approved.length === 0 ? (
              <p className="admin-muted" style={{ padding: '14px 0' }}>Nenhum membro aprovado ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {approved.map((m) => (
                  <MemberRow key={m.id} member={m} onToggle={toggleApproval} onReject={rejectMember} onRemove={removeMember} onRenew={renewMember} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== CONTENT TAB ===== */}
      {tab === 'content' && (
        <>
          <div className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-panel-title">ADICIONAR CONTEÚDO</div>
            <div style={{ padding: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="admin-field-row">
                <div className="admin-field" style={{ margin: 0 }}>
                  <label className="admin-label">Tipo</label>
                  <select className="admin-input" value={newItem.type} onChange={(e) => {
                    setNewItem((p) => ({ ...p, type: e.target.value }));
                    setFile(null);
                  }}>
                    <option value="video">Vídeo</option>
                    <option value="music">Música</option>
                    <option value="photo">Foto</option>
                  </select>
                </div>
                <div className="admin-field" style={{ margin: 0, flex: 2 }}>
                  <label className="admin-label">Título</label>
                  <input className="admin-input" value={newItem.title} onChange={(e) => setNewItem((p) => ({ ...p, title: e.target.value }))} placeholder="Nome do conteúdo" />
                </div>
              </div>

              <div className="admin-field" style={{ margin: 0 }}>
                <label className="admin-label">
                  Arquivo — {newItem.type === 'music' ? 'MP3, WAV, FLAC' : newItem.type === 'video' ? 'MP4, MOV, MKV' : 'JPG, PNG, WEBP'}
                </label>
                <label style={{ display: 'block', cursor: 'pointer' }}>
                  <input key={newItem.type} type="file"
                    accept={newItem.type === 'music' ? 'audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a' : newItem.type === 'video' ? 'video/*,.mp4,.mov,.mkv,.avi' : 'image/*'}
                    style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0] || null)} />
                  <div className="admin-upload-btn">
                    {newItem.type === 'music' ? '🎵' : newItem.type === 'video' ? '🎬' : '🖼'}{' '}
                    {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)` : 'SELECIONAR ARQUIVO'}
                  </div>
                </label>
              </div>

              <div className="admin-field" style={{ margin: 0 }}>
                <label className="admin-label">Thumbnail (opcional)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setGalleryOpen('new')}>
                    🖼 {newItem.thumbUrl ? 'TROCAR THUMBNAIL' : 'SELECIONAR DA GALERIA'}
                  </button>
                  {newItem.thumbUrl && (
                    <img src={newItem.thumbUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 3, border: '1px solid rgba(255,255,255,0.15)' }} />
                  )}
                  {newItem.thumbUrl && (
                    <button type="button" className="admin-btn admin-btn-danger" style={{ padding: '4px 8px' }} onClick={() => setNewItem(p => ({ ...p, thumbUrl: '' }))}>✕</button>
                  )}
                </div>
              </div>

              <div className="admin-field" style={{ margin: 0 }}>
                <label className="admin-label">Descrição (opcional)</label>
                <input className="admin-input" value={newItem.description} onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} placeholder="Breve descrição..." />
              </div>

              <div className="admin-field" style={{ margin: 0 }}>
                <label className="admin-label">Letra (opcional — só para músicas)</label>
                <textarea className="admin-input" rows={5} value={newItem.lyrics || ''} onChange={(e) => setNewItem((p) => ({ ...p, lyrics: e.target.value }))} placeholder={'[Verso 1]\n...'} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.6 }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', opacity: 0.85 }}>
                <input type="checkbox" checked={!!newItem.downloadable} onChange={(e) => setNewItem(p => ({ ...p, downloadable: e.target.checked }))} />
                Permitir download pelos membros
              </label>

              {progress !== null && (
                <>
                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', height: 6 }}>
                    <div style={{ height: '100%', background: 'var(--red,#8b0000)', width: `${progress}%`, transition: 'width 0.2s' }} />
                  </div>
                  <p style={{ fontSize: '0.75rem', opacity: 0.5, margin: 0 }}>
                    {progress < 100 ? `Enviando... ${Math.round(progress)}%` : 'Finalizando...'}
                  </p>
                </>
              )}

              <button type="button" className="admin-btn admin-btn-primary" onClick={addContent}
                disabled={adding || !newItem.title.trim() || !file}>
                {adding ? 'ENVIANDO...' : '+ ADICIONAR'}
              </button>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-panel-title">CONTEÚDO PUBLICADO ({content.length})</div>
            {content.length === 0 ? (
              <p className="admin-muted" style={{ padding: '14px 0' }}>Nenhum conteúdo adicionado ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {content.map((item) => (
                  <div key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {editItem?.id === item.id ? (
                      /* ---- EDIT MODE ---- */
                      <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div className="admin-field-row">
                          <div className="admin-field" style={{ margin: 0, flex: 2 }}>
                            <label className="admin-label">Título</label>
                            <input className="admin-input" value={editItem.title} onChange={(e) => setEditItem(p => ({ ...p, title: e.target.value }))} />
                          </div>
                        </div>
                        <div className="admin-field" style={{ margin: 0 }}>
                          <label className="admin-label">Thumbnail</label>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setGalleryOpen('edit')}>
                              🖼 {editItem.thumbUrl ? 'TROCAR' : 'SELECIONAR DA GALERIA'}
                            </button>
                            {editItem.thumbUrl && (
                              <img src={editItem.thumbUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 3, border: '1px solid rgba(255,255,255,0.15)' }} />
                            )}
                            {editItem.thumbUrl && (
                              <button type="button" className="admin-btn admin-btn-danger" style={{ padding: '4px 8px' }} onClick={() => setEditItem(p => ({ ...p, thumbUrl: '' }))}>✕</button>
                            )}
                          </div>
                        </div>
                        <div className="admin-field" style={{ margin: 0 }}>
                          <label className="admin-label">Descrição</label>
                          <input className="admin-input" value={editItem.description || ''} onChange={(e) => setEditItem(p => ({ ...p, description: e.target.value }))} />
                        </div>
                        <div className="admin-field" style={{ margin: 0 }}>
                          <label className="admin-label">Letra</label>
                          <textarea className="admin-input" rows={5} value={editItem.lyrics || ''} onChange={(e) => setEditItem(p => ({ ...p, lyrics: e.target.value }))} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.6 }} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', opacity: 0.85 }}>
                          <input type="checkbox" checked={!!editItem.downloadable} onChange={(e) => setEditItem(p => ({ ...p, downloadable: e.target.checked }))} />
                          Permitir download pelos membros
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="admin-btn admin-btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'SALVANDO...' : 'SALVAR'}</button>
                          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setEditItem(null)}>CANCELAR</button>
                        </div>
                      </div>
                    ) : (
                      /* ---- VIEW MODE ---- */
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: 10, alignItems: 'center', padding: '10px 0' }}>
                        {item.thumbUrl
                          ? <img src={item.thumbUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                          : <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.05)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                              {item.type === 'music' ? '🎵' : item.type === 'video' ? '🎬' : '📷'}
                            </div>
                        }
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.65rem', letterSpacing: 2, color: 'var(--red,#8b0000)', textTransform: 'uppercase', fontFamily: 'Oswald,sans-serif' }}>{item.type}</div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          {item.description && <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{item.description}</div>}
                          {item.fileName && <div style={{ fontSize: '0.68rem', opacity: 0.3 }}>{item.fileName} · {item.fileSize ? (item.fileSize / 1024 / 1024).toFixed(1) + 'MB' : ''}</div>}
                        </div>
                        <a href={item.url} target="_blank" rel="noreferrer" className="admin-btn admin-btn-ghost" style={{ fontSize: '0.72rem', padding: '5px 10px' }}>↗</a>
                        <button type="button" className="admin-btn admin-btn-ghost" style={{ padding: '5px 10px', fontSize: '0.72rem' }} onClick={() => setEditItem({ ...item })}>✏</button>
                        <button type="button" className="admin-btn admin-btn-danger" style={{ padding: '5px 10px', fontSize: '0.72rem' }} onClick={() => removeContent(item)}>✕</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Gallery modal para thumbnail */}
      {galleryOpen && (
        <ImageGalleryModal
          title="SELECIONAR THUMBNAIL"
          tabs={[{ key: 'members', label: 'MEMBROS', folder: 'members-content/thumbs' }, { key: 'images', label: 'IMAGENS', folder: 'images' }]}
          onSelect={(url) => {
            if (galleryOpen === 'new') setNewItem(p => ({ ...p, thumbUrl: url }));
            else if (galleryOpen === 'edit') setEditItem(p => ({ ...p, thumbUrl: url }));
            setGalleryOpen(false);
          }}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </div>
  );
}

// Helper: upload com progresso, retorna URL
function uploadWithProgress(storageRef, file, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on('state_changed',
      (snap) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });
}

function MemberRow({ member, onToggle, onReject, onRemove, onRenew }) {
  const [open, setOpen] = useState(false);
  const status = member.status || (member.approved ? 'approved' : 'pending');
  const expiry = getExpiryDate(member);
  const days   = daysLeft(expiry);
  const isExpired = member.approved && days !== null && days <= 0;

  const statusBadge = {
    approved: { label: 'APROVADO',  color: '#4caf50', bg: 'rgba(0,160,60,0.15)' },
    pending:  { label: 'PENDENTE',  color: '#ffb74d', bg: 'rgba(255,183,0,0.15)' },
    rejected: { label: 'REJEITADO', color: '#ef5350', bg: 'rgba(180,0,0,0.15)' },
    revoked:  { label: 'REVOGADO',  color: '#ef5350', bg: 'rgba(180,0,0,0.15)' },
  }[status] || { label: status.toUpperCase(), color: '#fff', bg: 'transparent' };

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '12px 0' }}>
        <div style={{ cursor: member.proofSentAt ? 'pointer' : 'default', minWidth: 0 }} onClick={() => member.proofSentAt && setOpen(o => !o)}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {member.name || '—'}
            <span style={{ fontSize: '0.62rem', background: statusBadge.bg, color: statusBadge.color, padding: '1px 7px', borderRadius: 10, letterSpacing: 1, fontFamily: 'Oswald,sans-serif' }}>
              {statusBadge.label}
            </span>
            {member.approved && <ExpiryBadge member={member} />}
            {member.proofSentAt && <span style={{ fontSize: '0.62rem', background: 'rgba(255,183,0,0.15)', color: '#ffb74d', padding: '1px 7px', borderRadius: 10, letterSpacing: 1 }}>COMPROVANTE ▾</span>}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: 2 }}>{member.email}</div>
          {expiry && (
            <div style={{ fontSize: '0.68rem', opacity: 0.4, marginTop: 2 }}>
              {isExpired ? 'Expirou em ' : 'Expira em '}{expiry.toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!member.approved && status !== 'rejected' && (
            <button type="button" className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => onToggle(member.id, false)}>APROVAR</button>
          )}
          {member.approved && (
            <>
              <button type="button" className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => onRenew(member.id)} title="Renovar por mais 30 dias">+30d</button>
              <button type="button" className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => onToggle(member.id, true)}>REVOGAR</button>
            </>
          )}
          {!member.approved && status !== 'rejected' && (
            <button type="button" className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => onReject(member.id)}>REJEITAR</button>
          )}
          {(status === 'rejected' || status === 'revoked' || isExpired) && (
            <button type="button" className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => onToggle(member.id, false)}>REATIVAR</button>
          )}
          <button type="button" className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => onRemove(member.id)}>✕</button>
        </div>
      </div>
      {open && member.proofSentAt && (
        <div style={{ padding: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {member.proofMessage && (
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: 3 }}>
              "{member.proofMessage}"
            </p>
          )}
          {member.proofUrl && (
            <a href={member.proofUrl} target="_blank" rel="noreferrer" className="admin-btn admin-btn-ghost" style={{ fontSize: '0.72rem', alignSelf: 'flex-start' }}>
              VER COMPROVANTE ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
