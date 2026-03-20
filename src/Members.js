import { useEffect, useState, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { Navigate } from 'react-router-dom';
import {
  doc, onSnapshot, updateDoc, setDoc,
  collection, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from './authContext';
import { auth, db, storage } from './firebase';
import SiteNav from './components/SiteNav';
import SupportWidget from './components/SupportWidget';
import './App.css';
import './Members.css';

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

const TYPE_LABEL_PT = { music: 'MÚSICA', video: 'VÍDEO', photo: 'FOTO' };
const TYPE_LABEL_EN = { music: 'MUSIC',  video: 'VIDEO', photo: 'PHOTO' };
const TYPE_ICON     = { music: '🎵', video: '🎬', photo: '📷' };

function ComprovanteForm({ user, onSent, mode = 'new', isPt = true }) {
  const [msg,     setMsg]     = useState('');
  const [file,    setFile]    = useState(null);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!msg.trim() && !file) {
      setError(isPt ? 'Adicione uma mensagem ou anexe o comprovante.' : 'Add a message or attach the receipt.');
      return;
    }
    setSending(true); setError('');
    try {
      let proofUrl = null;
      if (file) {
        const storageRef = ref(storage, 'member-proofs/' + user.uid + '/' + Date.now() + '_' + file.name);
        await uploadBytes(storageRef, file);
        proofUrl = await getDownloadURL(storageRef);
      }
      await updateDoc(doc(db, 'members', user.uid), {
        proofMessage: msg.trim(),
        proofUrl: proofUrl || null,
        proofSentAt: serverTimestamp(),
      });
      onSent();
    } catch (err) {
      setError((isPt ? 'Erro ao enviar: ' : 'Error sending: ') + err.message);
    } finally { setSending(false); }
  };

  const isRenew = mode === 'renew';
  const instructions = isRenew ? {
    icon: '🔄',
    title: isPt ? 'RENOVAR ACESSO' : 'RENEW ACCESS',
    intro: isPt ? 'Seu acesso foi revogado. Faça uma nova contribuição e envie o comprovante para reativar.' : 'Your access was revoked. Make a new contribution and send the receipt to reactivate.',
    step3label: isPt ? 'Aguarde a reativação' : 'Wait for reactivation',
    step3text:  isPt ? 'Confirmamos manualmente e reativamos o acesso em breve.' : 'We confirm manually and reactivate your access shortly.',
  } : {
    icon: '🎵',
    title: isPt ? 'QUASE LÁ!' : 'ALMOST THERE!',
    intro: isPt ? 'Para liberar o acesso ao conteúdo exclusivo, confirme sua contribuição enviando um comprovante abaixo.' : 'To unlock exclusive content, confirm your contribution by sending a receipt below.',
    step3label: isPt ? 'Aguarde a aprovação' : 'Wait for approval',
    step3text:  isPt ? 'Confirmamos manualmente e liberamos o acesso em breve.' : 'We confirm manually and grant access shortly.',
  };

  return (
    <div className="members-proof-wrap">
      <div className="members-proof-instructions">
        <span className="members-proof-step-icon">{instructions.icon}</span>
        <h2 className="members-proof-main-title">{instructions.title}</h2>
        <p className="members-proof-intro">{instructions.intro}</p>
        <div className="members-proof-steps">
          <div className="members-proof-step">
            <span className="members-proof-step-num">1</span>
            <div>
              <strong>{isPt ? 'Faça sua contribuição' : 'Make your contribution'}</strong>
              <p>{isPt ? 'Via PIX, Stripe ou Buy Me a Coffee.' : 'Via PIX, Stripe or Buy Me a Coffee.'}{' '}
                <a href="/donate" className="members-proof-link">{isPt ? 'Ver opções →' : 'See options →'}</a>
              </p>
            </div>
          </div>
          <div className="members-proof-step">
            <span className="members-proof-step-num">2</span>
            <div>
              <strong>{isPt ? 'Envie o comprovante' : 'Send the receipt'}</strong>
              <p>{isPt ? 'Anexe o print ou PDF e escreva uma mensagem identificando o método usado.' : 'Attach the screenshot or PDF and write a message identifying the payment method.'}</p>
            </div>
          </div>
          <div className="members-proof-step">
            <span className="members-proof-step-num">3</span>
            <div>
              <strong>{instructions.step3label}</strong>
              <p>{instructions.step3text}</p>
            </div>
          </div>
        </div>
      </div>
      <form className="members-proof-form" onSubmit={handleSubmit}>
        <p className="members-proof-title">{isPt ? 'ENVIAR COMPROVANTE' : 'SEND RECEIPT'}</p>
        <textarea className="members-login-input"
          placeholder={isPt ? 'Ex: Paguei via PIX em 15/06, chave: email@exemplo.com' : 'E.g.: Paid via Stripe on 06/15, transaction ID: abc123'}
          rows={3} value={msg} onChange={(e) => setMsg(e.target.value)}
          style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
        <label className="members-proof-file-label">
          <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0])} style={{ display: 'none' }} />
          <span className="members-proof-file-btn">
            📎 {file ? file.name : (isPt ? 'ANEXAR COMPROVANTE (imagem ou PDF)' : 'ATTACH RECEIPT (image or PDF)')}
          </span>
        </label>
        {error && <p className="members-login-error">{error}</p>}
        <button className="members-login-btn members-login-btn--email" type="submit" disabled={sending}>
          {sending ? (isPt ? 'ENVIANDO...' : 'SENDING...') : (isPt ? 'ENVIAR COMPROVANTE' : 'SEND RECEIPT')}
        </button>
      </form>
    </div>
  );
}

function StatusToast({ status, onClose, isPt = true }) {
  useEffect(() => { const t = setTimeout(onClose, 7000); return () => clearTimeout(t); }, [onClose]);
  const config = {
    approved: { icon: '✅', msg: isPt ? 'Seu acesso foi aprovado! Bem-vindo(a).' : 'Your access has been approved! Welcome.', color: '#4caf50' },
    rejected: { icon: '❌', msg: isPt ? 'Sua solicitação foi rejeitada.' : 'Your request was rejected.', color: '#ef5350' },
    revoked:  { icon: '🚫', msg: isPt ? 'Seu acesso foi revogado.' : 'Your access has been revoked.', color: '#ef5350' },
  }[status];
  if (!config) return null;
  return (
    <div className="members-toast" style={{ borderColor: config.color }}>
      <span>{config.icon}</span>
      <span style={{ color: config.color }}>{config.msg}</span>
      <button className="members-toast-close" onClick={onClose}>×</button>
    </div>
  );
}

export default function Members() {
  const { user, loading: authLoading } = useAuth();
  const [member,    setMember]    = useState(undefined);
  const [content,   setContent]   = useState([]);
  const [pagesBg,   setPagesBg]   = useState(null);
  const [proofSent, setProofSent] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [toast,     setToast]     = useState(null);
  const [lang,      setLang]      = useState(() => {
    const nav = navigator.languages?.[0] || navigator.language || 'pt-BR';
    return nav.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  });
  const isPt = lang === 'pt-BR';
  const prevStatus = useRef(null);

  useEffect(() => {
    document.body.classList.remove('show-bmc');
    return () => document.body.classList.remove('show-bmc');
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'members', user.uid), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      const newStatus = data ? (data.status || (data.approved ? 'approved' : 'pending')) : null;
      if (prevStatus.current !== null && prevStatus.current !== newStatus && newStatus) {
        if (['approved', 'rejected', 'revoked'].includes(newStatus)) setToast(newStatus);
      }
      prevStatus.current = newStatus;
      setMember(data);
    });
  }, [user]);

  useEffect(() => {
    if (!member?.approved) return;
    const q = query(collection(db, 'membersContent'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setContent(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [member?.approved]);

  useEffect(() => {
    return onSnapshot(doc(db, 'siteData', 'moadb_pages'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const c = d?.content ?? d;
        setPagesBg(c?.backgroundsBySection?.main ?? null);
      }
    });
  }, []);

  const handleLogout = () => signOut(auth);
  const bgStyle = applyBg(pagesBg);
  const logoutBtn = (
    <button className="members-logout-btn members-logout-btn--nav" onClick={handleLogout}>
      {isPt ? 'SAIR' : 'LOGOUT'}
    </button>
  );

  if (authLoading) return null;
  if (!user) return <Navigate to="/members/login" replace />;

  // Loading
  if (member === undefined) {
    return (
      <div className="app-container members-page">
        <div className="bg-layer" aria-hidden="true" style={bgStyle} />
        <SiteNav lang={lang} setLang={setLang} extraEnd={logoutBtn} />
        <div className="members-pending">
          <div className="members-pending-card" style={{ gap: 12 }}>
            <span className="members-pending-icon" style={{ fontSize: '1.8rem' }}>⏳</span>
            <p className="members-pending-title" style={{ fontSize: '1rem' }}>{isPt ? 'Carregando...' : 'Loading...'}</p>
          </div>
        </div>
        <SupportWidget isPt={isPt} />
      </div>
    );
  }

  // New member
  if (member === null) {
    setDoc(doc(db, 'members', user.uid), {
      uid: user.uid, email: user.email,
      name: user.displayName || user.email?.split('@')[0] || 'Membro',
      approved: false, status: 'pending', createdAt: serverTimestamp(),
    }, { merge: true }).catch(() => {});
    return (
      <div className="app-container members-page">
        <div className="bg-layer" aria-hidden="true" style={bgStyle} />
        <SiteNav lang={lang} setLang={setLang} extraEnd={logoutBtn} />
        <div className="members-pending members-pending--wide">
          <ComprovanteForm user={user} onSent={() => setProofSent(true)} isPt={isPt} />
        </div>
        <SupportWidget isPt={isPt} />
      </div>
    );
  }

  const status = member.status || (member.approved ? 'approved' : 'pending');

  // Revoked — proof sent
  if (status === 'revoked' && proofSent) {
    return (
      <div className="app-container members-page">
        <div className="bg-layer" aria-hidden="true" style={bgStyle} />
        <SiteNav lang={lang} setLang={setLang} extraEnd={logoutBtn} />
        <div className="members-pending">
          <div className="members-pending-card">
            <span className="members-pending-icon">⏳</span>
            <h1 className="members-pending-title">{isPt ? 'Comprovante enviado' : 'Receipt sent'}</h1>
            <p className="members-pending-text">
              {isPt ? 'Recebemos seu comprovante de renovação. Assim que confirmarmos, o acesso será reativado.' : 'We received your renewal receipt. Once confirmed, your access will be reactivated.'}
            </p>
            <div className="members-status-info">
              <span className="members-badge members-badge--pending">⏳ {isPt ? 'AGUARDANDO' : 'PENDING'}</span>
              <span className="members-user-name">{member.email}</span>
            </div>
          </div>
        </div>
        <SupportWidget isPt={isPt} />
      </div>
    );
  }

  // Revoked — renew form or revoked screen
  if (status === 'revoked') {
    if (showRenew) {
      return (
        <div className="app-container members-page">
          <div className="bg-layer" aria-hidden="true" style={bgStyle} />
          {toast && <StatusToast status={toast} onClose={() => setToast(null)} isPt={isPt} />}
          <SiteNav lang={lang} setLang={setLang} extraEnd={logoutBtn} />
          <div className="members-pending members-pending--wide">
            <ComprovanteForm user={user} onSent={() => setProofSent(true)} mode="renew" isPt={isPt} />
          </div>
          <SupportWidget isPt={isPt} />
        </div>
      );
    }
    return (
      <div className="app-container members-page">
        <div className="bg-layer" aria-hidden="true" style={bgStyle} />
        {toast && <StatusToast status={toast} onClose={() => setToast(null)} isPt={isPt} />}
        <SiteNav lang={lang} setLang={setLang} extraEnd={logoutBtn} />
        <div className="members-pending">
          <div className="members-pending-card">
            <span className="members-pending-icon">🔒</span>
            <h1 className="members-pending-title">{isPt ? 'Acesso revogado' : 'Access revoked'}</h1>
            <p className="members-pending-text">
              {isPt ? 'Seu acesso foi revogado. Para reativar, entre em contato e envie um novo comprovante.' : 'Your access has been revoked. To reactivate, contact us and send a new receipt.'}
            </p>
            <div className="members-status-info">
              <span className="members-badge members-badge--denied">✕ {isPt ? 'REVOGADO' : 'REVOKED'}</span>
              <span className="members-user-name">{member.email}</span>
            </div>
            <button className="members-login-btn members-login-btn--email" style={{ marginTop: 8 }} onClick={() => setShowRenew(true)}>
              {isPt ? 'ENTRAR EM CONTATO' : 'CONTACT US'}
            </button>
          </div>
        </div>
        <SupportWidget isPt={isPt} />
      </div>
    );
  }

  // Rejected
  if (status === 'rejected') {
    return (
      <div className="app-container members-page">
        <div className="bg-layer" aria-hidden="true" style={bgStyle} />
        {toast && <StatusToast status={toast} onClose={() => setToast(null)} isPt={isPt} />}
        <SiteNav lang={lang} setLang={setLang} extraEnd={logoutBtn} />
        <div className="members-pending">
          <div className="members-pending-card">
            <span className="members-pending-icon">❌</span>
            <h1 className="members-pending-title">{isPt ? 'Acesso negado' : 'Access denied'}</h1>
            <p className="members-pending-text">
              {isPt ? 'Sua solicitação não foi aprovada. Entre em contato se acredita que houve um engano.' : 'Your request was not approved. Contact us if you believe this was a mistake.'}
            </p>
            <div className="members-status-info">
              <span className="members-badge members-badge--denied">✕ {isPt ? 'REJEITADO' : 'REJECTED'}</span>
              <span className="members-user-name">{member.email}</span>
            </div>
            <a href="/#contato" className="members-login-btn members-login-btn--email" style={{ textDecoration: 'none', marginTop: 8 }}>
              {isPt ? 'ENTRAR EM CONTATO' : 'CONTACT US'}
            </a>
          </div>
        </div>
        <SupportWidget isPt={isPt} />
      </div>
    );
  }

  // Pending
  if (!member.approved) {
    const hasSentProof = member.proofSentAt || proofSent;
    return (
      <div className="app-container members-page">
        <div className="bg-layer" aria-hidden="true" style={bgStyle} />
        {toast && <StatusToast status={toast} onClose={() => setToast(null)} isPt={isPt} />}
        <SiteNav lang={lang} setLang={setLang} extraEnd={logoutBtn} />
        <div className={hasSentProof ? 'members-pending' : 'members-pending members-pending--wide'}>
          {hasSentProof ? (
            <div className="members-pending-card">
              <span className="members-pending-icon">⏳</span>
              <h1 className="members-pending-title">{isPt ? 'Aguardando aprovação' : 'Awaiting approval'}</h1>
              <p className="members-pending-text">
                {isPt ? 'Comprovante recebido! Assim que confirmarmos, o acesso será liberado.' : 'Receipt received! Once confirmed, your access will be granted.'}
              </p>
              <div className="members-status-info">
                <span className="members-badge members-badge--pending">⏳ {isPt ? 'PENDENTE' : 'PENDING'}</span>
                <span className="members-user-name">{member.email}</span>
              </div>
            </div>
          ) : (
            <ComprovanteForm user={user} onSent={() => setProofSent(true)} isPt={isPt} />
          )}
        </div>
        <SupportWidget isPt={isPt} />
      </div>
    );
  }

  // Approved — content area
  const music  = content.filter((c) => c.type === 'music');
  const videos = content.filter((c) => c.type === 'video');
  const photos = content.filter((c) => c.type === 'photo');
  const TYPE_LABEL = isPt ? TYPE_LABEL_PT : TYPE_LABEL_EN;

  return (
    <div className="app-container members-page">
      <div className="bg-layer" aria-hidden="true" style={bgStyle} />
      {toast && <StatusToast status={toast} onClose={() => setToast(null)} isPt={isPt} />}
      <SiteNav lang={lang} setLang={setLang} extraEnd={logoutBtn} />
      <main className="members-main">
        <div className="members-header">
          <div>
            <h1 className="members-welcome">{isPt ? 'ÁREA DE MEMBROS' : 'MEMBERS AREA'}</h1>
            <div className="members-status-row">
              <span className="members-badge">✔ {isPt ? 'MEMBRO ATIVO' : 'ACTIVE MEMBER'}</span>
              <span className="members-user-name">{member.name || user.email}</span>
            </div>
            {member.expiresAt && <MemberExpiry expiresAt={member.expiresAt} isPt={isPt} />}
          </div>
        </div>
        {content.length === 0 ? (
          <div className="members-empty-state">
            <span style={{ fontSize: '2.5rem' }}>🎵</span>
            <p className="members-empty-title">{isPt ? 'Em breve' : 'Coming soon'}</p>
            <p className="members-empty-sub">{isPt ? 'Conteúdo exclusivo está sendo preparado. Obrigado pelo apoio.' : 'Exclusive content is being prepared. Thank you for your support.'}</p>
          </div>
        ) : (
          <>
            {music.length > 0 && (
              <section>
                <p className="members-section-title">🎵 {isPt ? 'MÚSICAS EXCLUSIVAS' : 'EXCLUSIVE TRACKS'}</p>
                <div className="members-grid">{music.map((item) => <ContentCard key={item.id} item={item} TYPE_LABEL={TYPE_LABEL} />)}</div>
              </section>
            )}
            {videos.length > 0 && (
              <section>
                <p className="members-section-title">🎬 {isPt ? 'VÍDEOS & BASTIDORES' : 'VIDEOS & BEHIND THE SCENES'}</p>
                <div className="members-grid">{videos.map((item) => <ContentCard key={item.id} item={item} TYPE_LABEL={TYPE_LABEL} />)}</div>
              </section>
            )}
            {photos.length > 0 && (
              <section>
                <p className="members-section-title">📷 {isPt ? 'FOTOS' : 'PHOTOS'}</p>
                <div className="members-grid">{photos.map((item) => <ContentCard key={item.id} item={item} TYPE_LABEL={TYPE_LABEL} />)}</div>
              </section>
            )}
          </>
        )}
      </main>
      <SupportWidget isPt={isPt} />
    </div>
  );
}

function MemberExpiry({ expiresAt, isPt = true }) {
  const ms   = expiresAt?.toMillis ? expiresAt.toMillis() : (expiresAt?.seconds || 0) * 1000;
  const days = Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24));
  const locale = isPt ? 'pt-BR' : 'en-US';
  const date = new Date(ms).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });

  if (days <= 0) {
    return (
      <div className="members-expiry members-expiry--expired">
        <span>⚠</span>
        <span>{isPt ? `Acesso expirado em ${date}. Renove sua contribuição para continuar.` : `Access expired on ${date}. Renew your contribution to continue.`}</span>
        <a href="/donate" className="members-expiry-link">{isPt ? 'Renovar →' : 'Renew →'}</a>
      </div>
    );
  }

  const urgent = days <= 5;
  return (
    <div className={`members-expiry${urgent ? ' members-expiry--urgent' : ''}`}>
      <span>{urgent ? '⚠' : '🗓'}</span>
      <span>
        {isPt
          ? <>{`Acesso válido até `}<strong>{date}</strong>{urgent ? ` — faltam apenas ${days} dia${days === 1 ? '' : 's'}!` : ` (${days} dias restantes)`}</>
          : <>{`Access valid until `}<strong>{date}</strong>{urgent ? ` — only ${days} day${days === 1 ? '' : 's'} left!` : ` (${days} days remaining)`}</>
        }
      </span>
      {urgent && <a href="/donate" className="members-expiry-link">{isPt ? 'Renovar →' : 'Renew →'}</a>}
    </div>
  );
}

function ContentCard({ item, TYPE_LABEL = TYPE_LABEL_PT }) {
  const icon  = TYPE_ICON[item.type]  || '📁';
  const label = TYPE_LABEL[item.type] || (item.type ? item.type.toUpperCase() : '');

  const handleDownload = async () => {
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = item.fileName || item.title || 'download';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(item.url, '_blank');
    }
  };

  return (
    <div className="members-card">
      {item.thumbUrl
        ? <img className="members-card-thumb" src={item.thumbUrl} alt={item.title} />
        : <div className="members-card-thumb members-card-thumb--placeholder">{icon}</div>
      }
      <div className="members-card-body">
        <p className="members-card-type">{label}</p>
        <p className="members-card-title">{item.title}</p>
        {item.description && <p className="members-card-desc">{item.description}</p>}
        {item.fileSize && <p className="members-card-meta">{(item.fileSize / 1024 / 1024).toFixed(1)} MB · high quality</p>}
        <div className="members-card-actions">
          {item.url && <button className="members-card-download" onClick={handleDownload}>⬇ DOWNLOAD</button>}
        </div>
      </div>
    </div>
  );
}
