import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { useAuth } from './authContext';
import './Admin.css';

const ALLOWED_EMAILS = (process.env.REACT_APP_ADMIN_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = location.state?.from?.pathname || '/admin';

  const isAllowed = useMemo(() => {
    if (!user) return false;
    if (ALLOWED_EMAILS.length === 0) return true; // allowlist not configured
    const email = (user.email || '').toLowerCase();
    return ALLOWED_EMAILS.includes(email);
  }, [user]);

  useEffect(() => {
    if (location.state?.notAllowed) {
      setError('Essa conta não tem permissão para acessar o admin.');
    }
  }, [location.state]);

  useEffect(() => {
    // Only redirect if user is allowed.
    if (!loading && user && isAllowed) navigate(from, { replace: true });
    if (!loading && user && !isAllowed) setError('Essa conta não tem permissão para acessar o admin.');
  }, [loading, user, isAllowed, from, navigate]);

  async function onGoogle() {
    setError('');
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // redirect handled by effect
    } catch (e) {
      setError('Falha ao autenticar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin">
      <div className="admin-bg" aria-hidden="true" />

      <div className="admin-shell admin-login">
        <div className="admin-login-card">
          <h1 className="admin-title" style={{ marginBottom: 18 }}>ADMIN</h1>
          <div className="admin-login-actions">
            <button type="button" className="admin-login-btn" onClick={onGoogle} disabled={busy}>
              {busy ? 'ENTRANDO...' : 'ENTRAR COM GOOGLE'}
            </button>
            <button type="button" className="admin-login-btn" onClick={() => navigate('/')}>
              VOLTAR
            </button>
          </div>
          {error && <div className="admin-login-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
