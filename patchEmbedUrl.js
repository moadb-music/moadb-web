const fs = require('fs');
const c = fs.readFileSync('src/App.js', 'utf8');

const oldSrc = "return id ? `https://www.youtube-nocookie.com/embed/${id}` : openNewsPost.mediaUrl;";
const newSrc = "return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : openNewsPost.mediaUrl;";

if (!c.includes(oldSrc)) { console.error('NOT FOUND'); process.exit(1); }
fs.writeFileSync('src/App.js', c.replace(oldSrc, newSrc));
console.log('OK');
