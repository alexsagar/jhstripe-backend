import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import routes from './routes/routes.js';
import Transaction from './models/Transaction.js';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Stripe initialization
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Stripe Webhook must come before express.json
app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ✅ Handle completed payment session
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      try {
        await Transaction.findOneAndUpdate(
          { stripeSessionId: session.id },
          { status: 'completed' }
        );
        console.log(`✅ Payment confirmed for session ${session.id}`);
      } catch (err) {
        console.error('❌ Failed to update transaction:', err);
      }
    }

    res.json({ received: true });
  }
);

// ✅ Apply middleware after webhook
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());

// ✅ Basic route for Render root test
app.get('/', (req, res) => {
  res.send('🟢 JuwaHouse backend is live.');
});

// ✅ Rate limiter for payment route
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many payment attempts. Please try again later.',
});
app.use('/api/create-checkout-session', paymentLimiter);

// ✅ Use other API routes
app.use('/api', routes);

// ✅ MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gaming-platform')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
