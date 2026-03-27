/**
 * One-time migration: Remove duplicate invoices from the database.
 * Keeps the most recently uploaded version of each (supplierId + invoiceNumber + invoiceDate) group.
 *
 * Safe to run multiple times (idempotent).
 *
 * Usage: npx tsx scripts/deduplicateInvoices.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
dotenv.config();

import mongoose from 'mongoose';
import Invoice from '../server/src/models/Invoice';

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/priceguard';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  // Find duplicate groups: same (supplierId, invoiceNumber, invoiceDate) with count > 1
  // Only consider invoices that actually have an invoiceNumber (null invoiceNumbers are unique)
  const duplicates = await Invoice.aggregate([
    {
      $match: {
        invoiceNumber: { $ne: null, $exists: true },
        invoiceDate: { $ne: null, $exists: true },
      },
    },
    {
      $group: {
        _id: {
          supplierId: '$supplierId',
          invoiceNumber: '$invoiceNumber',
          invoiceDate: '$invoiceDate',
        },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
        uploadDates: { $push: '$uploadedAt' },
      },
    },
    {
      $match: { count: { $gt: 1 } },
    },
  ]);

  if (duplicates.length === 0) {
    console.log('No duplicate invoices found. Database is clean.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${duplicates.length} duplicate groups:\n`);

  let totalRemoved = 0;

  for (const group of duplicates) {
    const { supplierId, invoiceNumber, invoiceDate } = group._id;
    console.log(`  Supplier: ${supplierId}, Invoice: ${invoiceNumber}, Date: ${invoiceDate}`);
    console.log(`  ${group.count} copies found`);

    // Find all invoices in this group, sorted by uploadedAt descending (keep newest)
    const invoices = await Invoice.find({
      supplierId,
      invoiceNumber,
      invoiceDate,
    }).sort({ uploadedAt: -1 });

    // Keep the first one (most recent), delete the rest
    const toKeep = invoices[0];
    const toDelete = invoices.slice(1);

    console.log(`  Keeping: ${toKeep._id} (uploaded ${toKeep.uploadedAt})`);

    for (const dup of toDelete) {
      console.log(`  Removing: ${dup._id} (uploaded ${dup.uploadedAt})`);
      await Invoice.deleteOne({ _id: dup._id });
      totalRemoved++;
    }

    console.log('');
  }

  console.log(`Done. Removed ${totalRemoved} duplicate invoices.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
