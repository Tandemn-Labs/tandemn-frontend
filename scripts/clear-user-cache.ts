/**
 * Clear cache for a specific user
 * Usage: npx tsx scripts/clear-user-cache.ts <email>
 */

import dbConnect from '../src/lib/database';
import UserAccount from '../src/lib/models/UserAccount';
import { cache, CacheKeys } from '../src/lib/cache';

async function clearUserCache(email: string) {
  try {
    console.log(`\n🧹 Clearing cache for: ${email}\n`);
    
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

    console.log('👤 User Details:');
    console.log('  Email:', account.email);
    console.log('  Clerk User ID:', account.clerkUserId);
    console.log('  Current Credits:', account.credits);

    // Clear all cache entries for this user
    console.log('\n🗑️  Clearing cache entries...');
    cache.delete(CacheKeys.userCredits(account.clerkUserId));
    cache.delete(CacheKeys.userMetadata(account.clerkUserId));
    cache.delete(CacheKeys.userTransactions(account.clerkUserId));
    cache.delete(CacheKeys.userApiKeys(account.clerkUserId));
    cache.delete(CacheKeys.userRooms(account.clerkUserId));
    
    console.log('✅ Cache cleared for all user data');
    
    // Also clear the entire cache to be safe
    console.log('\n🧹 Clearing entire cache...');
    cache.clear();
    console.log('✅ Entire cache cleared\n');
    
    console.log('💡 User should now see updated data on next page load\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

// Get email from command line arguments
const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/clear-user-cache.ts <email>');
  process.exit(1);
}

clearUserCache(email);

