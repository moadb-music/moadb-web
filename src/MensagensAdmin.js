import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MensagensAdmin() {
  const [messages, setMessages] = useState([]);
  const [open, setOpen]         = useState(null); // id of expanded message

  useEffect(() => {
    const q = query(collection(db, 'contactMessages'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const markRead = async (id) => {
    await updateDoc(doc(db, 'contactMessages', id), { read: true });
  };

  const remove = async (id) => {
    if (!window.confirm('Excluir esta mensagem?')) return;
    await deleteDoc(doc(db, 'contactMessages', id));
    if (open === id) setOpen(null);
  };

  const unread = messages.filter((m) => !m.read).length;

  return (
    <div className="admin-section">
      <div className="admin-card">
        <div className="admin-card-title">
          MENSAGENS DE CONTATO
          {unread > 0 && <span className="msg-badge">{unread} não lida{unread > 1 ? 's' : ''}</span>}
        </div>

        {messages.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Nenhuma mensagem ainda.</p>
        )}

        <ul className="msg-list">
          {messages.map((m) => (
            <li key={m.id} className={`msg-item${m.read ? '' : ' msg-item--unread'}`}>
              <div className="msg-header" onClick={() => {
                setOpen(open === m.id ? null : m.id);
                if (!m.read) markRead(m.id);
              }}>
                <div className="msg-meta">
                  {!m.read && <span className="msg-dot" aria-label="Não lida" />}
                  <span className="msg-name">{m.name}</span>
                  <span className="msg-email">{m.email}</span>
                </div>
                <div className="msg-right">
                  <span className="msg-date">{formatDate(m.createdAt)}</span>
                  <span className="msg-chevron">{open === m.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {open === m.id && (
                <div className="msg-body">
                  {m.subject && <p className="msg-subject">Assunto: {m.subject}</p>}
                  <p className="msg-text">{m.message}</p>
                  <div className="msg-actions">
                    <a className="admin-btn admin-btn-sm" href={`mailto:${m.email}?subject=Re: ${m.subject || ''}`}>
                      RESPONDER
                    </a>
                    <button type="button" className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => remove(m.id)}>
                      EXCLUIR
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
