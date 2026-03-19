import { useState } from 'react';

const AMOUNTS = [5, 10, 20, 50];

export default function LivePixForm({ isPt }) {
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (amount) params.set('amount', amount);
    if (name) params.set('name', name);
    if (message) params.set('message', message);
    const query = params.toString();
    window.open(
      `https://livepix.gg/mindofadeadbody${query ? '?' + query : ''}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <form className="livepix-form" onSubmit={handleSubmit}>
      <div className="livepix-amounts">
        {AMOUNTS.map((v) => (
          <button
            key={v}
            type="button"
            className={`livepix-amount-btn${amount === String(v) ? ' livepix-amount-btn--active' : ''}`}
            onClick={() => setAmount(String(v))}
          >
            R${v}
          </button>
        ))}
      </div>
      <input
        className="livepix-input"
        type="number"
        min="1"
        step="1"
        placeholder={isPt ? 'OUTRO VALOR (R$)' : 'OTHER AMOUNT (R$)'}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        className="livepix-input"
        type="text"
        placeholder={isPt ? 'SEU NOME' : 'YOUR NAME'}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        className="livepix-input livepix-textarea"
        placeholder={isPt ? 'MENSAGEM (OPCIONAL)' : 'MESSAGE (OPTIONAL)'}
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button type="submit" className="livepix-submit">
        {isPt ? 'CONTINUAR NO LIVEPIX' : 'CONTINUE ON LIVEPIX'}
      </button>
    </form>
  );
}
