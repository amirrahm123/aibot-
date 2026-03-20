/**
 * Seed script — creates test user + 8 suppliers with price agreements
 *
 * Usage: npx ts-node src/seed.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User';
import Supplier from './models/Supplier';
import PriceAgreement from './models/PriceAgreement';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/priceguard';

interface SeedSupplier {
  name: string;
  category: string;
  contactName: string;
  contactPhone: string;
  agreements: { productName: string; agreedPrice: number; unit: string }[];
}

const seedSuppliers: SeedSupplier[] = [
  {
    name: 'אופיס סאפליז',
    category: 'ציוד משרדי',
    contactName: 'דני כהן',
    contactPhone: '03-5551234',
    agreements: [
      { productName: 'נייר A4', agreedPrice: 3500, unit: 'box' }, // 35₪ = 3500 agorot
      { productName: 'עטים כחולים', agreedPrice: 2800, unit: 'box' },
    ],
  },
  {
    name: 'פרש מארקט',
    category: 'ירקות ופירות',
    contactName: 'יוסי לוי',
    contactPhone: '04-5552345',
    agreements: [
      { productName: 'עגבניות', agreedPrice: 800, unit: 'kg' },
      { productName: 'מלפפונים', agreedPrice: 600, unit: 'kg' },
      { productName: 'פלפלים', agreedPrice: 1400, unit: 'kg' },
    ],
  },
  {
    name: 'קלין פרו',
    category: 'ניקוי',
    contactName: 'שרה אברהם',
    contactPhone: '02-5553456',
    agreements: [
      { productName: 'אקונומיקה 5L', agreedPrice: 4200, unit: 'unit' },
      { productName: 'סבון ידיים 1L', agreedPrice: 1800, unit: 'unit' },
      { productName: 'חומר ניקוי שירותים 1L', agreedPrice: 2200, unit: 'unit' },
    ],
  },
  {
    name: 'טק-פרו',
    category: 'ציוד מחשבים',
    contactName: 'אלון רז',
    contactPhone: '09-5554567',
    agreements: [
      { productName: 'מחסנית HP-301 שחורה', agreedPrice: 8900, unit: 'unit' },
      { productName: 'מחסנית HP-301XL צבעונית', agreedPrice: 12000, unit: 'unit' },
    ],
  },
  {
    name: 'בישול ותבלינים',
    category: 'מזון',
    contactName: 'רחל מזרחי',
    contactPhone: '08-5555678',
    agreements: [
      { productName: 'שמן זית כתית 5L', agreedPrice: 18500, unit: 'unit' },
      { productName: 'פלפל שחור טחון 1ק"ג', agreedPrice: 6500, unit: 'unit' },
    ],
  },
  {
    name: 'דיגיטל-טק',
    category: 'ציוד מחשבים',
    contactName: 'מיכאל שטרן',
    contactPhone: '03-5556789',
    agreements: [
      { productName: 'מסך Dell 27"', agreedPrice: 125000, unit: 'unit' },
      { productName: 'מקלדת Logitech MX', agreedPrice: 38000, unit: 'unit' },
    ],
  },
  {
    name: 'פורניצ\'ר פלוס',
    category: 'ריהוט',
    contactName: 'עמית גולן',
    contactPhone: '077-5557890',
    agreements: [
      { productName: 'כיסא מנהלים ErgoMax', agreedPrice: 180000, unit: 'unit' },
      { productName: 'שולחן ישיבות 240x120', agreedPrice: 420000, unit: 'unit' },
    ],
  },
  {
    name: 'קפה & בר',
    category: 'מזון ושתייה',
    contactName: 'נועה פרידמן',
    contactPhone: '050-5558901',
    agreements: [
      { productName: 'פולי קפה ספיישלטי 1ק"ג', agreedPrice: 14000, unit: 'unit' },
      { productName: 'חלב שקדים 1L', agreedPrice: 6800, unit: 'unit' },
    ],
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Check if test user already exists
  const existing = await User.findOne({ username: 'testbot' });
  if (existing) {
    console.log('Test user already exists — clearing old data...');
    await PriceAgreement.deleteMany({ userId: existing._id });
    await Supplier.deleteMany({ userId: existing._id });
    await User.deleteOne({ _id: existing._id });
  }

  // Create test user
  const passwordHash = await bcrypt.hash('Test1234!', 12);
  const user = await User.create({
    username: 'testbot',
    passwordHash,
    businessName: 'עסק לדוגמה',
    ownerName: 'משתמש בדיקה',
    phone: '0501234567',
  });
  console.log(`Created test user: testbot (ID: ${user._id})`);

  // Create suppliers + agreements
  for (const s of seedSuppliers) {
    const supplier = await Supplier.create({
      userId: user._id,
      name: s.name,
      category: s.category,
      contactName: s.contactName,
      contactPhone: s.contactPhone,
      isActive: true,
    });
    console.log(`  Created supplier: ${s.name}`);

    for (const a of s.agreements) {
      await PriceAgreement.create({
        userId: user._id,
        supplierId: supplier._id,
        productName: a.productName,
        agreedPrice: a.agreedPrice,
        unit: a.unit,
        validFrom: new Date(),
      });
    }
    console.log(`    → ${s.agreements.length} price agreements`);
  }

  console.log('\nSeed complete!');
  console.log('Login with: username=testbot, password=Test1234!');
  console.log('Phone: 0501234567 (use MOCK_SMS=true for dev)');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
