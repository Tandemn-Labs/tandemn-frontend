/**
 * Check User Transactions
 * Quick script to view transaction history for both accounts
 */

import dbConnect from '../src/lib/database';
import UserAccount from '../src/lib/models/UserAccount';
import UserTransaction from '../src/lib/models/UserTransaction';

async function main() {
  console.log('Checking user transactions...\n');

  const email = process.argv[2];
  if (!email) {
    console.error('Usage: tsx scripts/check-user-transactions.ts <email>');
    process.exit(1);
  }

  await dbConnect();

  // Find all accounts with this email
  const accounts = await UserAccount.find({ email }).sort({ createdAt: 1 });

  if (accounts.length === 0) {
    console.log('No accounts found for:', email);
    process.exit(0);
  }

  console.log(`Found ${accounts.length} account(s) for ${email}:\n`);

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    console.log(`Account ${i + 1} (${i === 0 ? 'OLD' : 'NEW'}):`);
    console.log(`  Clerk ID: ${account.clerkUserId}`);
    console.log(`  Credits: $${account.credits.toFixed(2)}`);
    console.log(`  Created: ${account.createdAt}`);

    // Get transactions
    const transactions = await UserTransaction.find({
      clerkUserId: account.clerkUserId,
    }).sort({ createdAt: 1 });

    console.log(`  Transactions (${transactions.length}):`);
    transactions.forEach(tx => {
      console.log(`    - ${tx.createdAt.toLocaleDateString()} | ${tx.type.padEnd(20)} | ${tx.amount >= 0 ? '+' : ''}$${tx.amount.toFixed(2)} | ${tx.description}`);
    });
    console.log('');
  }

  process.exit(0);
}

main();

