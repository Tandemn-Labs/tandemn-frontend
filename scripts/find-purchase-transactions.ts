/**
 * Find Purchase Transactions
 * Search for credit_purchase transactions in the database
 */

import dbConnect from '../src/lib/database';
import UserTransaction from '../src/lib/models/UserTransaction';
import UserAccount from '../src/lib/models/UserAccount';

async function main() {
  console.log('Searching for purchase transactions...\n');

  await dbConnect();

  // Find all credit purchase transactions
  const purchases = await UserTransaction.find({
    type: 'credit_purchase',
  }).sort({ createdAt: -1 });

  console.log(`Found ${purchases.length} credit purchase transaction(s):\n`);

  for (const tx of purchases) {
    console.log(`Transaction ID: ${tx._id}`);
    console.log(`  Clerk User ID: ${tx.clerkUserId}`);
    console.log(`  Amount: $${tx.amount.toFixed(2)}`);
    console.log(`  Description: ${tx.description}`);
    console.log(`  Status: ${tx.status}`);
    console.log(`  Created: ${tx.createdAt}`);

    // Try to find the associated account
    const account = await UserAccount.findOne({ clerkUserId: tx.clerkUserId });
    if (account) {
      console.log(`  Account Email: ${account.email}`);
      console.log(`  Account Credits: $${account.credits.toFixed(2)}`);
    } else {
      console.log(`  Account: NOT FOUND`);
    }
    console.log('');
  }

  // Also check for any failed/pending purchases
  const failedPurchases = await UserTransaction.find({
    type: 'credit_purchase',
    status: { $ne: 'completed' },
  });

  if (failedPurchases.length > 0) {
    console.log(`\n⚠️  Found ${failedPurchases.length} non-completed purchase(s):`);
    failedPurchases.forEach(tx => {
      console.log(`  - ${tx.description} | $${tx.amount} | Status: ${tx.status}`);
    });
  }

  process.exit(0);
}

main();

