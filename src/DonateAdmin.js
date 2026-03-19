import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const DOC_REF = () => doc(db, 'siteData', 'moadb_donate');
const EMPTY_DONATION = { name: '', amount: '', message: '', date: '' };
const EMPTY_COST = { label: '', amount: '' };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(val) {
  const n = parseFloat(val) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function DonateAdmin() {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // config
  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [bmcUrl, setBmcUrl] = useState('');

  // cost breakdown
  const [costs, setCosts] = useState([]); // [{ label, amount }]
  const [newCost, setNewCost] = useState({ ...EMPTY_COST });

  // donations
  const [donations, setDonations] = useState([]);
  const [newDonation, setNewDonation] = useState({ ...EMPTY_DONATION, date: today() });
  const [addError, setAddError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(DOC_REF(), (snap) => {
      const d = snap.exists() ? snap.data() : {};
      setData(d);
      setTitle(d.title || '');
      setTitleEn(d.titleEn || '');
      setDescription(d.description || '');
      setDescriptionEn(d.descriptionEn || '');
      setPeriodStart(d.periodStart || '');
      setPeriodEnd(d.periodEnd || '');
      setBmcUrl(d.bmcUrl || '');
      setCosts(Array.isArray(d.costs) ? d.costs : []);
      setDonations(Array.isArray(d.donations) ? d.donations : []);
    });
    return unsub;
  }, []);

  const goalTotal = costs.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
  const totalRaised = donations.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);
  const progress = goalTotal > 0 ? Math.min((totalRaised / goalTotal) * 100, 100) : 0;

  async function save(overrides = {}) {
    setSaving(true);
    setSaveMsg('');
    try {
      await setDoc(DOC_REF(), {
        title,
        titleEn,
        description,
        descriptionEn,
        periodStart,
        periodEnd,
        bmcUrl,
        costs,
        goal: goalTotal,
        raised: totalRaised,
        donations,
        ...overrides,
      });
      setSaveMsg('Salvo!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (e) {
      setSaveMsg('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  // ---- costs ----
  function addCost() {
    if (!newCost.label.trim() || !(parseFloat(newCost.amount) > 0)) return;
    const updated = [...costs, { label: newCost.label.trim(), amount: parseFloat(newCost.amount) }];
    setCosts(updated);
    setNewCost({ ...EMPTY_COST });
    save({ costs: updated, goal: updated.reduce((a, c) => a + (parseFloat(c.amount) || 0), 0) });
  }

  function removeCost(idx) {
    const updated = costs.filter((_, i) => i !== idx);
    setCosts(updated);
    save({ costs: updated, goal: updated.reduce((a, c) => a + (parseFloat(c.amount) || 0), 0) });
  }

  function updateCost(idx, field, val) {
    const updated = costs.map((c, i) => i === idx ? { ...c, [field]: val } : c);
    setCosts(updated);
  }

  // ---- donations ----
  function addDonation() {
    const amount = parseFloat(newDonation.amount);
    if (!newDonation.name.trim()) { setAddError('Nome obrigatório.'); return; }
    if (!amount || amount <= 0) { setAddError('Valor inválido.'); return; }
    setAddError('');
    const entry = {
      name: newDonation.name.trim(),
      amount,
      message: newDonation.message.trim(),
      date: newDonation.date || today(),
    };
    const updated = [entry, ...donations];
    setDonations(updated);
    setNewDonation({ ...EMPTY_DONATION, date: today() });
    save({ donations: updated, raised: updated.reduce((a, d) => a + (parseFloat(d.amount) || 0), 0) });
  }

  function removeDonation(idx) {
    const updated = donations.filter((_, i) => i !== idx);
    setDonations(updated);
    save({ donations: updated, raised: updated.reduce((a, d) => a + (parseFloat(d.amount) || 0), 0) });
  }

  if (data === null) {
    return <div className="admin-section"><p className="admin-muted">Carregando...</p></div>;
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div>
          <h2 className="admin-h2">DOAÇÕES</h2>
          <p className="admin-subtitle">Meta mensal, custos detalhados e contribuições.</p>
        </div>
        <div className="admin-section-actions">
          <a href="/donate" target="_blank" rel="noopener noreferrer" className="admin-btn admin-btn-ghost">
            VER PÁGINA ↗
          </a>
        </div>
      </div>

      {/* ===== CONFIGURAÇÕES ===== */}
      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-panel-title">CONFIGURAÇÕES</div>
        <div style={{ padding: '14px 0 0' }}>
          <div className="admin-field">
            <label className="admin-label">Título da página (PT)</label>
            <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Apoie o projeto" />
          </div>
          <div className="admin-field">
            <label className="admin-label">Título da página (EN)</label>
            <input className="admin-input" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Support the project" />
          </div>
          <div className="admin-field">
            <label className="admin-label">Descrição (PT)</label>
            <textarea className="admin-input admin-textarea" style={{ minHeight: 72 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Cada contribuição ajuda a manter o projeto vivo." />
          </div>
          <div className="admin-field">
            <label className="admin-label">Descrição (EN)</label>
            <textarea className="admin-input admin-textarea" style={{ minHeight: 72 }} value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} placeholder="Every contribution helps keep the project alive." />
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label className="admin-label">Início do período</label>
              <input className="admin-input" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="admin-field">
              <label className="admin-label">Fim do período</label>
              <input className="admin-input" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">URL Buy Me a Coffee</label>
            <input className="admin-input" value={bmcUrl} onChange={(e) => setBmcUrl(e.target.value)} placeholder="https://buymeacoffee.com/..." />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
            <button type="button" className="admin-btn admin-btn-primary" onClick={() => save()} disabled={saving}>
              {saving ? 'SALVANDO...' : 'SALVAR'}
            </button>
            {saveMsg && <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{saveMsg}</span>}
          </div>
        </div>
      </div>

      {/* ===== CUSTOS / META ===== */}
      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-panel-title">
          CUSTOS DO PROJETO — META: {formatCurrency(goalTotal)}
        </div>
        <div style={{ padding: '14px 0 0' }}>
          {/* list */}
          {costs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {costs.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 8, alignItems: 'center' }}>
                  <input
                    className="admin-input"
                    value={c.label}
                    onChange={(e) => updateCost(i, 'label', e.target.value)}
                    placeholder="Ex: Hospedagem"
                    onBlur={() => save({ costs, goal: goalTotal })}
                  />
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={c.amount}
                    onChange={(e) => updateCost(i, 'amount', e.target.value)}
                    placeholder="0.00"
                    onBlur={() => save({ costs, goal: goalTotal })}
                  />
                  <button type="button" className="admin-btn admin-btn-danger" style={{ padding: '6px 10px' }} onClick={() => removeCost(i)}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.85rem', opacity: 0.7, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                Total: {formatCurrency(goalTotal)}
              </div>
            </div>
          )}

          {/* add new cost */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 8, alignItems: 'flex-end' }}>
            <div className="admin-field" style={{ margin: 0 }}>
              <label className="admin-label">Item</label>
              <input className="admin-input" value={newCost.label} onChange={(e) => setNewCost((p) => ({ ...p, label: e.target.value }))} placeholder="Ex: Distribuição musical" onKeyDown={(e) => e.key === 'Enter' && addCost()} />
            </div>
            <div className="admin-field" style={{ margin: 0 }}>
              <label className="admin-label">Valor (R$)</label>
              <input className="admin-input" type="number" min="0" step="0.01" value={newCost.amount} onChange={(e) => setNewCost((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" onKeyDown={(e) => e.key === 'Enter' && addCost()} />
            </div>
            <button type="button" className="admin-btn admin-btn-primary" onClick={addCost} style={{ alignSelf: 'flex-end' }}>+ ADD</button>
          </div>
        </div>
      </div>

      {/* ===== PROGRESSO ===== */}
      {goalTotal > 0 && (
        <div className="admin-card" style={{ marginBottom: 16 }}>
          <div className="admin-panel-title">PROGRESSO DA META</div>
          <div style={{ padding: '14px 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: '#c0392b' }}>{formatCurrency(totalRaised)} arrecadados</span>
              <span style={{ opacity: 0.6 }}>meta {formatCurrency(goalTotal)}</span>
            </div>
            <div style={{ height: 10, background: 'rgba(255,255,255,0.12)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#8b0000,#c0392b)', borderRadius: 99, transition: 'width 0.4s' }} />
            </div>
            <div style={{ fontSize: '0.78rem', opacity: 0.55, marginTop: 6, textAlign: 'right' }}>{Math.round(progress)}% da meta</div>
          </div>
        </div>
      )}

      {/* ===== ADICIONAR CONTRIBUIÇÃO ===== */}
      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-panel-title">ADICIONAR CONTRIBUIÇÃO</div>
        <div style={{ padding: '14px 0 0' }}>
          <div className="admin-field-row">
            <div className="admin-field">
              <label className="admin-label">Nome</label>
              <input className="admin-input" value={newDonation.name} onChange={(e) => setNewDonation((p) => ({ ...p, name: e.target.value }))} placeholder="João Silva" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Valor (R$)</label>
              <input className="admin-input" type="number" min="0" step="0.01" value={newDonation.amount} onChange={(e) => setNewDonation((p) => ({ ...p, amount: e.target.value }))} placeholder="50.00" />
            </div>
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label className="admin-label">Mensagem (opcional)</label>
              <input className="admin-input" value={newDonation.message} onChange={(e) => setNewDonation((p) => ({ ...p, message: e.target.value }))} placeholder="Ótimo trabalho!" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Data</label>
              <input className="admin-input" type="date" value={newDonation.date} onChange={(e) => setNewDonation((p) => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          {addError && <p style={{ color: '#ffd0d0', fontSize: '0.85rem', margin: '0 0 10px' }}>{addError}</p>}
          <button type="button" className="admin-btn admin-btn-primary" onClick={addDonation} disabled={saving}>+ ADICIONAR</button>
        </div>
      </div>

      {/* ===== LISTA DE CONTRIBUIÇÕES ===== */}
      <div className="admin-card">
        <div className="admin-panel-title">
          CONTRIBUIÇÕES ({donations.length}) — TOTAL: {formatCurrency(totalRaised)}
        </div>
        {donations.length === 0 ? (
          <p className="admin-muted" style={{ padding: '14px 0' }}>Nenhuma contribuição registrada ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {donations
              .slice()
              .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
              .map((d, i) => {
                const origIdx = donations.findIndex((x) => x === d);
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{d.name || 'Anônimo'}</div>
                      {d.message && <div style={{ fontSize: '0.78rem', opacity: 0.6, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{d.message}"</div>}
                    </div>
                    <div style={{ fontWeight: 700, color: '#c0392b', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>{formatCurrency(d.amount)}</div>
                    <div style={{ fontSize: '0.78rem', opacity: 0.55, whiteSpace: 'nowrap' }}>{d.date || '—'}</div>
                    <button type="button" className="admin-btn admin-btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => removeDonation(origIdx)}>✕</button>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
