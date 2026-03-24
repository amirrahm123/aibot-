import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import authRoutes from '../server/src/routes/auth';
import supplierRoutes from '../server/src/routes/suppliers';
import agreementRoutes from '../server/src/routes/agreements';
import invoiceRoutes from '../server/src/routes/invoices';
import dashboardRoutes from '../server/src/routes/dashboard';
import paymentRoutes from '../server/src/routes/payments';
import gmailRoutes from '../server/src/routes/gmail';
import webhookRoutes from '../server/src/routes/webhooks';

const app = express();

// CORS
app.use(cors({ origin: true, credentials: true }));

// Stripe webhook needs raw body — must be before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// MongoDB connection (cached for serverless)
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/priceguard';
  await mongoose.connect(MONGODB_URI);
  isConnected = true;
}

// Connect to DB before handling any request
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
