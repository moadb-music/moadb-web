import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import DiscografiaAdmin from './DiscografiaAdmin';
import LojaAdmin from './LojaAdmin';
import PaginasAdmin from './PaginasAdmin';
import HomeAdmin from './HomeAdmin';
import NoticiasAdmin from './NoticiasAdmin';
import TreeAdmin from './TreeAdmin';
import DonateAdmin from './DonateAdmin';
import MensagensAdmin from './MensagensAdmin';
import MembersAdmin from './MembersAdmin';
import TrafficAdmin from './TrafficAdmin';
import logoMark from './assets/logo-mark.png';
import './Admin.css';

const NAV_ITEMS = [
  { id: 'traffic',    label: 'Dashboard',   icon: '▦' },
  { id: 'noticias',   label: 'Notícias',    icon: '◈' },
  { id: 'home',       label: 'Destaque',    icon: '★' },
  { id: 'tree',       label: 'Tree',        icon: '⬡' },
  { id: 'paginas',    label: 'Páginas',     icon: '⊞' },
  { id: 'loja',       label: 'Loja',        icon: '◻' },
  { id: 'discografia',label: 'Discografia', icon: '◎' },
  { id: 'donate',     label: 'Doações',     icon: '♥' },
  { id: 'mensagens',  label: 'Mensagens',   icon: '◉' },
  { id: 'members',    label: 'Membros',     icon: '◈' },
];

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('traffic');
  const [newsIsDirty, setNewsIsDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function trySetTab(tab) {
    if (tab !== 'noticias' && newsIsDirty) {
      setPendingTab(tab);
    } else {
      setActiveTab(tab);
      setSidebarOpen(false);
    }
  }

  const activeLabel = NAV_ITEMS.find(i => i.id === activeTab)?.label ?? 'Dashboard';

  return (
    <div className="adm">
      {/* ── Sidebar ── */}
      <aside className={`adm-sidebar${sidebarOpen ? ' is-open' : ''}`} aria-label="Navegação do painel">
        <div className="adm-sidebar-section-label">GERAL</div>
        <nav className="adm-nav">
          {NAV_ITEMS.slice(0, 1).map(item => (
            <button
              key={item.id}
              type="button"
              className={`adm-nav-item${activeTab === item.id ? ' is-active' : ''}`}
              onClick={() => trySetTab(item.id)}
            >
              <span className="adm-nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="adm-sidebar-section-label">CONTEÚDO</div>
        <nav className="adm-nav">
          {NAV_ITEMS.slice(1).map(item => (
            <button
              key={item.id}
              type="button"
              className={`adm-nav-item${activeTab === item.id ? ' is-active' : ''}`}
              onClick={() => trySetTab(item.id)}
            >
              <span className="adm-nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* overlay mobile */}
      {sidebarOpen && (
        <div className="adm-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* ── Main ── */}
      <div className="adm-main">
        {/* Top bar */}
        <header className="adm-topbar">
          <button
            className="adm-hamburger"
            type="button"
            aria-label="Abrir menu"
            onClick={() => setSidebarOpen(v => !v)}
          >
            <span /><span /><span />
          </button>
          <img src={logoMark} alt="Admin" className="adm-topbar-logo" />
          <span className="adm-topbar-brand">ADMIN</span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="adm-topbar-btn"
            onClick={async () => {
              try { await signOut(auth); } finally { navigate('/'); }
            }}
          >
            Sair
          </button>
        </header>

        {/* Content */}
        <div className="adm-content">
          {activeTab === 'traffic'     ? <TrafficAdmin /> :
           activeTab === 'noticias'    ? <NoticiasAdmin onDirtyChange={setNewsIsDirty} /> :
           activeTab === 'discografia' ? <DiscografiaAdmin /> :
           activeTab === 'home'        ? <HomeAdmin /> :
           activeTab === 'tree'        ? <TreeAdmin /> :
           activeTab === 'loja'        ? <LojaAdmin /> :
           activeTab === 'paginas'     ? <PaginasAdmin /> :
           activeTab === 'donate'      ? <DonateAdmin /> :
           activeTab === 'mensagens'   ? <MensagensAdmin /> :
           activeTab === 'members'     ? <MembersAdmin /> :
           <div className="admin-empty" />}
        </div>
      </div>

      {/* Unsaved changes modal */}
      {pendingTab && (
        <div className="news-modal-backdrop" onMouseDown={() => setPendingTab(null)}>
          <div
            className="news-modal"
            style={{ maxWidth: 420, height: 'auto', minHeight: 'unset' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="news-modal-close" onClick={() => setPendingTab(null)} aria-label="Fechar">×</button>
            <div style={{ padding: '36px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '1rem', letterSpacing: 1, color: '#fff' }}>Sair sem salvar?</h2>
              <p style={{ margin: 0, opacity: 0.6, lineHeight: 1.6, fontSize: '0.88rem' }}>Você tem alterações não salvas nas notícias. Deseja sair mesmo assim?</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="admin-btn" onClick={() => setPendingTab(null)}>Cancelar</button>
                <button type="button" className="admin-btn admin-btn-danger" onClick={() => { setActiveTab(pendingTab); setPendingTab(null); setNewsIsDirty(false); }}>Sair sem salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
