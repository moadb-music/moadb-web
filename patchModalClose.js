const fs = require('fs');
const c = fs.readFileSync('src/App.js', 'utf8');

// Close news-modal-inner before </div> news-modal
const oldClose = `              ) : null}\r\n            </div>\r\n          </div>\r\n        </div>\r\n      )}\r\n\r\n      <div className="support-float">`;

const newClose = `              ) : null}\r\n            </div>\r\n            </div>\r\n          </div>\r\n        </div>\r\n      )}\r\n\r\n      <div className="support-float">`;

if (!c.includes(oldClose)) { console.error('CLOSE BLOCK NOT FOUND'); process.exit(1); }
fs.writeFileSync('src/App.js', c.replace(oldClose, newClose));
console.log('OK');
