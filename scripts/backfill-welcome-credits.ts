/**
 * Backfill welcome bonus credit transactions for existing users who are missing them
 * Usage: npx tsx scripts/backfill-welcome-credits.ts [--dry-run] [--email <email>]
 */

import dbConnect from '../src/lib/database';
import UserAccount from '../src/lib/models/UserAccount';
import UserTransaction from '../src/lib/models/UserTransaction';

async function backfillWelcomeCredits(dryRun: boolean = false, specificEmail?: string) {
  try {
    console.log(`\n🔍 Backfilling welcome bonus credit transactions${dryRun ? ' (DRY RUN)' : ''}...\n`);
    
    await dbConnect();
    console.log('✅ Connected to MongoDB\n');

    // Build query
    const query = specificEmail 
      ? { email: { $regex: new RegExp(`^${specificEmail}`, 'i') } }
      : {};

    // Find all user accounts
    const accounts = await UserAccount.find(query);
    console.log(`📋 Found ${accounts.length} user account(s)\n`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const account of accounts) {
      try {
        // Check if user already has a welcome bonus transaction
        const existingWelcomeBonus = await UserTransaction.findOne({
          $or: [
            { userId: account._id.toString() },
            { clerkUserId: account.clerkUserId }
          ],
          type: 'bonus_credit',
          description: 'Welcome bonus credits'
        });

        if (existingWelcomeBonus) {
          console.log(`⏭️  Skipping ${account.email} - already has welcome bonus transaction`);
          skippedCount++;
          continue;
        }

        // Get user's total transaction history
        const transactions = await UserTransaction.find({
          $or: [
            { userId: account._id.toString() },
            { clerkUserId: account.clerkUserId }
          ]
        }).sort({ createdAt: 1 });

        // Calculate expected balance from transactions
        const calculatedBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
        const actualBalance = account.credits;
        const discrepancy = actualBalance - calculatedBalance;

        console.log(`\n👤 ${account.email}`);
        console.log(`   MongoDB ID: ${account._id.toString()}`);
        console.log(`   Clerk ID: ${account.clerkUserId}`);
        console.log(`   Actual Balance: $${actualBalance.toFixed(2)}`);
        console.log(`   Calculated from Transactions: $${calculatedBalance.toFixed(2)}`);
        console.log(`   Discrepancy: $${discrepancy.toFixed(2)}`);
        console.log(`   Existing Transactions: ${transactions.length}`);

        // If there's a discrepancy close to $20, add the welcome bonus transaction
        if (discrepancy >= 19.00 && discrepancy <= 21.00) {
          if (dryRun) {
            console.log(`   ✓ Would add welcome bonus transaction for $20.00`);
          } else {
            // Use the account creation date for the transaction
            const welcomeTransaction = new UserTransaction({
              userId: account._id.toString(),
              clerkUserId: account.clerkUserId,
              type: 'bonus_credit',
              amount: 20.00,
              description: 'Welcome bonus credits',
              status: 'completed',
              createdAt: account.createdAt, // Use account creation date
              updatedAt: account.createdAt,
            });
            await welcomeTransaction.save();
            console.log(`   ✅ Added welcome bonus transaction for $20.00`);
          }
          processedCount++;
        } else if (Math.abs(discrepancy) < 0.01) {
          console.log(`   ✓ Balance matches transactions - no action needed`);
          skippedCount++;
        } else {
          console.log(`   ⚠️  Unusual discrepancy detected - manual review recommended`);
          skippedCount++;
        }

      } catch (error) {
        console.error(`   ❌ Error processing ${account.email}:`, error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   Total Accounts: ${accounts.length}`);
    console.log(`   Processed: ${processedCount}${dryRun ? ' (would be added)' : ' (added)'}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    
    if (dryRun) {
      console.log('\n💡 Run without --dry-run to apply changes\n');
    } else {
      console.log('\n✅ Backfill complete!\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const emailIndex = args.indexOf('--email');
const specificEmail = emailIndex !== -1 && args[emailIndex + 1] ? args[emailIndex + 1] : undefined;

if (args.includes('--help')) {
  console.log(`
Usage: npx tsx scripts/backfill-welcome-credits.ts [options]

Options:
  --dry-run          Run without making changes (preview mode)
  --email <email>    Only process specific user by email
  --help             Show this help message

Examples:
  npx tsx scripts/backfill-welcome-credits.ts --dry-run
  npx tsx scripts/backfill-welcome-credits.ts --email ibuyy@illinois
  npx tsx scripts/backfill-welcome-credits.ts
`);
  process.exit(0);
}

backfillWelcomeCredits(dryRun, specificEmail);

