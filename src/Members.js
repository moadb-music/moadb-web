import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
              <p>{isPt ? 'Via PIX, Stripe ou Buy Me a Coffee — mínimo R$ 15,00.' : 'Via PIX, Stripe or Buy Me a Coffee — minimum $5.00 USD.'}{' '}
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
                <div className="members-grid">{music.map((item) => <ContentCard key={item.id} item={item} TYPE_LABEL={TYPE_LABEL} isPt={isPt} />)}</div>
              </section>
            )}
            {videos.length > 0 && (
              <section>
                <p className="members-section-title">🎬 {isPt ? 'VÍDEOS & BASTIDORES' : 'VIDEOS & BEHIND THE SCENES'}</p>
                <div className="members-grid">{videos.map((item) => <ContentCard key={item.id} item={item} TYPE_LABEL={TYPE_LABEL} isPt={isPt} />)}</div>
              </section>
            )}
            {photos.length > 0 && (
              <section>
                <p className="members-section-title">📷 {isPt ? 'FOTOS' : 'PHOTOS'}</p>
                <div className="members-grid">{photos.map((item) => <ContentCard key={item.id} item={item} TYPE_LABEL={TYPE_LABEL} isPt={isPt} />)}</div>
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

function ContentCard({ item, TYPE_LABEL = TYPE_LABEL_PT, isPt = true }) {
  const icon  = TYPE_ICON[item.type]  || '📁';
  const label = TYPE_LABEL[item.type] || (item.type ? item.type.toUpperCase() : '');
  const [modalOpen, setModalOpen] = useState(false);
  const [playing,   setPlaying]   = useState(false);
  const [paused,    setPaused]    = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [current,   setCurrent]   = useState(0);
  const [volume,    setVolume]    = useState(1);
  const [muted,     setMuted]     = useState(false);
  const audioRef = useRef(null);

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setMuted(v === 0);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.volume = next ? 0 : volume || 1;
  };

  const isAudio = item.type === 'audio' || item.type === 'music';
  const isVideo = item.type === 'video';
  const isMedia = isAudio || isVideo;

  // Thumb automática para vídeo
  const [autoThumb, setAutoThumb] = useState('');
  const thumbVideoRef = useRef(null);

  useEffect(() => {
    if (!isVideo || item.thumbUrl || !item.url) return;
    const video = document.createElement('video');
    video.src = item.url;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.currentTime = 1;
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        setAutoThumb(canvas.toDataURL('image/jpeg', 0.7));
      } catch {}
    }, { once: true });
    video.load();
  }, [isVideo, item.thumbUrl, item.url]);

  const isNew = (() => {
    if (!item.createdAt) return false;
    const ts = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
    return (Date.now() - ts.getTime()) < 7 * 24 * 60 * 60 * 1000;
  })();

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  };

  const handleCardClick = () => {
    if (isAudio) { setModalOpen(true); setPlaying(true); setPaused(false); }
  };

  const handlePlayPause = () => {
    if (!playing) { setPlaying(true); setPaused(false); return; }
    if (audioRef.current) {
      if (paused) { audioRef.current.play(); setPaused(false); }
      else        { audioRef.current.pause(); setPaused(true); }
    }
  };

  const handleStop = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setPlaying(false); setPaused(false); setProgress(0); setCurrent(0);
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  };

  const handleClose = () => {
    handleStop();
    setModalOpen(false);
  };

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
    <>
      <div className="members-card" onClick={isAudio ? handleCardClick : undefined} style={isAudio ? { cursor: 'pointer' } : {}}>
        <div className="members-card-thumb-wrap">
          {isNew && <span className="members-card-new-badge">{isPt ? 'NOVO' : 'NEW'}</span>}

          {item.thumbUrl
            ? <img className="members-card-thumb" src={item.thumbUrl} alt={item.title} />
            : (autoThumb
                ? <img className="members-card-thumb" src={autoThumb} alt={item.title} />
                : <div className="members-card-thumb members-card-thumb--placeholder">{icon}</div>
              )
          }

          {/* botão play — só para áudio e vídeo */}
          {isMedia && item.url && (
            <button className="members-card-play" onClick={(e) => { e.stopPropagation(); isAudio ? handleCardClick() : setModalOpen(true); }} aria-label="Play">
              <svg viewBox="0 0 24 24" fill="currentColor" width="44" height="44">
                <path d="M8 5v14l11-7z" fill="var(--red,#8b0000)"/>
              </svg>
            </button>
          )}
        </div>

        <div className="members-card-body">
          <p className="members-card-type">{label}</p>
          <p className="members-card-title">{item.title}</p>
          {item.description && <p className="members-card-desc">{item.description}</p>}
          {item.fileSize && <p className="members-card-meta">{(item.fileSize / 1024 / 1024).toFixed(1)} MB · {isPt ? 'alta qualidade' : 'high quality'}</p>}
          {!isAudio && item.url && (
            <div className="members-card-actions">
              {item.downloadable && (
                <button className="members-card-download" onClick={handleDownload}>⬇ DOWNLOAD</button>
              )}
            </div>
          )}
          {isAudio && item.url && (
            <div className="members-card-actions">
              <button className="members-card-download members-card-play-btn" onClick={(e) => { e.stopPropagation(); handleCardClick(); }}>▶ {isPt ? 'OUVIR' : 'PLAY'}</button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de áudio com letra */}
      {isAudio && modalOpen && createPortal(
        <div className="members-lyrics-overlay" onClick={handleClose}>
          <div className="members-lyrics-modal--wide" onClick={(e) => e.stopPropagation()}>
            <button className="members-lyrics-close--abs" onClick={handleClose} aria-label="Fechar">✕</button>

            {/* coluna esquerda — capa + player */}
            <div className="members-lyrics-cover-col">
              {item.thumbUrl
                ? <img src={item.thumbUrl} alt={item.title} className="members-lyrics-cover-img" />
                : <div className="members-lyrics-cover-placeholder">{icon}</div>
              }
              <p className="members-lyrics-cover-type">{label}</p>
              <p className="members-lyrics-cover-title">{item.title}</p>
              {item.description && <p className="members-lyrics-cover-desc">{item.description}</p>}

              {/* player de áudio */}
              {item.url && (
                <div className="members-modal-player">
                  <audio ref={audioRef} src={item.url} autoPlay={playing && !paused}
                    onTimeUpdate={() => {
                      if (!audioRef.current) return;
                      setCurrent(audioRef.current.currentTime);
                      setProgress(audioRef.current.duration ? audioRef.current.currentTime / audioRef.current.duration : 0);
                    }}
                    onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
                    onEnded={handleStop}
                  />
                  <div className="members-modal-player-bar" onClick={handleSeek}>
                    <div className="members-modal-player-fill" style={{ width: (progress * 100) + '%' }} />
                  </div>
                  <div className="members-modal-player-row">
                    <span className="members-modal-player-time">{fmt(current)}</span>
                    <div className="members-modal-player-btns">
                      <button className="members-modal-player-btn" onClick={handlePlayPause} aria-label={paused ? 'Play' : 'Pause'}>
                        {paused || !playing
                          ? <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M8 5v14l11-7z"/></svg>
                          : <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        }
                      </button>
                      <button className="members-modal-player-btn members-modal-player-btn--stop" onClick={handleStop} aria-label="Stop">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M6 6h12v12H6z"/></svg>
                      </button>
                    </div>
                    <span className="members-modal-player-time">{fmt(duration)}</span>
                  </div>
                  <div className="members-modal-volume-row">
                    <button className="members-modal-volume-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                      {muted || volume === 0
                        ? <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18l1.73 1.73L21 18.46 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                        : volume < 0.5
                          ? <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.5 12A4.5 4.5 0 0 0 16 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                          : <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                      }
                    </button>
                    <input
                      className="members-modal-volume-slider"
                      type="range"
                      min="0" max="1" step="0.02"
                      value={muted ? 0 : volume}
                      onChange={handleVolumeChange}
                      aria-label="Volume"
                      style={{ '--vol-pct': `${Math.round((muted ? 0 : volume) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="members-lyrics-cover-actions">
                <button className="members-card-download" onClick={handleDownload}>⬇ DOWNLOAD</button>
              </div>
            </div>

            {/* coluna direita — letra */}
            <div className="members-lyrics-text-col">
              <p className="members-lyrics-text-label">{isPt ? 'LETRA' : 'LYRICS'}</p>
              {item.lyrics
                ? <pre className="members-lyrics-body">{item.lyrics}</pre>
                : <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem', fontStyle: 'italic' }}>{isPt ? 'Letra não disponível.' : 'Lyrics not available.'}</p>
              }
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de vídeo */}
      {isVideo && modalOpen && createPortal(
        <div className="members-lyrics-overlay" onClick={() => { setModalOpen(false); }}>
          <div className="members-video-modal" onClick={(e) => e.stopPropagation()}>
            <button className="members-lyrics-close--abs" onClick={() => setModalOpen(false)} aria-label="Fechar">✕</button>
            <video
              src={item.url}
              controls
              autoPlay
              playsInline
              style={{ maxWidth: '100%', maxHeight: '80vh', width: 'auto', height: 'auto', borderRadius: 4, display: 'block', margin: '0 auto' }}
            />
            <p className="members-lyrics-cover-title" style={{ marginTop: 12, textAlign: 'center' }}>{item.title}</p>
            {item.downloadable && (
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button className="members-card-download" onClick={handleDownload}>⬇ DOWNLOAD</button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
