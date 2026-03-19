import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_live_51TCjLuHbpzjft2PjydSSucsiGbrUsB2m9K8GgNWRK4XtyDuhLRNYGZklqxeATzTTumh9MD315e7HsLaSYz7S5aZy00dBtwjfmf');

const AMOUNTS = [5, 10, 20, 50];

const FUNCTIONS_URL = process.env.NODE_ENV === 'production'
  ? '/api/createPaymentIntent'
  : 'http://localhost:5001/site-mindofadeadbody/us-central1/createPaymentIntent';

function CheckoutForm({ isPt, onBack }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message);
      setLoading(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="stripe-success">
        <div className="stripe-success-icon">♥</div>
        <p>{isPt ? 'Obrigado pelo apoio!' : 'Thank you for your support!'}</p>
        <button className="stripe-back-btn" onClick={onBack}>
          {isPt ? 'Voltar' : 'Back'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="stripe-form">
      <PaymentElement options={{
        layout: { type: 'accordion', defaultCollapsed: false, radios: true, spacedAccordionItems: false },
        defaultValues: { billingDetails: { address: { country: 'BR' } } }
      }} />
      {error && <p className="stripe-error">{error}</p>}
      <button type="submit" className="stripe-submit" disabled={!stripe || loading}>
        {loading ? (isPt ? 'Processando...' : 'Processing...') : (isPt ? 'CONTRIBUIR' : 'CONTRIBUTE')}
      </button>
    </form>
  );
}

export default function StripeWidget({ isPt, onBack }) {
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [intentError, setIntentError] = useState(null);

  const handleAmountSubmit = async (e) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents < 100) {
      setIntentError(isPt ? 'Valor mínimo: R$1,00' : 'Minimum: R$1.00');
      return;
    }
    setLoadingIntent(true);
    setIntentError(null);
    try {
      const res = await fetch(FUNCTIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cents, name, message }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClientSecret(data.clientSecret);
    } catch (err) {
      setIntentError(err.message);
    }
    setLoadingIntent(false);
  };

  if (clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#635BFF',
              borderRadius: '8px',
              fontFamily: "'Segoe UI', Arial, sans-serif",
            },
          },
        }}
      >
        <CheckoutForm isPt={isPt} onBack={() => setClientSecret(null)} />
      </Elements>
    );
  }

  return (
    <form className="stripe-amount-form" onSubmit={handleAmountSubmit}>
      <p className="stripe-label">{isPt ? 'Escolha um valor' : 'Choose an amount'}</p>
      <div className="stripe-amount-row">
        <span className="stripe-amount-symbol">R$</span>
        <input
          className="stripe-amount-input"
          type="number"
          min="1"
          step="0.01"
          placeholder={isPt ? 'Digite o valor' : 'Enter amount'}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="stripe-amounts">
          {AMOUNTS.map((v) => (
            <button
              key={v}
              type="button"
              className={`stripe-amount-btn${amount === String(v) ? ' stripe-amount-btn--active' : ''}`}
              onClick={() => setAmount(String(v))}
            >
              +{v}
            </button>
          ))}
        </div>
      </div>
      <input
        className="stripe-input"
        type="text"
        placeholder={isPt ? 'Nome ou @social (opcional)' : 'Name or @social (optional)'}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        className="stripe-input stripe-textarea"
        placeholder={isPt ? 'Deixe uma mensagem...' : 'Say something nice...'}
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {intentError && <p className="stripe-error">{intentError}</p>}
      <button type="submit" className="stripe-submit" disabled={loadingIntent || !amount}>
        {loadingIntent ? '...' : (isPt ? 'Apoiar ♥' : 'Support ♥')}
      </button>
    </form>
  );
}
