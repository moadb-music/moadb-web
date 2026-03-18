const fs = require('fs');
const file = 'c:/Users/gui-2/Desktop/DistroKid/Site/moadb-site/src/App.css';
const lines = fs.readFileSync(file, 'utf8').split('\n');

// line 664 (index 663) is orphaned "  width:100%;" — remove it, it's already inside .news-empty
lines.splice(663, 1);

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Done. Total lines:', lines.length);
