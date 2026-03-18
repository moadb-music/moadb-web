const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'App.css');
let css = fs.readFileSync(file, 'utf8');

// Remove the entire broken section from after .section-bg-image { background-attachment: fixed; }
// up to (but not including) /* NEWS */ .news-empty block
// Strategy: find the marker before and after, replace the whole chunk

const BEFORE_MARKER = '.section-bg-image {\n\n  background-size: cover;\n  background-position: center;\n\n  background-repeat: no-repeat;\n  background-attachment: fixed;\n\n}';
const AFTER_MARKER = '/* Feedback (carregando/sem itens/erro) */';

const startIdx = css.indexOf(BEFORE_MARKER);
const endIdx = css.indexOf(AFTER_MARKER);

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found', { startIdx, endIdx });
  process.exit(1);
}

const replacement = `.section-bg-image {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
}

.hero, .about, .shop, .news, .discography, .contact {
  position: relative;
}

.section-bg-gradient,
.section-bg-image,
.section-divider--line,
.section-divider--fade {
  position: absolute;
  z-index: 0;
}

.hero > *:not(.section-bg-gradient):not(.section-bg-image):not(.section-divider--line):not(.section-divider--fade),
.about > *:not(.section-bg-gradient):not(.section-bg-image):not(.section-divider--line):not(.section-divider--fade),
.shop > *:not(.section-bg-gradient):not(.section-bg-image):not(.section-divider--line):not(.section-divider--fade),
.news > *:not(.section-bg-gradient):not(.section-bg-image):not(.section-divider--line):not(.section-divider--fade),
.discography > *:not(.section-bg-gradient):not(.section-bg-image):not(.section-divider--line):not(.section-divider--fade),
.contact > *:not(.section-bg-gradient):not(.section-bg-image):not(.section-divider--line):not(.section-divider--fade) {
  position: relative;
  z-index: 1;
}

/* NEWS */
.news{
  min-height:100vh;
  display:flex;
  align-items:flex-start;
  justify-content:center;
  padding:120px 20px 90px;
}

`;

const newCss = css.slice(0, startIdx) + replacement + css.slice(endIdx);
fs.writeFileSync(file, newCss, 'utf8');
console.log('Done. Replaced', endIdx - startIdx, 'chars');
