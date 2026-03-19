const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const cors = require('cors')({ origin: true });
const nodemailer = require('nodemailer');

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
      const { amount, name, message } = req.body;

      if (!amount || isNaN(amount) || amount < MIN_AMOUNT) {
        return res.status(400).json({ error: 'Invalid amount. Minimum is R$1.00.' });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount),
        currency: 'brl',
        payment_method_types: ['card', 'boleto'],
        payment_method_options: {
          boleto: { expires_after_days: 3 },
        },
        metadata: {
          donor_name: name || 'Anônimo',
          message: message || '',
        },
      });

      return res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
      console.error('Stripe error:', err);
      return res.status(500).json({ error: err.message });
    }
  });
});

// ===== CONTACT FORM =====
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;
const CONTACT_TO = process.env.CONTACT_TO || GMAIL_USER;

exports.sendContactMessage = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'name, email and message are required' });
    }

    const db = admin.firestore();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 1. Save to Firestore
    await db.collection('contactMessages').add({
      name, email, subject: subject || '', message,
      createdAt: timestamp,
      read: false,
    });

    // 2. Send email if credentials are configured
    if (GMAIL_USER && GMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: GMAIL_USER, pass: GMAIL_PASS },
        });
        await transporter.sendMail({
          from: `"Mind of a Dead Body" <${GMAIL_USER}>`,
          to: CONTACT_TO,
          replyTo: email,
          subject: `[Contato] ${subject || 'Nova mensagem'} — ${name}`,
          text: `De: ${name} <${email}>\n\n${message}`,
          html: `<p><strong>De:</strong> ${name} &lt;${email}&gt;</p><p><strong>Assunto:</strong> ${subject || '—'}</p><hr/><p>${message.replace(/\n/g, '<br/>')}</p>`,
        });
      } catch (emailErr) {
        // Email failed but message was saved — don't fail the request
        console.error('Email error:', emailErr);
      }
    }

    return res.status(200).json({ ok: true });
  });
});
