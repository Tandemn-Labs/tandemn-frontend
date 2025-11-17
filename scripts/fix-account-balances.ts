/**
 * Fix Account Balances Script
 * 
 * This script audits and fixes account balances to ensure they match transaction history
 */

import dbConnect from '../src/lib/database';
import UserAccount from '../src/lib/models/UserAccount';
import UserTransaction from '../src/lib/models/UserTransaction';

interface AccountAudit {
  email: string;
  clerkUserId: string;
  currentCredits: number;
  calculatedCredits: number;
  transactionCount: number;
  issues: string[];
  transactions: any[];
}

async function auditAccount(email: string): Promise<AccountAudit> {
  const account = await UserAccount.findOne({ email });
  
  if (!account) {
    throw new Error(`Account not found: ${email}`);
  }

  const transactions = await UserTransaction.find({
    clerkUserId: account.clerkUserId,
  }).sort({ createdAt: 1 });

  const issues: string[] = [];
  
  // Calculate what the balance should be based on transactions
  let calculatedCredits = 0;
  transactions.forEach(tx => {
    calculatedCredits += tx.amount;
  });

  // Check for duplicate welcome credits
  const welcomeCredits = transactions.filter(
    tx => tx.type === 'bonus_credit' && tx.description === 'Welcome bonus credits'
  );
  
  if (welcomeCredits.length > 1) {
    issues.push(`Found ${welcomeCredits.length} welcome credit transactions (should be 1)`);
  }

  // Check if balance matches
  if (Math.abs(account.credits - calculatedCredits) > 0.01) {
    issues.push(`Balance mismatch: Account shows $${account.credits.toFixed(2)} but transactions sum to $${calculatedCredits.toFixed(2)}`);
  }

  return {
    email: account.email,
    clerkUserId: account.clerkUserId,
    currentCredits: account.credits,
    calculatedCredits,
    transactionCount: transactions.length,
    issues,
    transactions: transactions.map(tx => ({
      id: tx._id.toString(),
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      createdAt: tx.createdAt,
    })),
  };
}

async function fixAccount(email: string, expectedBalance: number, dryRun: boolean = false): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Fixing account: ${email}`);
  console.log(`${'='.repeat(60)}\n`);

  const audit = await auditAccount(email);
  
  console.log('Current State:');
  console.log(`  Clerk ID: ${audit.clerkUserId}`);
  console.log(`  Current Balance: $${audit.currentCredits.toFixed(2)}`);
  console.log(`  Calculated from Transactions: $${audit.calculatedCredits.toFixed(2)}`);
  console.log(`  Expected Balance: $${expectedBalance.toFixed(2)}`);
  console.log(`  Transaction Count: ${audit.transactionCount}`);
  
  if (audit.issues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    audit.issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('\n✅ No issues found');
  }

  console.log('\nTransactions:');
  audit.transactions.forEach((tx, idx) => {
    console.log(`  ${idx + 1}. ${tx.createdAt.toLocaleDateString()} | ${tx.type.padEnd(20)} | ${tx.amount >= 0 ? '+' : ''}$${tx.amount.toFixed(2)} | ${tx.description}`);
  });

  // Find duplicate welcome credits
  const welcomeCredits = audit.transactions.filter(
    tx => tx.type === 'bonus_credit' && tx.description === 'Welcome bonus credits'
  );

  if (welcomeCredits.length > 1) {
    console.log(`\n🔧 Fix: Remove ${welcomeCredits.length - 1} duplicate welcome credit transaction(s)`);
    
    // Keep the oldest one, remove the rest
    const toRemove = welcomeCredits.slice(1);
    
    if (!dryRun) {
      for (const tx of toRemove) {
        await UserTransaction.findByIdAndDelete(tx.id);
        console.log(`  ✅ Deleted duplicate welcome credit from ${new Date(tx.createdAt).toLocaleDateString()}`);
      }
    } else {
      toRemove.forEach(tx => {
        console.log(`  [DRY RUN] Would delete duplicate welcome credit from ${new Date(tx.createdAt).toLocaleDateString()}`);
      });
    }
  }

  // Recalculate after potential deletions
  const account = await UserAccount.findOne({ email });
  const remainingTransactions = await UserTransaction.find({
    clerkUserId: account!.clerkUserId,
  });
  
  let newCalculatedBalance = 0;
  remainingTransactions.forEach(tx => {
    newCalculatedBalance += tx.amount;
  });

  console.log(`\n💰 Balance Check:`);
  console.log(`  Current account balance: $${account!.credits.toFixed(2)}`);
  console.log(`  Calculated from remaining transactions: $${newCalculatedBalance.toFixed(2)}`);
  console.log(`  Expected balance: $${expectedBalance.toFixed(2)}`);

  // If calculated balance doesn't match expected, update the account
  if (Math.abs(newCalculatedBalance - expectedBalance) > 0.01) {
    console.log(`\n⚠️  Balance mismatch! Transactions sum to $${newCalculatedBalance.toFixed(2)} but expected $${expectedBalance.toFixed(2)}`);
  } else if (Math.abs(account!.credits - expectedBalance) > 0.01) {
    console.log(`\n🔧 Fix: Update account balance from $${account!.credits.toFixed(2)} to $${expectedBalance.toFixed(2)}`);
    
    if (!dryRun) {
      await UserAccount.findByIdAndUpdate(account!._id, {
        credits: expectedBalance,
        lastCreditUpdate: new Date(),
      });
      console.log(`  ✅ Account balance updated to $${expectedBalance.toFixed(2)}`);
    } else {
      console.log(`  [DRY RUN] Would update account balance to $${expectedBalance.toFixed(2)}`);
    }
  } else {
    console.log(`\n✅ Balance is correct!`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              Fix Account Balances Script                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  await dbConnect();
  console.log('✅ MongoDB connected\n');

  // Fix both accounts
  await fixAccount('ishanpragada@gmail.com', 20.00, dryRun);
  await fixAccount('ibuyy@illinois.edu', 21.00, dryRun);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                        Summary                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (dryRun) {
    console.log('🔍 This was a DRY RUN - no changes were made');
    console.log('   Run without --dry-run to apply fixes');
  } else {
    console.log('✅ Account balances have been fixed!');
    console.log('   - ishanpragada@gmail.com: $20.00');
    console.log('   - ibuyy@illinois.edu: $21.00');
  }

  process.exit(0);
}

main();

