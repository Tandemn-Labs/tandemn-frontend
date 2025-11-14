/**
 * Merge Clerk Accounts Script
 * 
 * This script merges an old Clerk user account into a new one after a Clerk key change.
 * It will:
 * 1. Transfer all transactions from old account to new account
 * 2. Merge credits (removing duplicate welcome credits)
 * 3. Update API keys to point to new account
 * 4. Clean up old account
 */

import dbConnect from '../src/lib/database';
import UserAccount from '../src/lib/models/UserAccount';
import UserTransaction from '../src/lib/models/UserTransaction';
import UserAPIKey from '../src/lib/models/UserAPIKey';
import { createClerkClient } from '@clerk/nextjs/server';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

interface MergeStats {
  oldAccountCredits: number;
  newAccountCredits: number;
  transactionsMerged: number;
  apiKeysMerged: number;
  finalCredits: number;
}

async function findAccountByEmail(email: string) {
  const accounts = await UserAccount.find({ email });
  return accounts;
}

async function mergeAccounts(
  oldClerkUserId: string,
  newClerkUserId: string,
  dryRun: boolean = false
): Promise<MergeStats> {
  console.log('\n📊 Starting account merge...');
  console.log(`  Old Clerk User ID: ${oldClerkUserId}`);
  console.log(`  New Clerk User ID: ${newClerkUserId}`);
  console.log(`  Dry Run: ${dryRun ? 'YES' : 'NO'}`);

  // Find both accounts
  const oldAccount = await UserAccount.findOne({ clerkUserId: oldClerkUserId });
  const newAccount = await UserAccount.findOne({ clerkUserId: newClerkUserId });

  if (!oldAccount) {
    throw new Error(`Old account not found for Clerk user ID: ${oldClerkUserId}`);
  }

  if (!newAccount) {
    throw new Error(`New account not found for Clerk user ID: ${newClerkUserId}`);
  }

  console.log(`\n✅ Found both accounts:`);
  console.log(`  Old Account: ${oldAccount.email} ($${oldAccount.credits.toFixed(2)})`);
  console.log(`  New Account: ${newAccount.email} ($${newAccount.credits.toFixed(2)})`);

  // Get all transactions from old account
  const oldTransactions = await UserTransaction.find({ clerkUserId: oldClerkUserId });
  console.log(`\n📜 Found ${oldTransactions.length} transactions in old account`);

  // Check for duplicate welcome credits
  const oldWelcomeCredits = oldTransactions.find(
    tx => tx.type === 'bonus_credit' && tx.description === 'Welcome bonus credits'
  );
  const newWelcomeCredits = await UserTransaction.findOne({
    clerkUserId: newClerkUserId,
    type: 'bonus_credit',
    description: 'Welcome bonus credits',
  });

  let creditsToTransfer = oldAccount.credits;
  const transactionsToMerge = [...oldTransactions];

  // If both accounts have welcome credits, we need to remove the duplicate
  if (oldWelcomeCredits && newWelcomeCredits) {
    console.log(`\n⚠️  Both accounts have welcome credits detected`);
    console.log(`  Old welcome: $${oldWelcomeCredits.amount.toFixed(2)}`);
    console.log(`  New welcome: $${newWelcomeCredits.amount.toFixed(2)}`);
    
    // Remove duplicate welcome credits from transfer
    creditsToTransfer -= newWelcomeCredits.amount;
    
    // Filter out the old welcome credits transaction (we'll keep the one in new account)
    console.log(`  → Will remove duplicate $${newWelcomeCredits.amount.toFixed(2)} welcome credits`);
  }

  const finalCredits = newAccount.credits + creditsToTransfer;

  console.log(`\n💰 Credit calculation:`);
  console.log(`  Old account: $${oldAccount.credits.toFixed(2)}`);
  console.log(`  New account: $${newAccount.credits.toFixed(2)}`);
  console.log(`  Credits to transfer: $${creditsToTransfer.toFixed(2)}`);
  console.log(`  Final total: $${finalCredits.toFixed(2)}`);

  // Get API keys from old account
  const oldAPIKeys = await UserAPIKey.find({ clerkUserId: oldClerkUserId });
  console.log(`\n🔑 Found ${oldAPIKeys.length} API keys in old account`);

  if (dryRun) {
    console.log(`\n🔍 DRY RUN - No changes made`);
    return {
      oldAccountCredits: oldAccount.credits,
      newAccountCredits: newAccount.credits,
      transactionsMerged: transactionsToMerge.length,
      apiKeysMerged: oldAPIKeys.length,
      finalCredits,
    };
  }

  // Perform the merge
  console.log(`\n🔄 Performing merge...`);

  // 1. Update all transactions to point to new account
  const transactionUpdateResult = await UserTransaction.updateMany(
    { clerkUserId: oldClerkUserId },
    {
      $set: {
        clerkUserId: newClerkUserId,
        userId: newAccount._id.toString(),
      },
    }
  );
  console.log(`  ✅ Updated ${transactionUpdateResult.modifiedCount} transactions`);

  // 2. Update all API keys to point to new account
  const apiKeyUpdateResult = await UserAPIKey.updateMany(
    { clerkUserId: oldClerkUserId },
    {
      $set: {
        clerkUserId: newClerkUserId,
        userId: newAccount._id.toString(),
      },
    }
  );
  console.log(`  ✅ Updated ${apiKeyUpdateResult.modifiedCount} API keys`);

  // 3. Update new account with merged credits
  await UserAccount.findByIdAndUpdate(newAccount._id, {
    credits: finalCredits,
    lastCreditUpdate: new Date(),
  });
  console.log(`  ✅ Updated credits to $${finalCredits.toFixed(2)}`);

  // 4. Delete old account
  await UserAccount.findByIdAndDelete(oldAccount._id);
  console.log(`  ✅ Deleted old account`);

  return {
    oldAccountCredits: oldAccount.credits,
    newAccountCredits: newAccount.credits,
    transactionsMerged: transactionUpdateResult.modifiedCount || 0,
    apiKeysMerged: apiKeyUpdateResult.modifiedCount || 0,
    finalCredits,
  };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Merge Clerk Accounts After Key Change             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const emailArg = args.find(arg => arg.startsWith('--email='));
  const oldClerkUserIdArg = args.find(arg => arg.startsWith('--old-id='));
  const newClerkUserIdArg = args.find(arg => arg.startsWith('--new-id='));

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Connect to MongoDB
  console.log('📊 Connecting to MongoDB...');
  await dbConnect();
  console.log('✅ MongoDB connected\n');

  let oldClerkUserId: string | undefined;
  let newClerkUserId: string | undefined;

  // Method 1: Find by email
  if (emailArg) {
    const email = emailArg.split('=')[1];
    console.log(`🔍 Searching for accounts with email: ${email}`);
    
    const accounts = await findAccountByEmail(email);
    
    if (accounts.length === 0) {
      console.error(`❌ No accounts found with email: ${email}`);
      process.exit(1);
    }

    if (accounts.length === 1) {
      console.error(`❌ Only one account found with email: ${email}`);
      console.log('   You need two accounts (old and new) to merge.');
      console.log('   If you only see one account, the merge may have already been done,');
      console.log('   or you need to log in with the new Clerk key to create the new account.');
      process.exit(1);
    }

    if (accounts.length > 2) {
      console.error(`❌ Found ${accounts.length} accounts with email: ${email}`);
      console.log('\nAccounts found:');
      accounts.forEach((acc, idx) => {
        console.log(`  ${idx + 1}. Clerk ID: ${acc.clerkUserId}`);
        console.log(`     Credits: $${acc.credits.toFixed(2)}`);
        console.log(`     Created: ${acc.createdAt}`);
      });
      console.log('\nPlease specify which accounts to merge using:');
      console.log('  npm run merge:accounts -- --old-id=<old_clerk_id> --new-id=<new_clerk_id>');
      process.exit(1);
    }

    // We have exactly 2 accounts - determine which is old and which is new
    const [account1, account2] = accounts.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    oldClerkUserId = account1.clerkUserId;
    newClerkUserId = account2.clerkUserId;

    console.log(`\n✅ Found 2 accounts:`);
    console.log(`  Old Account (created ${account1.createdAt.toLocaleDateString()}):`);
    console.log(`    Clerk ID: ${oldClerkUserId}`);
    console.log(`    Credits: $${account1.credits.toFixed(2)}`);
    console.log(`  New Account (created ${account2.createdAt.toLocaleDateString()}):`);
    console.log(`    Clerk ID: ${newClerkUserId}`);
    console.log(`    Credits: $${account2.credits.toFixed(2)}`);
  }
  // Method 2: Specify IDs directly
  else if (oldClerkUserIdArg && newClerkUserIdArg) {
    oldClerkUserId = oldClerkUserIdArg.split('=')[1];
    newClerkUserId = newClerkUserIdArg.split('=')[1];
  }
  // Method 3: No arguments - show help
  else {
    console.log('Usage:');
    console.log('  npm run merge:accounts -- --email=your@email.com [--dry-run]');
    console.log('  or');
    console.log('  npm run merge:accounts -- --old-id=<old_clerk_id> --new-id=<new_clerk_id> [--dry-run]');
    console.log('\nOptions:');
    console.log('  --email=EMAIL        Find accounts by email (will auto-detect old vs new)');
    console.log('  --old-id=ID          Old Clerk user ID');
    console.log('  --new-id=ID          New Clerk user ID');
    console.log('  --dry-run            Preview changes without making them');
    console.log('\nExample:');
    console.log('  npm run merge:accounts -- --email=user@example.com --dry-run');
    process.exit(1);
  }

  if (!oldClerkUserId || !newClerkUserId) {
    console.error('❌ Could not determine old and new Clerk user IDs');
    process.exit(1);
  }

  // Perform the merge
  try {
    const stats = await mergeAccounts(oldClerkUserId, newClerkUserId, dryRun);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Merge Summary                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n  Old account credits:    $${stats.oldAccountCredits.toFixed(2)}`);
    console.log(`  New account credits:    $${stats.newAccountCredits.toFixed(2)}`);
    console.log(`  Transactions merged:    ${stats.transactionsMerged}`);
    console.log(`  API keys merged:        ${stats.apiKeysMerged}`);
    console.log(`  Final credits:          $${stats.finalCredits.toFixed(2)}`);

    if (dryRun) {
      console.log('\n🔍 This was a DRY RUN - no changes were made');
      console.log('   Run without --dry-run to perform the actual merge');
    } else {
      console.log('\n✅ Merge completed successfully!');
      console.log('   You should now see the correct credits when you log in.');
    }
  } catch (error) {
    console.error('\n❌ Error during merge:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();

