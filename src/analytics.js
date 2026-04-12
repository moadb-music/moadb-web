import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

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

// Busca país via ipapi.co (HTTPS gratuito, sem key, 1000req/dia)
// Cacheia no sessionStorage para não repetir por sessão
async function getCountry() {
  try {
    const cached = sessionStorage.getItem(GEO_KEY);
    if (cached) return cached;
    const res = await fetch('https://ipapi.co/country/', { cache: 'no-store' });
    if (!res.ok) return 'unknown';
    const code = (await res.text()).trim();
    // resposta é só o código ex: "BR" — valida 2 letras
    const valid = /^[A-Z]{2}$/.test(code) ? code : 'unknown';
    sessionStorage.setItem(GEO_KEY, valid);
    return valid;
  } catch {
    return 'unknown';
  }
}

export async function trackPageView(page = 'home') {
  try {
    const sessionId = getOrCreateSession();
    const lang = navigator.language || 'unknown';
    const referrer = document.referrer ? new URL(document.referrer).hostname : 'direct';
    const country = await getCountry();

    await addDoc(collection(db, 'analytics_pageviews'), {
      page,
      sessionId,
      device: getDeviceType(),
      browser: getBrowser(),
      os: getOS(),
      lang: lang.slice(0, 5),
      referrer,
      country,
      screenW: window.screen.width,
      screenH: window.screen.height,
      ts: serverTimestamp(),
    });
  } catch (e) {
    // silencioso
  }
}
