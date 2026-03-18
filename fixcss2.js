const fs = require('fs');
const file = 'c:/Users/gui-2/Desktop/DistroKid/Site/moadb-site/src/App.css';
const lines = fs.readFileSync(file, 'utf8').split('\n');

// Fix 1: remove duplicate line 635 (index 634) — extra ".hero, .about..." 
lines.splice(634, 1);

// After splice, .news-empty block lost its selector — now at index 664 (was 665)
// Insert the missing selector before the orphaned properties
lines.splice(664, 0, '.news-empty{\r');

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Done. Total lines:', lines.length);
