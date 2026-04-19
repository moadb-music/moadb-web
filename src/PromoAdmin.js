import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { renderPromoText } from './components/PromoPopup';

const DOC_REF = doc(db, 'siteData', 'moadb_promo');

const EMPTY = {
  ativa: false,
  titulo: '',
  texto: '',
  cupom: '',
  expiraEm: '',
};

// ── mini toolbar de formatação ────────────────────────────────────────────────
function RichToolbar({ textareaRef, value, onChange }) {
  function wrap(before, after) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const sel   = value.slice(start, end);
    const next  = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);
    // reposiciona cursor
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  }

  function insertLineBreak() {
    const el = textareaRef.current;
    if (!el) return;
    const pos  = el.selectionStart;
    const next = value.slice(0, pos) + '\n' + value.slice(pos);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos + 1, pos + 1);
    });
  }

  const btn = {
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(255,255,255,.12)',
    color: 'rgba(255,255,255,.7)',
    fontFamily: 'Inter, sans-serif',
    fontSize: '.72rem',
    padding: '3px 9px',
    cursor: 'pointer',
    borderRadius: 3,
    transition: 'background .15s',
    lineHeight: 1.4,
  };

  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
      <button type="button" style={{ ...btn, fontWeight: 700 }} onClick={() => wrap('**', '**')} title="Negrito">B</button>
      <button type="button" style={{ ...btn, fontStyle: 'italic' }} onClick={() => wrap('*', '*')} title="Itálico">I</button>
      <button type="button" style={btn} onClick={() => wrap('~~', '~~')} title="Tachado">S̶</button>
      <button type="button" style={btn} onClick={insertLineBreak} title="Quebra de linha">↵</button>
    </div>
  );
}

// ── componente embutível (usado dentro do LojaAdmin) ─────────────────────────
export default function PromoAdmin() {
  const [draft, setDraft] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(DOC_REF, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setDraft({
          ativa:    typeof d.ativa === 'boolean' ? d.ativa : false,
          titulo:   String(d.titulo   || ''),
          texto:    String(d.texto    || ''),
          cupom:    String(d.cupom    || ''),
          expiraEm: String(d.expiraEm || ''),
        });
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  async function save() {
    setSaving(true);
    try {
      await setDoc(DOC_REF, { ...draft, updatedAt: serverTimestamp() }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      window.alert('Falha ao salvar promoção.');
    } finally {
      setSaving(false);
    }
  }

  function set(field, value) { setDraft(p => ({ ...p, [field]: value })); }

  if (loading) return <div className="admin-hint">Carregando promoção…</div>;

  const expired = draft.expiraEm && new Date(draft.expiraEm + 'T23:59:59') < new Date();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '.58rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 4 }}>
            Popup
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff', fontWeight: 700 }}>
            Promoção
          </div>
          <div className="admin-hint" style={{ margin: '2px 0 0', fontSize: '.78rem' }}>Popup exibido ao entrar na loja</div>
        </div>
        <button type="button" className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar promoção'}
        </button>
      </div>

      {/* ativo */}
      <div className="admin-field" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          className={`admin-switch${draft.ativa ? ' is-on' : ''}`}
          onClick={() => set('ativa', !draft.ativa)}
          aria-label="Ativar promoção"
        />
        <span className="admin-label" style={{ marginBottom: 0 }}>
          {draft.ativa ? 'Promoção ativa' : 'Promoção inativa'}
        </span>
        {expired && draft.ativa && (
          <span style={{ fontSize: '.7rem', color: '#f87171', fontFamily: 'Inter, sans-serif' }}>⚠ Data expirada</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* coluna esquerda: formulário */}
        <div>
          <label className="admin-field">
            <span className="admin-label">Título</span>
            <input className="admin-input" value={draft.titulo}
              onChange={e => set('titulo', e.target.value)}
              placeholder="Ex: Black Friday 🖤" />
          </label>

          <div className="admin-field">
            <span className="admin-label">Texto</span>
            <RichToolbar textareaRef={textareaRef} value={draft.texto} onChange={v => set('texto', v)} />
            <textarea
              ref={textareaRef}
              className="admin-input admin-textarea"
              value={draft.texto}
              onChange={e => set('texto', e.target.value)}
              placeholder={'Use **negrito**, *itálico*, ~~tachado~~\nQuebras de linha são respeitadas.'}
              rows={4}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '.82rem' }}
            />
            <div className="admin-hint" style={{ marginTop: 4 }}>**negrito** · *itálico* · ~~tachado~~</div>
          </div>

          <label className="admin-field">
            <span className="admin-label">Código do cupom</span>
            <input className="admin-input" value={draft.cupom}
              onChange={e => set('cupom', e.target.value.toUpperCase())}
              placeholder="Ex: BLACKFRIDAY15"
              style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: '1rem' }} />
          </label>

          <label className="admin-field">
            <span className="admin-label">Data de término</span>
            <input type="date" className="admin-input" value={draft.expiraEm}
              onChange={e => set('expiraEm', e.target.value)}
              style={{ colorScheme: 'dark', maxWidth: 200 }} />
            {draft.expiraEm && (
              <div className="admin-hint" style={{ marginTop: 6 }}>
                {expired
                  ? '⚠ Esta data já passou. O popup não será exibido.'
                  : `Expira: ${new Date(draft.expiraEm + 'T23:59:59').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`}
              </div>
            )}
          </label>
        </div>

        {/* coluna direita: preview fiel */}
        <div>
          <div className="admin-label">Preview</div>
          <div style={{
            background: '#0d0d0d',
            border: '1px solid rgba(255,255,255,.12)',
            borderTop: '2px solid #8b0000',
            padding: '28px 24px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            textAlign: 'center',
            borderRadius: 2,
          }}>
            <div style={{
              fontFamily: 'Inter, sans-serif', fontSize: '.58rem', letterSpacing: '.18em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,.4)',
              background: 'rgba(139,0,0,.15)', border: '1px solid rgba(139,0,0,.3)',
              padding: '3px 10px', borderRadius: 20,
            }}>🎉 PROMOÇÃO</div>

            {draft.titulo && (
              <div style={{
                fontFamily: 'Oswald, sans-serif', fontSize: '1.3rem', fontWeight: 700,
                letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff', lineHeight: 1.1,
              }}>{draft.titulo}</div>
            )}

            {draft.texto && (
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: '.82rem',
                lineHeight: 1.65, color: 'rgba(255,255,255,.6)', maxWidth: 280,
              }}
                dangerouslySetInnerHTML={{ __html: renderPromoText(draft.texto) }}
              />
            )}

            {draft.cupom && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(139,0,0,.12)', border: '1.5px dashed rgba(139,0,0,.55)',
                padding: '10px 18px', width: '100%', justifyContent: 'center', borderRadius: 3,
              }}>
                <span style={{ fontFamily: 'Courier New, monospace', fontSize: '1rem', fontWeight: 700, letterSpacing: 4, color: '#fff' }}>
                  {draft.cupom}
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '.65rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)' }}>
                  Copiar
                </span>
              </div>
            )}

            {draft.expiraEm && !expired && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.07)' }}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '.58rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)' }}>
                  Termina em
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['DD', 'HH', 'MM', 'SS'].map(u => (
                    <div key={u} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
                      <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>00</span>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '.5rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)' }}>{u}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '.68rem', color: 'rgba(255,255,255,.25)', textDecoration: 'underline' }}>
              Fechar
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
