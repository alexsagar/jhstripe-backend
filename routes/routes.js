import express from 'express';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import Transaction from '../models/Transaction.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();


router.get('/health', (req, res) => {
  res.json({ status: 'Server running successfully' });
});

router.post('/create-checkout-session', async (req, res) => {
  try {
    const { gameId, gameName, amount } = req.body;

    const transaction = new Transaction({
      gameId,
      gameName,
      amount,
      userId: `user_${Date.now()}`
    });
    await transaction.save();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['cashapp'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${gameName} - Game Credit`,
            description: `Load $${amount} to your ${gameName} account`
          },
          unit_amount: Math.round(amount * 100), 
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: {
        transactionId: transaction._id.toString(),
        gameId,
        gameName
      }
    });

    transaction.stripeSessionId = session.id;
    await transaction.save();

    res.json({ sessionId: session.id, checkoutUrl: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.post('/verify-payment', async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      await Transaction.findOneAndUpdate(
        { stripeSessionId: sessionId },
        { status: 'completed' }
      );
      res.json({ success: true, session });
    } else {
      res.json({ success: false, session });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(50);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
