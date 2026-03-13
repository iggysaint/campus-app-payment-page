import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// ── Firebase Admin (for webhook to update Firestore server-side) ──────────────
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Only initialize if service account is provided
let adminDb: ReturnType<typeof getFirestore> | null = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    adminDb = getFirestore();
    console.log('✅ Firebase Admin initialized');
  } catch (e) {
    console.warn('⚠️  Firebase Admin not initialized — webhook updates disabled');
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // ── POST /api/pay — Initiate Zeepay payment ─────────────────────────────────
  app.post('/api/pay', async (req, res) => {
    const { reference, amount, phone, name, studentId } = req.body;

    if (!reference || !amount || !phone || !name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const merchantId = process.env.ZEEPAY_MERCHANT_ID;
    const apiKey = process.env.ZEEPAY_API_KEY;
    const appUrl = process.env.APP_URL;

    // ── PRODUCTION: real Zeepay API call ──────────────────────────────────────
    if (merchantId && apiKey) {
      try {
        const zeepayResponse = await fetch('https://api.zeepay.com.gh/v1/payment/initiate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            merchant_id: merchantId,
            reference,
            amount,
            phone,
            name,
            student_id: studentId,
            currency: 'GHS',
            callback_url: `${appUrl}/api/webhook`,
            description: `UPSA Hostel Payment - ${reference}`,
          }),
        });

        const data = await zeepayResponse.json();

        if (zeepayResponse.ok && data.success) {
          console.log(`✅ Zeepay payment initiated: ${reference}`);
          return res.json({ success: true, message: 'Payment initiated', data });
        } else {
          console.error('Zeepay error:', data);
          return res.status(400).json({
            success: false,
            error: data.message || 'Zeepay payment initiation failed',
          });
        }
      } catch (error) {
        console.error('Zeepay fetch error:', error);
        return res.status(500).json({ success: false, error: 'Failed to reach Zeepay' });
      }
    }

    // ── SANDBOX / TEST MODE: no credentials yet ────────────────────────────────
    console.log(`[TEST MODE] Payment initiated for ${reference}: GHS ${amount} from ${phone} (${name})`);
    return res.json({
      success: true,
      message: 'Test mode — payment simulated',
      test: true,
    });
  });

  // ── POST /api/webhook — Zeepay calls this after payment ────────────────────
  app.post('/api/webhook', async (req, res) => {
    // Always respond 200 fast so Zeepay doesn't retry
    res.status(200).send('OK');

    const webhookSecret = process.env.WEBHOOK_SECRET;
    const signature = req.headers['x-zeepay-signature'] as string;

    // Verify webhook signature in production
    if (webhookSecret && signature) {
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSig) {
        console.warn('⚠️  Invalid webhook signature — ignoring');
        return;
      }
    }

    const { reference, status, payment_reference, payment_method } = req.body;

    if (!reference) {
      console.warn('⚠️  Webhook missing reference');
      return;
    }

    console.log(`📩 Webhook received: ${reference} → ${status}`);

    // ── Update Firestore via Admin SDK ────────────────────────────────────────
    if (adminDb) {
      try {
        // Find booking by reference field
        const snapshot = await adminDb
          .collection('bookings')
          .where('reference', '==', reference)
          .limit(1)
          .get();

        if (snapshot.empty) {
          console.warn(`⚠️  No booking found for reference: ${reference}`);
          return;
        }

        const bookingDoc = snapshot.docs[0];
        const isPaid = status === 'success' || status === 'paid' || status === 'completed';

        await bookingDoc.ref.update({
          status: isPaid ? 'confirmed' : 'pending',
          payment_status: isPaid ? 'paid' : 'failed',
          payment_reference: payment_reference || null,
          payment_method: payment_method || 'momo',
          paid_at: isPaid ? new Date() : null,
        });

        console.log(`✅ Firestore updated: ${reference} → ${isPaid ? 'confirmed/paid' : 'failed'}`);
      } catch (e) {
        console.error('Firestore update error:', e);
      }
    } else {
      console.warn('⚠️  Firebase Admin not set up — Firestore not updated by webhook');
    }
  });

  // ── Vite dev / production static ───────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    if (!process.env.ZEEPAY_MERCHANT_ID) {
      console.log('⚠️  Running in TEST MODE — set ZEEPAY_MERCHANT_ID + ZEEPAY_API_KEY for live payments');
    }
  });
}

startServer();
