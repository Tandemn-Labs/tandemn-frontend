/**
 * Debug script to check user credits and transactions
 * Usage: npx tsx scripts/check-user-credits.ts <email>
 */

import dbConnect from '../src/lib/database';
import UserAccount from '../src/lib/models/UserAccount';
import UserTransaction from '../src/lib/models/UserTransaction';
import { cache, CacheKeys } from '../src/lib/cache';

async function checkUserCredits(email: string) {
  try {
    console.log(`\n🔍 Checking credits and transactions for: ${email}\n`);
    
    await dbConnect();
    console.log('✅ Connected to MongoDB\n');

    // Find user account by email
    const account = await UserAccount.findOne({ 
      email: { $regex: new RegExp(`^${email}`, 'i') } 
    });

    if (!account) {
      console.error(`❌ No account found for email: ${email}`);
      return;
    }

    console.log('📋 Account Details:');
    console.log('  MongoDB ID:', account._id.toString());
    console.log('  Clerk User ID:', account.clerkUserId);
    console.log('  Email:', account.email);
    console.log('  Credits:', account.credits);
    console.log('  Last Credit Update:', account.lastCreditUpdate || 'Never');
    console.log('  Created:', account.createdAt);
    console.log('  Updated:', account.updatedAt);
    
    // Check cache
    const cachedCredits = cache.get<number>(CacheKeys.userCredits(account.clerkUserId));
    console.log('\n💾 Cache Status:');
    console.log('  Cached Credits:', cachedCredits !== null ? cachedCredits : 'Not cached');
    
    // Get all transactions for this user
    const transactions = await UserTransaction.find({ 
      $or: [
        { userId: account._id.toString() },
        { clerkUserId: account.clerkUserId }
      ]
    }).sort({ createdAt: -1 });

    console.log(`\n💳 Transactions (${transactions.length} total):\n`);
    
    let totalCreditsAdded = 0;
    let totalCreditsSpent = 0;
    
    transactions.forEach((tx, index) => {
      const amount = tx.amount;
      if (amount > 0) {
        totalCreditsAdded += amount;
      } else {
        totalCreditsSpent += Math.abs(amount);
      }
      
      console.log(`  ${index + 1}. [${tx.type}] ${tx.status}`);
      console.log(`     Amount: ${amount >= 0 ? '+' : ''}$${amount.toFixed(2)}`);
      console.log(`     Description: ${tx.description}`);
      console.log(`     Created: ${tx.createdAt.toISOString()}`);
      if (tx.modelId) {
        console.log(`     Model: ${tx.modelId}`);
      }
      if (tx.tokens) {
        console.log(`     Tokens: ${tx.tokens}`);
      }
      if (tx.metadata && Object.keys(tx.metadata).length > 0) {
        console.log(`     Metadata:`, JSON.stringify(tx.metadata, null, 2).split('\n').map((line, i) => i === 0 ? line : `       ${line}`).join('\n'));
      }
      console.log('');
    });

    console.log('📊 Summary:');
    console.log('  Total Credits Added:', `+$${totalCreditsAdded.toFixed(2)}`);
    console.log('  Total Credits Spent:', `-$${totalCreditsSpent.toFixed(2)}`);
    console.log('  Calculated Balance:', `$${(totalCreditsAdded - totalCreditsSpent).toFixed(2)}`);
    console.log('  Actual Account Balance:', `$${account.credits.toFixed(2)}`);
    
    const discrepancy = Math.abs((totalCreditsAdded - totalCreditsSpent) - account.credits);
    if (discrepancy > 0.01) {
      console.log(`  ⚠️  DISCREPANCY DETECTED: $${discrepancy.toFixed(2)}`);
    } else {
      console.log('  ✅ Balance matches transaction history');
    }

    // Clear cache for this user
    console.log('\n🧹 Clearing cache for user...');
    cache.delete(CacheKeys.userCredits(account.clerkUserId));
    cache.delete(CacheKeys.userMetadata(account.clerkUserId));
    cache.delete(CacheKeys.userTransactions(account.clerkUserId));
    console.log('✅ Cache cleared\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

// Get email from command line arguments
const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/check-user-credits.ts <email>');
  process.exit(1);
}

checkUserCredits(email);

