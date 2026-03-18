const fs = require('fs');
let c = fs.readFileSync('src/App.js', 'utf8');

// 1. Replace one-shot getDoc with onSnapshot for pages (real-time)
const oldLoadPages = `  useEffect(() => {\r\n    let cancelled = false;\r\n    async function loadPages() {\r\n      try {\r\n        const ref = doc(db, ...PAGES_DOC_PATH);\r\n        const snap = await getDoc(ref);\r\n        if (!snap.exists()) return;\r\n        const data = snap.data();\r\n        const content = data?.content ?? data;\r\n        if (!cancelled) setPagesContent(content);\r\n      } catch {\r\n        // silencioso: mantém placeholders\r\n      }\r\n    }\r\n    loadPages();`;

const newLoadPages = `  useEffect(() => {\r\n    const unsubPages = onSnapshot(\r\n      doc(db, ...PAGES_DOC_PATH),\r\n      (snap) => {\r\n        if (!snap.exists()) return;\r\n        const data = snap.data();\r\n        const content = data?.content ?? data;\r\n        setPagesContent(content);\r\n      },\r\n      () => { /* silencioso */ }\r\n    );\r\n    return () => unsubPages();\r\n    // eslint-disable-next-line\r\n    if (false) {`;

if (!c.includes(oldLoadPages)) { console.error('loadPages NOT FOUND'); process.exit(1); }
c = c.replace(oldLoadPages, newLoadPages);

// Find the closing of that useEffect and fix it (remove the old return/cancelled logic)
const oldLoadPagesEnd = `    loadPages();\r\n `;
// Actually let's find the full end
const oldPagesEffectEnd = `    return () => {\r\n      cancelled = true;\r\n    };\r\n  }, []);`;
const newPagesEffectEnd = `    }\r\n  }, []);`;

if (!c.includes(oldPagesEffectEnd)) { console.error('pagesEffectEnd NOT FOUND'); process.exit(1); }
c = c.replace(oldPagesEffectEnd, newPagesEffectEnd);

// 2. Add normalizeBackgroundsFromPagesDoc helper after normalizeAboutFromPagesDoc
const oldNormalizeAboutEnd = `function normalizeAboutFromPagesDoc(raw) {`;
const newNormalizeAboutEnd = `function clamp01bg(n) { const v = parseFloat(n); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; }\r\nfunction alphaHexBg(color, opacity) {\r\n  const c = typeof color === 'string' ? color : '#000000';\r\n  if (!/^#([0-9a-fA-F]{6})$/.test(c)) return c;\r\n  return c + Math.round(clamp01bg(opacity) * 255).toString(16).padStart(2, '0');\r\n}\r\nfunction normalizeBgSection(bg) {\r\n  if (!bg) return null;\r\n  const angle = Math.max(0, Math.min(360, parseFloat(bg.gradientAngle) || 180));\r\n  const from = alphaHexBg(bg.gradientFrom || '#000000', bg.gradientOpacity ?? 1);\r\n  const to = alphaHexBg(bg.gradientTo || '#120000', bg.gradientOpacity ?? 1);\r\n  const grad = bg.gradientEnabled !== false ? \`linear-gradient(\${angle}deg, \${from}, \${to})\` : null;\r\n  const img = bg.imageEnabled !== false && bg.imageUrl ? \`url('\${bg.imageUrl}')\` : null;\r\n  const parts = [grad, img].filter(Boolean);\r\n  if (!parts.length) return null;\r\n  return {\r\n    backgroundImage: parts.join(', '),\r\n    backgroundSize: 'cover',\r\n    backgroundPosition: 'center',\r\n    '--section-img-opacity': bg.imageEnabled !== false ? clamp01bg(bg.imageOpacity ?? 0.35) : 0,\r\n  };\r\n}\r\nfunction normalizeAboutFromPagesDoc(raw) {`;

if (!c.includes(oldNormalizeAboutEnd)) { console.error('normalizeAbout NOT FOUND'); process.exit(1); }
c = c.replace(oldNormalizeAboutEnd, newNormalizeAboutEnd);

// 3. Add pagesBgs derived from pagesContent
const oldAboutFromDb = `  const aboutFromDb = useMemo(() => normalizeAboutFromPagesDoc(pagesContent || {}), [pagesContent]);`;
const newAboutFromDb = `  const aboutFromDb = useMemo(() => normalizeAboutFromPagesDoc(pagesContent || {}), [pagesContent]);\r\n  const pagesBgs = useMemo(() => {\r\n    const bgs = pagesContent?.backgroundsBySection || {};\r\n    const result = {};\r\n    ['main','home','sobre','loja','noticias','discografia','contato'].forEach(k => {\r\n      const s = normalizeBgSection(bgs[k]);\r\n      if (s) result[k] = s;\r\n    });\r\n    return result;\r\n  }, [pagesContent]);`;

if (!c.includes(oldAboutFromDb)) { console.error('aboutFromDb NOT FOUND'); process.exit(1); }
c = c.replace(oldAboutFromDb, newAboutFromDb);

// 4. Apply bg styles to each section
const sections = [
  { id: 'inicio', key: 'home', cls: 'hero' },
  { id: 'sobre', key: 'sobre', cls: 'about' },
  { id: 'noticias', key: 'noticias', cls: 'news' },
  { id: 'discografia', key: 'discografia', cls: 'discography' },
  { id: 'loja', key: 'loja', cls: 'shop' },
  { id: 'contato', key: 'contato', cls: 'contact' },
];

for (const { id, key, cls } of sections) {
  const oldSection = `id="${id}" className="${cls}"`;
  const newSection = `id="${id}" className="${cls}" style={pagesBgs['${key}'] || undefined}`;
  if (!c.includes(oldSection)) { console.error(`section ${id} NOT FOUND`); process.exit(1); }
  c = c.replace(oldSection, newSection);
}

fs.writeFileSync('src/App.js', c);
console.log('OK');
