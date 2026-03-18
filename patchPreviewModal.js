const fs = require('fs');
let c = fs.readFileSync('src/NoticiasAdmin.js', 'utf8');

// 1. Add previewOpen state after existing mode state
const oldState = "  const [mode, setMode] = useState('preview'); // 'preview' | 'edit'";
const newState = "  const [mode, setMode] = useState('preview'); // 'preview' | 'edit'\r\n  const [previewOpen, setPreviewOpen] = useState(false);";
if (!c.includes(oldState)) { console.error('STATE NOT FOUND'); process.exit(1); }
c = c.replace(oldState, newState);

// 2. Replace fullscreen button with "VER COMPLETO"
const oldBtn = `                  <button type="button" className="admin-btn" onClick={() => {\r\n                    const el = document.querySelector('.admin-news-preview-card-wrap');\r\n                    if (el?.requestFullscreen) el.requestFullscreen();\r\n                  }} title="Tela cheia">⛶</button>\r\n                  <button type="button" className="admin-btn admin-btn-primary" onClick={() => setMode('edit')}>EDITAR</button>`;
const newBtn = `                  <button type="button" className="admin-btn" onClick={() => setPreviewOpen(true)}>VER COMPLETO</button>\r\n                  <button type="button" className="admin-btn admin-btn-primary" onClick={() => setMode('edit')}>EDITAR</button>`;
if (!c.includes(oldBtn)) { console.error('BTN NOT FOUND'); process.exit(1); }
c = c.replace(oldBtn, newBtn);

// 3. Add modal before closing </div> of admin-section
const oldClose = "      {isGalleryOpen ? (";
const newClose = `      {previewOpen && draft && (\r\n        <div className="news-modal-backdrop" onMouseDown={() => setPreviewOpen(false)}>\r\n          <div className="news-modal" onMouseDown={(e) => e.stopPropagation()}>\r\n            <button className="news-modal-close" onClick={() => setPreviewOpen(false)} aria-label="Fechar">×</button>\r\n            <div className="news-modal-inner">\r\n              {(draft.mediaKind === 'video' || draft.mediaKind === 'video_vertical') && draft.mediaUrl ? (\r\n                draft.mediaUrl.includes('instagram.com') ? (\r\n                  <a className="news-modal-external" href={draft.mediaUrl} target="_blank" rel="noreferrer">\r\n                    <span>&#9654;</span> Assistir no Instagram\r\n                  </a>\r\n                ) : (\r\n                <div className="news-modal-video">\r\n                  <iframe\r\n                    src={(() => { try { const u = new URL(draft.mediaUrl); const id = u.searchParams.get('v') || (u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.pathname.split('/shorts/')[1]?.split('?')[0] || u.pathname.split('/embed/')[1]?.split('/')[0] || u.pathname.slice(1)); return id ? \`https://www.youtube-nocookie.com/embed/\${id}?rel=0&modestbranding=1\` : draft.mediaUrl; } catch { return draft.mediaUrl; } })()}\r\n                    title={draft.title}\r\n                    frameBorder="0"\r\n                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"\r\n                    allowFullScreen\r\n                  />\r\n                </div>\r\n                )\r\n              ) : draft.imageUrl ? (\r\n                <img className="news-modal-img" src={draft.imageUrl} alt="" />\r\n              ) : null}\r\n              <div className="news-modal-body">\r\n                {(draft.tags || []).length > 0 && (\r\n                  <div className="news-tags">{(draft.tags || []).map(t => <span key={t} className="news-tag">{t.toUpperCase()}</span>)}</div>\r\n                )}\r\n                <h2 className="news-modal-title">{draft.title}</h2>\r\n                {draft.date && <div className="news-date">{draft.date}</div>}\r\n                {draft.excerptHtml ? (\r\n                  <div className="news-modal-text" dangerouslySetInnerHTML={{ __html: draft.excerptHtml }} />\r\n                ) : draft.excerptHtml === '' ? null : null}\r\n                {draft.ctaUrl && (\r\n                  <a className="news-cta" href={draft.ctaUrl} target="_blank" rel="noreferrer">\r\n                    {draft.ctaText || 'LER MAIS'}\r\n                  </a>\r\n                )}\r\n              </div>\r\n            </div>\r\n          </div>\r\n        </div>\r\n      )}\r\n\r\n      {isGalleryOpen ? (`;
if (!c.includes(oldClose)) { console.error('CLOSE NOT FOUND'); process.exit(1); }
c = c.replace(oldClose, newClose);

fs.writeFileSync('src/NoticiasAdmin.js', c);
console.log('OK');
