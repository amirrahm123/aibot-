process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  process.exit(1);
});

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
dotenv.config(); // also check server/.env or env vars from hosting

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/auth';
import supplierRoutes from './routes/suppliers';
import agreementRoutes from './routes/agreements';
import invoiceRoutes from './routes/invoices';
import dashboardRoutes from './routes/dashboard';
import paymentRoutes from './routes/payments';

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // permissive for now; tighten after deployment
    }
  },
  credentials: true,
}));
// Stripe webhook needs raw body — must be before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React client in production
if (process.env.NODE_ENV === 'production') {
  // Try multiple possible paths for the client build
  const candidates = [
    path.resolve(process.cwd(), '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../../../client/dist'),
    path.resolve(__dirname, '../../../../client/dist'),
    '/opt/render/project/src/client/dist',
  ];

  let clientDist = candidates[0];
  for (const candidate of candidates) {
    console.log(`Checking: ${candidate} -> exists: ${fs.existsSync(candidate)}`);
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      clientDist = candidate;
      break;
    }
  }

  console.log('Serving static files from:', clientDist);
  console.log('index.html exists:', fs.existsSync(path.join(clientDist, 'index.html')));

  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    const indexPath = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({
        error: 'Client build not found',
        cwd: process.cwd(),
        __dirname,
        candidates: candidates.map(c => ({ path: c, exists: fs.existsSync(c) })),
      });
    }
  });
}

// Startup
async function start() {
  console.log('=== PriceGuard Server Starting ===');
  console.log('ENV CHECK:', {
    MONGODB_URI: !!process.env.MONGODB_URI,
    JWT_SECRET: !!process.env.JWT_SECRET,
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    CWD: process.cwd(),
  });

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/priceguard';

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection FAILED:', err);
    process.exit(1);
  }

  try {
    app.listen(PORT, () => {
      console.log(`PriceGuard server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Server listen FAILED:', err);
    process.exit(1);
  }
}

start().catch((err) => {
  console.error('STARTUP CRASH:', err);
  process.exit(1);
});

export default app;
