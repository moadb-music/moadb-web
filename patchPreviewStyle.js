const fs = require('fs');
let c = fs.readFileSync('src/PaginasAdmin.js', 'utf8');

const oldFn = `function backgroundToPreviewStyle(bg) {\r\n  const enabled = bg.gradientEnabled !== false;\r\n  const imagesOn = bg.imageEnabled !== false;\r\n\r\n  const from = enabled ? alphaHex(bg.gradientFrom, bg.gradientOpacity) : 'transparent';\r\n  const to = enabled ? alphaHex(bg.gradientTo, bg.gradientOpacity) : 'transparent';\r\n\r\n  const style = {\r\n    backgroundImage: \`linear-gradient(\${clampAngle(bg.gradientAngle)}deg, \${from}, \${to})\`,\r\n    backgroundPosition: 'center',\r\n    backgroundSize: 'cover',\r\n    backgroundRepeat: 'no-repeat',\r\n    '--admin-bg-image': imagesOn && bg.imageUrl ? \`url('\${bg.imageUrl}')\` : 'none',\r\n    '--adminImageOpacity': imagesOn ? clamp01(bg.imageOpacity) : 0,\r\n  };\r\n\r\n  return style;\r\n}`;

const newFn = `function backgroundToPreviewStyle(bg) {\r\n  const hasGrad = bg.gradientEnabled !== false;\r\n  const hasImg = bg.imageEnabled !== false && bg.imageUrl;\r\n  const from = hasGrad ? alphaHex(bg.gradientFrom, bg.gradientOpacity) : 'transparent';\r\n  const to = hasGrad ? alphaHex(bg.gradientTo, bg.gradientOpacity) : 'transparent';\r\n  return {\r\n    ...(hasGrad ? { backgroundImage: \`linear-gradient(\${clampAngle(bg.gradientAngle)}deg, \${from}, \${to})\` } : {}),\r\n    '--section-bg-image': hasImg ? \`url('\${bg.imageUrl}')\` : 'none',\r\n    '--section-bg-opacity': hasImg ? clamp01(bg.imageOpacity) : 0,\r\n  };\r\n}`;

if (!c.includes(oldFn)) { console.error('NOT FOUND'); process.exit(1); }
c = c.replace(oldFn, newFn);
fs.writeFileSync('src/PaginasAdmin.js', c);
console.log('OK');
