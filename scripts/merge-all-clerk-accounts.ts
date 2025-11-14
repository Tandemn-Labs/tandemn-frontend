/**
 * Merge All Duplicate Clerk Accounts Script
 * 
 * This script finds and merges ALL duplicate accounts caused by a Clerk key change.
 * It will:
 * 1. Find all emails with multiple accounts
 * 2. For each duplicate, merge old account into new account
 * 3. Transfer all transactions and credits
 * 4. Update API keys
 * 5. Clean up old accounts
 */

import dbConnect from '../src/lib/database';
import UserAccount from '../src/lib/models/UserAccount';
import UserTransaction from '../src/lib/models/UserTransaction';
import UserAPIKey from '../src/lib/models/UserAPIKey';

interface AccountGroup {
  email: string;
  accounts: Array<{
    _id: string;
    clerkUserId: string;
    credits: number;
    createdAt: Date;
  }>;
}

interface MergeResult {
  email: string;
  success: boolean;
  oldClerkUserId: string;
  newClerkUserId: string;
  oldCredits: number;
  newCredits: number;
  finalCredits: number;
  transactionsMerged: number;
  apiKeysMerged: number;
  error?: string;
}

async function findDuplicateAccounts(): Promise<AccountGroup[]> {
  console.log('🔍 Searching for duplicate accounts...\n');
  
  // Aggregate to find emails with multiple accounts
  const duplicates = await UserAccount.aggregate([
    {
      $group: {
        _id: '$email',
        count: { $sum: 1 },
        accounts: {
          $push: {
            _id: '$_id',
            clerkUserId: '$clerkUserId',
            credits: '$credits',
            createdAt: '$createdAt',
          },
        },
      },
    },
    {
      $match: {
        count: { $gt: 1 }, // Only emails with more than 1 account
      },
    },
    {
      $project: {
        email: '$_id',
        accounts: 1,
        _id: 0,
      },
    },
  ]);

  return duplicates;
}

async function mergeAccountPair(
  oldAccount: any,
  newAccount: any,
  email: string,
  dryRun: boolean
): Promise<MergeResult> {
  const result: MergeResult = {
    email,
    success: false,
    oldClerkUserId: oldAccount.clerkUserId,
    newClerkUserId: newAccount.clerkUserId,
    oldCredits: oldAccount.credits,
    newCredits: newAccount.credits,
    finalCredits: 0,
    transactionsMerged: 0,
    apiKeysMerged: 0,
  };

  try {
    // Get transactions from old account
    const oldTransactions = await UserTransaction.find({
      clerkUserId: oldAccount.clerkUserId,
    });

    // Check for duplicate welcome credits
    const oldWelcomeCredits = oldTransactions.find(
      tx => tx.type === 'bonus_credit' && tx.description === 'Welcome bonus credits'
    );
    const newWelcomeCredits = await UserTransaction.findOne({
      clerkUserId: newAccount.clerkUserId,
      type: 'bonus_credit',
      description: 'Welcome bonus credits',
    });

    let creditsToTransfer = oldAccount.credits;

    // Remove duplicate welcome credits if both accounts have them
    if (oldWelcomeCredits && newWelcomeCredits) {
      creditsToTransfer -= newWelcomeCredits.amount;
    }

    result.finalCredits = newAccount.credits + creditsToTransfer;

    // Get API keys count
    const oldAPIKeys = await UserAPIKey.countDocuments({
      clerkUserId: oldAccount.clerkUserId,
    });

    result.apiKeysMerged = oldAPIKeys;

    if (dryRun) {
      result.transactionsMerged = oldTransactions.length;
      result.success = true;
      return result;
    }

    // Perform the merge
    // 1. Update all transactions
    const txUpdateResult = await UserTransaction.updateMany(
      { clerkUserId: oldAccount.clerkUserId },
      {
        $set: {
          clerkUserId: newAccount.clerkUserId,
          userId: newAccount._id.toString(),
        },
      }
    );
    result.transactionsMerged = txUpdateResult.modifiedCount || 0;

    // 2. Update all API keys
    await UserAPIKey.updateMany(
      { clerkUserId: oldAccount.clerkUserId },
      {
        $set: {
          clerkUserId: newAccount.clerkUserId,
          userId: newAccount._id.toString(),
        },
      }
    );

    // 3. Update new account with merged credits
    await UserAccount.findByIdAndUpdate(newAccount._id, {
      credits: result.finalCredits,
      lastCreditUpdate: new Date(),
    });

    // 4. Delete old account
    await UserAccount.findByIdAndDelete(oldAccount._id);

    result.success = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

async function mergeAllDuplicates(dryRun: boolean = false): Promise<MergeResult[]> {
  const duplicateGroups = await findDuplicateAccounts();

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate accounts found!\n');
    return [];
  }

  console.log(`Found ${duplicateGroups.length} email(s) with duplicate accounts:\n`);

  const results: MergeResult[] = [];

  for (let i = 0; i < duplicateGroups.length; i++) {
    const group = duplicateGroups[i];
    console.log(`[${i + 1}/${duplicateGroups.length}] Processing: ${group.email}`);
    console.log(`  Found ${group.accounts.length} accounts`);

    if (group.accounts.length > 2) {
      console.log(`  ⚠️  WARNING: More than 2 accounts found. Skipping for safety.`);
      console.log(`     Please merge this email manually using:`);
      console.log(`     npm run merge:accounts -- --email=${group.email}\n`);
      continue;
    }

    // Sort by creation date (oldest first)
    const sortedAccounts = group.accounts.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    const oldAccount = sortedAccounts[0];
    const newAccount = sortedAccounts[1];

    console.log(`  Old Account: ${oldAccount.clerkUserId.substring(0, 20)}... ($${oldAccount.credits.toFixed(2)})`);
    console.log(`  New Account: ${newAccount.clerkUserId.substring(0, 20)}... ($${newAccount.credits.toFixed(2)})`);

    const result = await mergeAccountPair(oldAccount, newAccount, group.email, dryRun);

    if (result.success) {
      console.log(`  ✅ ${dryRun ? '[DRY RUN] Would merge' : 'Merged'} successfully`);
      console.log(`     Final credits: $${result.finalCredits.toFixed(2)}`);
      console.log(`     Transactions: ${result.transactionsMerged}`);
      console.log(`     API Keys: ${result.apiKeysMerged}`);
    } else {
      console.log(`  ❌ Failed: ${result.error}`);
    }

    console.log('');
    results.push(result);
  }

  return results;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Merge All Duplicate Clerk Accounts (Bulk)           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Connect to MongoDB
  console.log('📊 Connecting to MongoDB...');
  await dbConnect();
  console.log('✅ MongoDB connected\n');

  // Perform bulk merge
  const results = await mergeAllDuplicates(dryRun);

  if (results.length === 0) {
    console.log('No merges needed.');
    process.exit(0);
  }

  // Print summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Merge Summary                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalCreditsAdded = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + (r.finalCredits - r.newCredits), 0);
  const totalTransactions = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.transactionsMerged, 0);
  const totalApiKeys = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.apiKeysMerged, 0);

  console.log(`  Total accounts processed:  ${results.length}`);
  console.log(`  Successful merges:         ${successful}`);
  console.log(`  Failed merges:             ${failed}`);
  console.log(`  Credits restored:          $${totalCreditsAdded.toFixed(2)}`);
  console.log(`  Transactions merged:       ${totalTransactions}`);
  console.log(`  API keys migrated:         ${totalApiKeys}`);
  console.log('');

  if (failed > 0) {
    console.log('❌ Failed merges:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - ${r.email}: ${r.error}`);
      });
    console.log('');
  }

  if (dryRun) {
    console.log('🔍 This was a DRY RUN - no changes were made');
    console.log('   Run without --dry-run to perform the actual merges');
  } else {
    console.log('✅ Bulk merge completed!');
    console.log('   Users should log out and log back in to see updated credits.');
  }

  process.exit(0);
}

main();

