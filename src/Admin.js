import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import DiscografiaAdmin from './DiscografiaAdmin';
import './Admin.css';

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('noticias');

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
              onClick={() => setActiveTab('noticias')}
            >
              NOTÍCIAS
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'home' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              HOME
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'paginas' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('paginas')}
            >
              PÁGINAS
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'loja' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('loja')}
            >
              LOJA
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === 'discografia' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('discografia')}
            >
              DISCOGRAFIA
            </button>
          </nav>
        </div>

        {activeTab === 'discografia' ? (
          <DiscografiaAdmin />
        ) : (
          <div className="admin-empty" aria-label="Conteúdo do painel" />
        )}
      </div>
    </div>
  );
}
