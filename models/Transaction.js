import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  gameName: { type: String, required: true },
  amount: { type: Number, required: true },
  userId: { type: String, required: true },
  status: { type: String, default: 'pending' },
  stripeSessionId: String,
  createdAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);


export default Transaction;
