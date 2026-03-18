const fs = require('fs');
let c = fs.readFileSync('src/NoticiasAdmin.js', 'utf8');

// 1. addItem: don't add to list, just set draft with isNew flag
const oldAddItem = `  async function addItem() {\r\n    const id = uid();\r\n    const today = new Date().toISOString().slice(0, 10);\r\n    const next = [\r\n      {\r\n        id,\r\n        tags: ['NEWS'],\r\n        date: today,\r\n        title: 'NOVA NOTÍCIA',\r\n        excerptHtml: '',\r\n        ctaText: '',\r\n        ctaUrl: '',\r\n        imageUrl: '',\r\n        mediaUrl: '',\r\n        mediaKind: 'image',\r\n      },\r\n      ...items,\r\n    ];\r\n\r\n    // IMPORTANTE: não persiste aqui para não subir no site sem salvar\r\n    setItems(next);\r\n    setSelectedId(id);\r\n    setDraft({ ...next[0], tagsText: 'NEWS', mediaKind: 'image' });\r\n    setIsDirty(true);\r\n    setSaveState('');\r\n    setMode('edit');\r\n  }`;

const newAddItem = `  function addItem() {\r\n    if (isDirty && !window.confirm('Você tem alterações não salvas. Descartar e criar nova notícia?')) return;\r\n    const id = uid();\r\n    const today = new Date().toISOString().slice(0, 10);\r\n    const newItem = {\r\n      id,\r\n      tags: ['NEWS'],\r\n      date: today,\r\n      title: 'NOVA NOTÍCIA',\r\n      excerptHtml: '',\r\n      ctaText: '',\r\n      ctaUrl: '',\r\n      imageUrl: '',\r\n      mediaUrl: '',\r\n      mediaKind: 'image',\r\n    };\r\n    setSelectedId(null);\r\n    setDraft({ ...newItem, tagsText: 'NEWS', isNew: true });\r\n    setIsDirty(true);\r\n    setSaveState('');\r\n    setMode('edit');\r\n  }`;

if (!c.includes(oldAddItem)) { console.error('addItem NOT FOUND'); process.exit(1); }
c = c.replace(oldAddItem, newAddItem);

// 2. saveDraft: if isNew, prepend to list instead of map
const oldSaveNext = `    const next = items.map((it) => (it.id === normalizedDraft.id ? {\r\n      id: normalizedDraft.id,\r\n      tags: normalizedDraft.tags,\r\n      date: normalizedDraft.date,\r\n      title: normalizedDraft.title,\r\n      excerptHtml: normalizedDraft.excerptHtml,\r\n      ctaText: normalizedDraft.ctaText,\r\n      ctaUrl: normalizedDraft.ctaUrl,\r\n      imageUrl: normalizedDraft.imageUrl,\r\n      mediaUrl: normalizedDraft.mediaUrl,\r\n      mediaKind: normalizedDraft.mediaKind,\r\n    } : it));\r\n\r\n    setItems(next);\r\n    setIsDirty(false);`;

const newSaveNext = `    const savedItem = {\r\n      id: normalizedDraft.id,\r\n      tags: normalizedDraft.tags,\r\n      date: normalizedDraft.date,\r\n      title: normalizedDraft.title,\r\n      excerptHtml: normalizedDraft.excerptHtml,\r\n      ctaText: normalizedDraft.ctaText,\r\n      ctaUrl: normalizedDraft.ctaUrl,\r\n      imageUrl: normalizedDraft.imageUrl,\r\n      mediaUrl: normalizedDraft.mediaUrl,\r\n      mediaKind: normalizedDraft.mediaKind,\r\n    };\r\n    const next = draft.isNew\r\n      ? [savedItem, ...items]\r\n      : items.map((it) => (it.id === savedItem.id ? savedItem : it));\r\n\r\n    setItems(next);\r\n    setSelectedId(savedItem.id);\r\n    setIsDirty(false);`;

if (!c.includes(oldSaveNext)) { console.error('saveDraft next NOT FOUND'); process.exit(1); }
c = c.replace(oldSaveNext, newSaveNext);

// 3. discardDraft: if isNew, just clear draft without touching list
const oldDiscard = `  function discardDraft() {\r\n    if (!selected) return;\r\n    setDraft({ ...selected, tagsText: (selected.tags || []).join(', ') });\r\n    setIsDirty(false);\r\n    setSaveState('');\r\n    setMode('preview');\r\n\r\n    // garante reset visual do editor quando cancelar\r\n    if (excerptRef.current) {\r\n      excerptRef.current.innerHTML = String(selected.excerptHtml || '');\r\n      lastExcerptHtmlRef.current = String(selected.excerptHtml || '');\r\n    }\r\n  }`;

const newDiscard = `  function discardDraft() {\r\n    if (draft?.isNew) {\r\n      setDraft(null);\r\n      setIsDirty(false);\r\n      setSaveState('');\r\n      setMode('preview');\r\n      return;\r\n    }\r\n    if (!selected) return;\r\n    setDraft({ ...selected, tagsText: (selected.tags || []).join(', ') });\r\n    setIsDirty(false);\r\n    setSaveState('');\r\n    setMode('preview');\r\n    if (excerptRef.current) {\r\n      excerptRef.current.innerHTML = String(selected.excerptHtml || '');\r\n      lastExcerptHtmlRef.current = String(selected.excerptHtml || '');\r\n    }\r\n  }`;

if (!c.includes(oldDiscard)) { console.error('discardDraft NOT FOUND'); process.exit(1); }
c = c.replace(oldDiscard, newDiscard);

// 4. List item click: guard dirty state
const oldClick = "                  onClick={() => setSelectedId(it.id)}";
const newClick = `                  onClick={() => {\r\n                    if (isDirty && !window.confirm('Você tem alterações não salvas. Descartar?')) return;\r\n                    setSelectedId(it.id);\r\n                  }}`;

if (!c.includes(oldClick)) { console.error('onClick NOT FOUND'); process.exit(1); }
c = c.replace(oldClick, newClick);

// 5. useEffect for selectedId: skip if draft.isNew (don't overwrite new draft when selectedId is null)
const oldEffect = `  // quando seleciona outro item, carrega o draft do item (sem abrir modal)\r\n  useEffect(() => {\r\n    if (!selected) {\r\n      setDraft(null);\r\n      setIsDirty(false);\r\n      setSaveState('');\r\n      setMode('preview');\r\n      return;\r\n    }`;

const newEffect = `  // quando seleciona outro item, carrega o draft do item (sem abrir modal)\r\n  useEffect(() => {\r\n    if (!selected) {\r\n      // se há um draft novo em andamento, não limpa\r\n      setDraft((d) => d?.isNew ? d : null);\r\n      if (!draft?.isNew) { setIsDirty(false); setSaveState(''); setMode('preview'); }\r\n      return;\r\n    }`;

if (!c.includes(oldEffect)) { console.error('useEffect NOT FOUND'); process.exit(1); }
c = c.replace(oldEffect, newEffect);

fs.writeFileSync('src/NoticiasAdmin.js', c);
console.log('OK');
