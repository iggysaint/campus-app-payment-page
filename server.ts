import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to initiate Zeepay Payment
  app.post("/api/pay", async (req, res) => {
    const { reference, amount, phone, name } = req.body;

    // This is a placeholder for the actual Zeepay API call
    // In a real scenario, you would use fetch() to call Zeepay's endpoint
    console.log(`Initiating payment for ${reference}: GHS ${amount} from ${phone}`);

    try {
      // Example Zeepay API call (Mocked)
      /*
      const response = await fetch('https://api.zeepay.com/v1/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ZEEPAY_API_KEY}`
        },
        body: JSON.stringify({
          merchant_id: process.env.ZEEPAY_MERCHANT_ID,
          reference,
          amount,
          phone,
          callback_url: `${process.env.APP_URL}/api/webhook`
        })
      });
      const data = await response.json();
      */

      // Simulate success for now
      res.json({ success: true, message: "Payment initiated" });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to initiate payment" });
    }
  });

  // Webhook for Zeepay to confirm payment
  app.post("/api/webhook", (req, res) => {
    const signature = req.headers["x-zeepay-signature"];
    // Verify signature with WEBHOOK_SECRET...

    const { reference, status } = req.body;
    console.log(`Received webhook for ${reference}: ${status}`);

    // Here you would update Firestore status: confirmed, payment_status: paid
    // Since we are server-side, we would use firebase-admin if needed,
    // but the user's prompt suggests the app handles it via onSnapshot.

    res.status(200).send("OK");
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
