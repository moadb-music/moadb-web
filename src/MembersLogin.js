import { useEffect, useState } from 'react';
import {
  signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, GoogleAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Navigate } from 'react-router-dom';
import { useAuth } from './authContext';
import { auth, db } from './firebase';
import SiteNav from './components/SiteNav';
import SupportWidget from './components/SupportWidget';
import './App.css';
import './Members.css';

const googleProvider = new GoogleAuthProvider();

function applyBg(bg) {
  if (!bg) return {};
  const c01 = (n) => Math.max(0, Math.min(1, parseFloat(n) || 0));
  const aHex = (c, op) =>
    /^#[0-9a-fA-F]{6}$/.test(c)
      ? c + Math.round(c01(op) * 255).toString(16).padStart(2, '0')
      : c || '#000000';
  const gradOn = bg.gradientEnabled !== false;
  const imgOn  = bg.imageEnabled !== false && bg.imageUrl;
  const angle  = Math.max(0, Math.min(360, parseFloat(bg.gradientAngle) || 180));
  const from   = gradOn ? aHex(bg.gradientFrom || '#000000', bg.gradientFromOpacity != null ? bg.gradientFromOpacity : bg.gradientOpacity != null ? bg.gradientOpacity : 1) : 'transparent';
  const to     = gradOn ? aHex(bg.gradientTo   || '#000000', bg.gradientToOpacity   != null ? bg.gradientToOpacity   : bg.gradientOpacity != null ? bg.gradientOpacity : 1) : 'transparent';
  return {
    '--bg-gradient':      gradOn ? 'linear-gradient(' + angle + 'deg, ' + from + ', ' + to + ')' : 'none',
    '--bg-image':         imgOn  ? "url('" + bg.imageUrl + "')" : 'none',
    '--bg-image-opacity': imgOn  ? c01(bg.imageOpacity != null ? bg.imageOpacity : 0.35) : 0,
  };
}

async function ensureMemberDoc(user) {
  const docRef = doc(db, 'members', user.uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    await setDoc(docRef, {
      uid: user.uid,
      email: user.email,
      name: user.displayName || user.email.split('@')[0],
      approved: false,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  }
}

function friendlyError(code, isPt = true) {
  const map = isPt ? {
    'auth/user-not-found':       'Usuario nao encontrado.',
    'auth/wrong-password':       'Senha incorreta.',
    'auth/email-already-in-use': 'Este e-mail ja esta cadastrado.',
    'auth/weak-password':        'Senha muito fraca (minimo 6 caracteres).',
    'auth/invalid-email':        'E-mail invalido.',
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/invalid-credential':   'E-mail ou senha incorretos.',
  } : {
    'auth/user-not-found':       'User not found.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password':        'Password too weak (minimum 6 characters).',
    'auth/invalid-email':        'Invalid email.',
    'auth/popup-closed-by-user': 'Login cancelled.',
    'auth/invalid-credential':   'Incorrect email or password.',
  };
  return map[code] || (isPt ? 'Erro ao autenticar. Tente novamente.' : 'Authentication error. Please try again.');
}

export default function MembersLogin() {
  const { user, loading } = useAuth();
  const [mode,     setMode]     = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [pagesBg,  setPagesBg]  = useState(null);
  const [lang,     setLang]     = useState(() => {
    const nav = navigator.languages?.[0] || navigator.language || 'pt-BR';
    return nav.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  });
  const isPt = lang === 'pt-BR';

  useEffect(() => {
    document.body.classList.remove('show-bmc');
    return () => document.body.classList.remove('show-bmc');
  }, []);

  useEffect(() => {
    return onSnapshot(doc(db, 'siteData', 'moadb_pages'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const c = d?.content ?? d;
        setPagesBg(c?.backgroundsBySection?.main ?? null);
      }
    });
  }, []);

  if (!loading && user) return <Navigate to="/members" replace />;
  if (loading) return null;

  const handleGoogle = async () => {
    setBusy(true); setError(''); setSuccess('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureMemberDoc(result.user);
      setSuccess(isPt ? 'Login realizado! Redirecionando...' : 'Signed in! Redirecting...');
    } catch (e) {
      setError(friendlyError(e.code, isPt));
      setBusy(false);
    }
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setSuccess('');
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'members', cred.user.uid), {
          uid: cred.user.uid,
          email: cred.user.email,
          name: name.trim() || email.split('@')[0],
          approved: false,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
        setSuccess(isPt ? 'Conta criada! Redirecionando...' : 'Account created! Redirecting...');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccess(isPt ? 'Login realizado! Redirecionando...' : 'Signed in! Redirecting...');
      }
    } catch (e) {
      setError(friendlyError(e.code, isPt));
      setBusy(false);
    }
  };

  return (
    <div className="app-container members-page">
      <div className="bg-layer" aria-hidden="true" style={applyBg(pagesBg)} />
      <SiteNav lang={lang} setLang={setLang} />
      <div className="members-login-wrap">

        <div className="members-login-card">
          <h1 className="members-login-title">{isPt ? 'AREA DE MEMBROS' : 'MEMBERS AREA'}</h1>
          <p className="members-login-sub">
            {isPt ? 'Conteudo exclusivo para apoiadores do projeto.' : 'Exclusive content for project supporters.'}
          </p>
          <div className="members-login-providers">
            <button className="members-login-btn members-login-btn--google" onClick={handleGoogle} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {busy ? (isPt ? 'AGUARDE...' : 'PLEASE WAIT...') : (isPt ? 'ENTRAR COM GOOGLE' : 'SIGN IN WITH GOOGLE')}
            </button>
          </div>
          <div className="members-login-divider">{isPt ? 'OU' : 'OR'}</div>
          <form className="members-login-form" onSubmit={handleEmail}>
            {mode === 'register' && (
              <input className="members-login-input" type="text"
                placeholder={isPt ? 'Seu nome' : 'Your name'}
                value={name} onChange={(e) => setName(e.target.value)} required />
            )}
            <input className="members-login-input" type="email" placeholder="E-mail"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="members-login-input" type="password"
              placeholder={isPt ? 'Senha' : 'Password'}
              value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            {error   && <p className="members-login-error">{error}</p>}
            {success && <p className="members-login-error" style={{ color: '#4caf50' }}>{success}</p>}
            <button className="members-login-btn members-login-btn--email" type="submit" disabled={busy}>
              {busy
                ? (isPt ? 'AGUARDE...' : 'PLEASE WAIT...')
                : mode === 'register'
                  ? (isPt ? 'CRIAR CONTA' : 'CREATE ACCOUNT')
                  : (isPt ? 'ENTRAR' : 'SIGN IN')}
            </button>
          </form>
          <button className="members-login-toggle"
            onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }}>
            {mode === 'login'
              ? (isPt ? 'Nao tem conta? Criar agora' : "Don't have an account? Create one")
              : (isPt ? 'Ja tem conta? Entrar' : 'Already have an account? Sign in')}
          </button>
        </div>

        <div className="members-perks">
          <h2 className="members-perks-title">{isPt ? 'POR QUE SER MEMBRO?' : 'WHY BECOME A MEMBER?'}</h2>
          <ul className="members-perks-list">
            <li>
              <span className="members-perks-icon">&#127925;</span>
              <div>
                <strong>{isPt ? 'Conteudo exclusivo' : 'Exclusive content'}</strong>
                <span>{isPt ? 'Lancamentos e demos antes do publico geral.' : 'Releases and demos before the general public.'}</span>
              </div>
            </li>
            <li>
              <span className="members-perks-icon">&#11015;&#65039;</span>
              <div>
                <strong>{isPt ? 'Downloads HD' : 'HD Downloads'}</strong>
                <span>{isPt ? 'Musicas, fotos e videos em resolucao maxima.' : 'Music, photos and videos in maximum resolution.'}</span>
              </div>
            </li>
            <li>
              <span className="members-perks-icon">&#127916;</span>
              <div>
                <strong>{isPt ? 'Bastidores' : 'Behind the scenes'}</strong>
                <span>{isPt ? 'Conteudo que nao aparece em nenhum outro lugar.' : 'Content not available anywhere else.'}</span>
              </div>
            </li>
            <li>
              <span className="members-perks-icon">&#129309;</span>
              <div>
                <strong>{isPt ? 'Apoio direto' : 'Direct support'}</strong>
                <span>{isPt ? 'Mantem a banda independente e criando.' : 'Keeps the band independent and creating.'}</span>
              </div>
            </li>
          </ul>
        </div>

      </div>
      <SupportWidget isPt={isPt} />
    </div>
  );
}