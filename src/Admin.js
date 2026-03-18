import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import DiscografiaAdmin from './DiscografiaAdmin';
import LojaAdmin from './LojaAdmin';
import PaginasAdmin from './PaginasAdmin';
import HomeAdmin from './HomeAdmin';
import NoticiasAdmin from './NoticiasAdmin';
import './Admin.css';

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('noticias');
  const [newsIsDirty, setNewsIsDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  function trySetTab(tab) {
    if (tab !== 'noticias' && newsIsDirty) {
      setPendingTab(tab);
    } else {
      setActiveTab(tab);
    }
  }

  const storageText = useMemo(() => {
    // Placeholder visual (igual ao print). Integração real virá depois.
    return 'ARMAZENAMENTO: 0.02MB / 10GB';
  }, []);

  return (
    <div className="admin">
      <div className="admin-bg" aria-hidden="true" />

      <div className="admin-shell">
        <div className="admin-header-row">
          <h1 className="admin-title">DASHBOARD</h1>

          <div className="admin-top-actions">
            <div className="admin-pill">{storageText}</div>
            <button
              type="button"
              className="admin-logout"
              onClick={async () => {
                try {
                  await signOut(auth);
                } finally {
                  navigate('/');
                }
              }}
            >
              SAIR
            </button>
          </div>
        </div>

        <div className="admin-divider" />

        <div className="admin-tabs-wrap">
          <nav className="admin-tabs" aria-label="Navegação do painel">
            <button
              type="button"
              className={`admin-tab ${activeTab === 'noticias' ? 'is-active' : ''}`}
              onClick={() => trySetTab('noticias')}
            >
              NOTÍCIAS
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'home' ? 'is-active' : ''}`}
              onClick={() => trySetTab('home')}
            >
              HOME
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'paginas' ? 'is-active' : ''}`}
              onClick={() => trySetTab('paginas')}
            >
              PÁGINAS
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'loja' ? 'is-active' : ''}`}
              onClick={() => trySetTab('loja')}
            >
              LOJA
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'discografia' ? 'is-active' : ''}`}
              onClick={() => trySetTab('discografia')}
            >
              DISCOGRAFIA
            </button>
          </nav>
        </div>

        {activeTab === 'noticias' ? (
          <NoticiasAdmin onDirtyChange={setNewsIsDirty} />
        ) : activeTab === 'discografia' ? (
          <DiscografiaAdmin />
        ) : activeTab === 'home' ? (
          <HomeAdmin />
        ) : activeTab === 'loja' ? (
          <LojaAdmin />
        ) : activeTab === 'paginas' ? (
          <PaginasAdmin />
        ) : (
          <div className="admin-empty" aria-label="Conteúdo do painel" />
        )}

        {pendingTab ? (
          <div className="news-modal-backdrop" onMouseDown={() => setPendingTab(null)}>
            <div
              className="news-modal"
              style={{ maxWidth: 420, height: 'auto', minHeight: 'unset' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button className="news-modal-close" onClick={() => setPendingTab(null)} aria-label="Fechar">×</button>
              <div style={{ padding: '36px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h2 style={{ margin: 0, fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', letterSpacing: 2, textTransform: 'uppercase', color: '#fff' }}>SAIR SEM SALVAR?</h2>
                <p style={{ margin: 0, opacity: 0.7, lineHeight: 1.6, fontSize: '0.9rem' }}>Você tem alterações não salvas nas notícias. Deseja sair mesmo assim?</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button type="button" className="admin-btn" onClick={() => setPendingTab(null)}>CANCELAR</button>
                  <button type="button" className="admin-btn admin-btn-danger" onClick={() => { setActiveTab(pendingTab); setPendingTab(null); setNewsIsDirty(false); }}>SAIR SEM SALVAR</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
