/**
 * Seed script: creates 6 realistic Hebrew-language suppliers with
 * price agreements for a development environment.
 *
 * Requires a userId to assign the data to. Pass as first argument:
 *   npx tsx scripts/seedDevData.ts <userId>
 *
 * Safe to run multiple times — skips suppliers that already exist (by name).
 */

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
dotenv.config();

import mongoose, { Types } from 'mongoose';
import Supplier from '../server/src/models/Supplier';
import PriceAgreement from '../server/src/models/PriceAgreement';

interface SeedSupplier {
  name: string;
  contactName: string;
  contactPhone: string;
  email: string;
  category: string;
  notes: string;
  agreements: {
    productName: string;
    unit: 'kg' | 'unit' | 'liter' | 'box' | 'other';
    agreedPrice: number; // in shekels — will be converted to agorot
  }[];
}

const SEED_SUPPLIERS: SeedSupplier[] = [
  {
    name: 'ירקות השרון בע"מ',
    contactName: 'יוסי כהן',
    contactPhone: '050-1234567',
    email: 'yossi@sharon-vegs.co.il',
    category: 'ירקות ופירות',
    notes: 'משלוחים בימי ב׳ וה׳',
    agreements: [
      { productName: 'עגבניות', unit: 'kg', agreedPrice: 5.90 },
      { productName: 'מלפפונים', unit: 'kg', agreedPrice: 4.50 },
      { productName: 'בצל', unit: 'kg', agreedPrice: 3.20 },
      { productName: 'תפוחי אדמה', unit: 'kg', agreedPrice: 4.00 },
    ],
  },
  {
    name: 'אספקת ניקיון נקי פלוס',
    contactName: 'מירי לוי',
    contactPhone: '052-9876543',
    email: 'miri@nakiplus.co.il',
    category: 'ניקוי',
    notes: 'הנחה על הזמנות מעל ₪500',
    agreements: [
      { productName: 'אקונומיקה 4 ליטר', unit: 'unit', agreedPrice: 12.90 },
      { productName: 'סבון כלים 1 ליטר', unit: 'unit', agreedPrice: 8.50 },
      { productName: 'מגבות נייר (6 גלילים)', unit: 'box', agreedPrice: 24.00 },
    ],
  },
  {
    name: 'משקאות גולן',
    contactName: 'דני אברהם',
    contactPhone: '054-5551234',
    email: 'orders@golan-drinks.co.il',
    category: 'מזון ושתייה',
    notes: 'מינימום הזמנה 10 קרטונים',
    agreements: [
      { productName: 'מים מינרליים 1.5 ליטר (שישייה)', unit: 'box', agreedPrice: 11.90 },
      { productName: 'קולה 1.5 ליטר', unit: 'unit', agreedPrice: 5.50 },
      { productName: 'מיץ תפוזים 1 ליטר', unit: 'unit', agreedPrice: 9.90 },
    ],
  },
  {
    name: 'ציוד משרדי המשולש',
    contactName: 'רונית שפירא',
    contactPhone: '053-7771234',
    email: 'ronit@hameshulash.co.il',
    category: 'ציוד משרדי',
    notes: '',
    agreements: [
      { productName: 'נייר A4 (חבילת 500)', unit: 'unit', agreedPrice: 19.90 },
      { productName: 'עט כדורי כחול (12 יח׳)', unit: 'box', agreedPrice: 15.00 },
      { productName: 'טונר מדפסת HP', unit: 'unit', agreedPrice: 189.00 },
    ],
  },
  {
    name: 'מאפיית הכרם',
    contactName: 'אבי מזרחי',
    contactPhone: '050-8882345',
    email: 'avi@hakerem-bakery.co.il',
    category: 'מזון',
    notes: 'הזמנות עד 14:00 ליום למחרת',
    agreements: [
      { productName: 'לחם אחיד', unit: 'unit', agreedPrice: 5.50 },
      { productName: 'חלה', unit: 'unit', agreedPrice: 8.90 },
      { productName: 'פיתות (10 יח׳)', unit: 'box', agreedPrice: 12.00 },
      { productName: 'עוגיות חמאה (ק"ג)', unit: 'kg', agreedPrice: 42.00 },
    ],
  },
  {
    name: 'פורניצ\'ר פלוס',
    contactName: 'שלומי בן דוד',
    contactPhone: '058-6665432',
    email: 'shlomi@furnitureplus.co.il',
    category: 'ריהוט',
    notes: 'התקנה כלולה בהזמנות מעל ₪2,000',
    agreements: [
      { productName: 'כיסא משרדי ארגונומי', unit: 'unit', agreedPrice: 450.00 },
      { productName: 'שולחן עבודה 120x60', unit: 'unit', agreedPrice: 680.00 },
    ],
  },
];

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: npx tsx scripts/seedDevData.ts <userId>');
    console.error('  Get your userId from the database or from the JWT token');
    process.exit(1);
  }

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/priceguard';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  const userObjectId = new Types.ObjectId(userId);

  for (const seed of SEED_SUPPLIERS) {
    // Skip if already exists
    const existing = await Supplier.findOne({ userId: userObjectId, name: seed.name });
    if (existing) {
      console.log(`  Skipping "${seed.name}" — already exists`);
      continue;
    }

    const supplier = await Supplier.create({
      userId: userObjectId,
      name: seed.name,
      contactName: seed.contactName,
      contactPhone: seed.contactPhone,
      email: seed.email,
      category: seed.category,
      notes: seed.notes,
    });

    console.log(`  Created supplier: ${seed.name}`);

    // Create price agreements
    for (const agreement of seed.agreements) {
      await PriceAgreement.create({
        userId: userObjectId,
        supplierId: supplier._id,
        productName: agreement.productName,
        unit: agreement.unit,
        agreedPrice: Math.round(agreement.agreedPrice * 100), // convert to agorot
        validFrom: new Date('2025-01-01'),
        validUntil: null,
      });
    }

    console.log(`    -> ${seed.agreements.length} price agreements created`);
  }

  console.log('\nDone. Dev data seeded successfully.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
