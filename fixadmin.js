const fs = require('fs');
const file = 'c:/Users/gui-2/Desktop/DistroKid/Site/moadb-site/src/PaginasAdmin.js';
const lines = fs.readFileSync(file, 'utf8').split('\n');

// Indices (0-based):
// 623: "                  </div>"  — closes DEGRADÊ card
// 624: ""
// 625-643: DIVISOR card (lines 625..643, index 624..642)
// 644: ""
// 645-704: IMAGEM card (lines 645..704, index 644..703)
// 705: "                </div>"  — closes editor-top

const degradeClose = 622;   // index of line 623 (closes degrade card)
const divisorStart = 624;   // index of line 625
const divisorEnd   = 642;   // index of line 643 (last line of divisor card)
const imageStart   = 644;   // index of line 645
const imageEnd     = 703;   // index of line 704 (last line of image card)
const editorTopClose = 704; // index of line 705

const degradeBlock = lines.slice(0, degradeClose + 1);
const divisorBlock = lines.slice(divisorStart, divisorEnd + 1);
const imageBlock   = lines.slice(imageStart, imageEnd + 1);
const afterBlock   = lines.slice(editorTopClose);

// New structure:
// - open a 2-col grid wrapper
// - DEGRADÊ card (already in degradeBlock, but we need to wrap it)
// - IMAGEM card
// - close grid
// - DIVISOR card (full width)
// - close editor-top div

const gridOpen  = ['                  <div style={{ display: \'grid\', gridTemplateColumns: \'1fr 1fr\', gap: 14 }}>'];
const gridClose = ['                  </div>'];
const dividerWithMargin = divisorBlock.map((l, i) => {
  // add marginTop to the outer div of divisor card
  if (i === 0) return l.replace('admin-card admin-pages-card">', 'admin-card admin-pages-card" style={{ marginTop: 14 }}>');
  return l;
});

const result = [
  ...degradeBlock.slice(0, -1), // everything up to (not including) the closing </div> of editor-top wrapper
  ...gridOpen,
  // re-indent degrade card close
  degradeBlock[degradeBlock.length - 1],
  ...imageBlock,
  ...gridClose,
  ...dividerWithMargin,
  ...afterBlock,
];

fs.writeFileSync(file, result.join('\n'), 'utf8');
console.log('Done. Lines:', result.length);
