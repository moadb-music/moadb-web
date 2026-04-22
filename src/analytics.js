import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// ── Exclusões de tracking ─────────────────────────────────────────────────────
// Não rastreia localhost nem sessões autenticadas (admin)
function isLocalhost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost');
}

let _adminUser = null;
let _authReady = false;
const _authCallbacks = [];

onAuthStateChanged(auth, (user) => {
  _adminUser = user;
  _authReady = true;
  _authCallbacks.forEach(fn => fn());
  _authCallbacks.length = 0;
});

function whenAuthReady() {
  if (_authReady) return Promise.resolve();
  return new Promise(resolve => _authCallbacks.push(resolve));
}

function shouldSkipTracking() {
  return isLocalhost() || !!_adminUser;
}

function getDeviceType() {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getBrowser() {
  const ua = navigator.userAgent;
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\//i.test(ua)) return 'Opera';
  if (/chrome/i.test(ua) && !/chromium/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  return 'Other';
}

function getOS() {
  const ua = navigator.userAgent;
  if (/windows/i.test(ua)) return 'Windows';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/mac os/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other';
}

const SESSION_KEY = '_moadb_session';
const GEO_KEY = '_moadb_geo';

function getOrCreateSession() {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

async function getCountry() {
  try {
    const cached = sessionStorage.getItem(GEO_KEY);
    if (cached) return cached;
    const res = await fetch('https://ipapi.co/country/', { cache: 'no-store' });
    if (!res.ok) return 'unknown';
    const code = (await res.text()).trim();
    const valid = /^[A-Z]{2}$/.test(code) ? code : 'unknown';
    sessionStorage.setItem(GEO_KEY, valid);
    return valid;
  } catch {
    return 'unknown';
  }
}

// Grava um clique de saída no Firestore usando o SDK (não REST).
// Fire-and-forget: não bloqueia a navegação.
export function trackOutboundClick(label, url, page = 'unknown') {
  try {
    if (shouldSkipTracking()) return;
    const sessionId = getOrCreateSession();
    // addDoc é não-bloqueante — o SDK do Firebase enfileira internamente
    addDoc(collection(db, 'analytics_clicks'), {
      label:     String(label || ''),
      url:       String(url || ''),
      page:      String(page || 'unknown'),
      sessionId: String(sessionId || ''),
      hostname:  window.location.hostname,
      ts:        serverTimestamp(),
    }).catch(() => {});
  } catch {
    // silencioso
  }
}

// ── Listener global ───────────────────────────────────────────────────────────
// Captura qualquer <a href="https://..."> clicado no site.
// Roda no capture phase para pegar antes de qualquer preventDefault.
function installGlobalClickTracker() {
  if (typeof window === 'undefined') return;
  if (window.__moadb_click_tracker_v2) return;
  window.__moadb_click_tracker_v2 = true;

  function handleLinkEvent(e) {
    // auxclick: filtra só botão do meio (button===1)
    if (e.type === 'auxclick' && e.button !== 1) return;

    const anchor = e.composedPath
      ? e.composedPath().find(el => el.tagName === 'A')
      : e.target.closest('a');

    if (!anchor) return;

    const href = anchor.getAttribute ? anchor.getAttribute('href') : anchor.href;
    if (!href || !/^https?:\/\//i.test(href)) return;

    try {
      const parsed = new URL(href);
      if (parsed.hostname === window.location.hostname) return;
    } catch { return; }

    const label =
      (anchor.getAttribute && anchor.getAttribute('aria-label')) ||
      (anchor.getAttribute && anchor.getAttribute('title')) ||
      (anchor.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) ||
      new URL(href).hostname;

    const page = window.location.pathname.startsWith('/tree') ? 'tree' : 'home';

    trackOutboundClick(label, href, page);
  }

  document.addEventListener('click',    handleLinkEvent, true);
  document.addEventListener('auxclick', handleLinkEvent, true);
}

// Instala assim que o módulo é carregado (após hydration do React)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installGlobalClickTracker);
  } else {
    installGlobalClickTracker();
  }
}

export async function trackPageView(page = 'home') {
  try {
    await whenAuthReady();
    if (shouldSkipTracking()) return;
    const sessionId = getOrCreateSession();
    const lang = navigator.language || 'unknown';

    // Tenta capturar referrer: prioriza utm_source na URL, depois document.referrer
    const params = new URLSearchParams(window.location.search);
    const utmSource   = params.get('utm_source');
    const utmMedium   = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');

    let referrer = 'direct';
    if (utmSource) {
      referrer = utmSource;
    } else if (document.referrer) {
      try { referrer = new URL(document.referrer).hostname; } catch {}
    }

    const country = await getCountry();

    await addDoc(collection(db, 'analytics_pageviews'), {
      page,
      sessionId,
      device: getDeviceType(),
      browser: getBrowser(),
      os: getOS(),
      lang: lang.slice(0, 5),
      referrer,
      ...(utmSource   ? { utmSource }   : {}),
      ...(utmMedium   ? { utmMedium }   : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
      country,
      hostname: window.location.hostname,
      screenW: window.screen.width,
      screenH: window.screen.height,
      ts: serverTimestamp(),
    });
  } catch {
    // silencioso
  }
}
