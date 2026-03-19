const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const cors = require('cors')({ origin: true });

admin.initializeApp();

// Supports both firebase functions:config and environment variable
const stripeSecretKey = (functions.config().stripe || {}).secret_key || process.env.STRIPE_SECRET_KEY;
const stripe = Stripe(stripeSecretKey);

// Minimum amounts per currency (Stripe requirement)
const MIN_AMOUNT = 100; // R$1.00 in centavos

exports.createPaymentIntent = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { amount } = req.body; // amount in centavos (e.g. 1000 = R$10)

      if (!amount || isNaN(amount) || amount < MIN_AMOUNT) {
        return res.status(400).json({ error: 'Invalid amount. Minimum is R$1.00.' });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount),
        currency: 'brl',
        automatic_payment_methods: { enabled: true },
      });

      return res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
      console.error('Stripe error:', err);
      return res.status(500).json({ error: err.message });
    }
  });
});
