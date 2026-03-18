const fs = require('fs');
let c = fs.readFileSync('src/NoticiasAdmin.js', 'utf8');

// 1. Expose isDirty and a guard callback to parent via a ref — simpler: use beforeunload + expose via callback prop
// Actually: the tab switching is in Admin.js. Best approach: lift isDirty out via a callback prop onDirtyChange,
// then guard tab clicks in Admin.js.
// We'll add onDirtyChange prop to NoticiasAdmin and call it whenever isDirty changes.

// Add onDirtyChange prop usage
const oldExport = "export default function NoticiasAdmin() {";
const newExport = "export default function NoticiasAdmin({ onDirtyChange }) {";
if (!c.includes(oldExport)) { console.error('export NOT FOUND'); process.exit(1); }
c = c.replace(oldExport, newExport);

// Call onDirtyChange whenever setIsDirty is called — wrap it
// Replace all setIsDirty( with a helper
const oldDirtyHelper = "  const excerptRef = useRef(null);";
const newDirtyHelper = `  const excerptRef = useRef(null);\r\n\r\n  function setDirty(val) {\r\n    setIsDirty(val);\r\n    onDirtyChange?.(val);\r\n  }`;
if (!c.includes(oldDirtyHelper)) { console.error('excerptRef NOT FOUND'); process.exit(1); }
c = c.replace(oldDirtyHelper, newDirtyHelper);

// Replace all setIsDirty( with setDirty( (except the useState declaration)
c = c.replace(/setIsDirty\(true\)/g, 'setDirty(true)');
c = c.replace(/setIsDirty\(false\)/g, 'setDirty(false)');

// 2. Remove EXCLUIR from header
const oldHeader = `        <div className="admin-section-actions">\r\n          <button type="button" className="admin-btn" onClick={addItem}>\r\n            + NOVA NOTÍCIA\r\n          </button>\r\n          <button type="button" className="admin-btn admin-btn-danger" onClick={() => selected && deleteItemNow(selected.id)} disabled={!selected}>\r\n            EXCLUIR\r\n          </button>\r\n        </div>`;
const newHeader = `        <div className="admin-section-actions">\r\n          <button type="button" className="admin-btn" onClick={addItem}>\r\n            + NOVA NOTÍCIA\r\n          </button>\r\n        </div>`;
if (!c.includes(oldHeader)) { console.error('header NOT FOUND'); process.exit(1); }
c = c.replace(oldHeader, newHeader);

// 3. Add EXCLUIR to preview toolbar (next to EDITAR)
const oldToolbarBtns = `                  <button type="button" className="admin-btn" onClick={() => setPreviewOpen(true)}>VER COMPLETO</button>\r\n                  <button type="button" className="admin-btn admin-btn-primary" onClick={() => setMode('edit')}>EDITAR</button>`;
const newToolbarBtns = `                  <button type="button" className="admin-btn" onClick={() => setPreviewOpen(true)}>VER COMPLETO</button>\r\n                  <button type="button" className="admin-btn admin-btn-danger" onClick={() => selected && deleteItemNow(selected.id)}>EXCLUIR</button>\r\n                  <button type="button" className="admin-btn admin-btn-primary" onClick={() => setMode('edit')}>EDITAR</button>`;
if (!c.includes(oldToolbarBtns)) { console.error('toolbar btns NOT FOUND'); process.exit(1); }
c = c.replace(oldToolbarBtns, newToolbarBtns);

// 4. Add EXCLUIR to edit toolbar too (next to CANCELAR)
const oldEditBtns = `                  <button type="button" className="admin-btn" onClick={discardDraft} disabled={saveState === 'saving'}>\r\n                    {isDirty ? 'DESCARTAR' : 'CANCELAR'}\r\n                  </button>`;
const newEditBtns = `                  <button type="button" className="admin-btn" onClick={discardDraft} disabled={saveState === 'saving'}>\r\n                    {isDirty ? 'DESCARTAR' : 'CANCELAR'}\r\n                  </button>\r\n                  {!draft?.isNew && (\r\n                    <button type="button" className="admin-btn admin-btn-danger" onClick={() => selected && deleteItemNow(selected.id)} disabled={saveState === 'saving'}>\r\n                      EXCLUIR\r\n                    </button>\r\n                  )}`;
if (!c.includes(oldEditBtns)) { console.error('edit btns NOT FOUND'); process.exit(1); }
c = c.replace(oldEditBtns, newEditBtns);

fs.writeFileSync('src/NoticiasAdmin.js', c);
console.log('OK');
