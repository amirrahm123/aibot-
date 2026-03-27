/**
 * One-time migration: Remove test/dummy suppliers and their related data.
 * Removes suppliers with:
 *   - Name shorter than 2 characters
 *   - Names with repeated character patterns (e.g. "זסבזסבז", "זיביביבי")
 *   - Known test patterns
 *
 * Also removes orphaned invoices and agreements belonging to deleted suppliers.
 *
 * Safe to run multiple times (idempotent).
 *
 * Usage: npx tsx scripts/cleanTestData.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
dotenv.config();

import mongoose from 'mongoose';
import Supplier from '../server/src/models/Supplier';
import Invoice from '../server/src/models/Invoice';
import PriceAgreement from '../server/src/models/PriceAgreement';

/**
 * Check if a name looks like test/garbage data.
 */
function isTestSupplier(name: string): boolean {
  const trimmed = name.trim();

  // Too short
  if (trimmed.length < 2) return true;

  // Single character repeated
  if (new Set(trimmed.replace(/\s/g, '')).size === 1) return true;

  // Repeated 2-3 char patterns (e.g., "זסבזסב", "אבאבאב")
  const noSpaces = trimmed.replace(/\s/g, '');
  for (let patLen = 2; patLen <= 3; patLen++) {
    if (noSpaces.length >= patLen * 2) {
      const pattern = noSpaces.slice(0, patLen);
      const repeated = pattern.repeat(Math.ceil(noSpaces.length / patLen)).slice(0, noSpaces.length);
      if (repeated === noSpaces) return true;
    }
  }

  // Known test patterns (add more as needed)
  const testPatterns = [
    /^test/i,
    /^dummy/i,
    /^בדיקה$/,
    /^טסט$/,
  ];
  if (testPatterns.some((p) => p.test(trimmed))) return true;

  return false;
}

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/priceguard';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  // Find all test suppliers
  const allSuppliers = await Supplier.find({}).lean();
  const testSuppliers = allSuppliers.filter((s) => isTestSupplier(s.name));

  if (testSuppliers.length === 0) {
    console.log('No test/dummy suppliers found. Database is clean.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${testSuppliers.length} test/dummy suppliers:\n`);

  for (const supplier of testSuppliers) {
    console.log(`  "${supplier.name}" (ID: ${supplier._id})`);

    // Count related data
    const invoiceCount = await Invoice.countDocuments({ supplierId: supplier._id });
    const agreementCount = await PriceAgreement.countDocuments({ supplierId: supplier._id });

    console.log(`    -> ${invoiceCount} invoices, ${agreementCount} agreements`);

    // Delete related invoices and agreements
    if (invoiceCount > 0) {
      await Invoice.deleteMany({ supplierId: supplier._id });
      console.log(`    -> Removed ${invoiceCount} invoices`);
    }
    if (agreementCount > 0) {
      await PriceAgreement.deleteMany({ supplierId: supplier._id });
      console.log(`    -> Removed ${agreementCount} agreements`);
    }

    // Delete the supplier
    await Supplier.deleteOne({ _id: supplier._id });
    console.log(`    -> Supplier deleted`);
    console.log('');
  }

  console.log(`Done. Removed ${testSuppliers.length} test suppliers and their related data.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
