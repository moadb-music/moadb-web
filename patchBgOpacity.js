const fs = require('fs');
let c = fs.readFileSync('src/App.js', 'utf8');

const oldFn = `function normalizeBgSection(bg) {\r\n  if (!bg) return null;\r\n  const angle = Math.max(0, Math.min(360, parseFloat(bg.gradientAngle) || 180));\r\n  const from = alphaHexBg(bg.gradientFrom || '#000000', bg.gradientOpacity ?? 1);\r\n  const to = alphaHexBg(bg.gradientTo || '#120000', bg.gradientOpacity ?? 1);\r\n  const grad = bg.gradientEnabled !== false ? \`linear-gradient(\${angle}deg, \${from}, \${to})\` : null;\r\n  const img = bg.imageEnabled !== false && bg.imageUrl ? \`url('\${bg.imageUrl}')\` : null;\r\n  const parts = [grad, img].filter(Boolean);\r\n  if (!parts.length) return null;\r\n  return {\r\n    backgroundImage: parts.join(', '),\r\n    backgroundSize: 'cover',\r\n    backgroundPosition: 'center',\r\n    '--section-img-opacity': bg.imageEnabled !== false ? clamp01bg(bg.imageOpacity ?? 0.35) : 0,\r\n  };\r\n}`;

const newFn = `function normalizeBgSection(bg) {\r\n  if (!bg) return null;\r\n  const angle = Math.max(0, Math.min(360, parseFloat(bg.gradientAngle) || 180));\r\n  const from = alphaHexBg(bg.gradientFrom || '#000000', bg.gradientOpacity ?? 1);\r\n  const to = alphaHexBg(bg.gradientTo || '#120000', bg.gradientOpacity ?? 1);\r\n  const hasGrad = bg.gradientEnabled !== false;\r\n  const hasImg = bg.imageEnabled !== false && bg.imageUrl;\r\n  if (!hasGrad && !hasImg) return null;\r\n  return {\r\n    ...(hasGrad ? { backgroundImage: \`linear-gradient(\${angle}deg, \${from}, \${to})\` } : {}),\r\n    '--section-bg-image': hasImg ? \`url('\${bg.imageUrl}')\` : 'none',\r\n    '--section-bg-opacity': hasImg ? clamp01bg(bg.imageOpacity ?? 0.35) : 0,\r\n  };\r\n}`;

if (!c.includes(oldFn)) { console.error('NOT FOUND'); process.exit(1); }
c = c.replace(oldFn, newFn);
fs.writeFileSync('src/App.js', c);
console.log('OK');
