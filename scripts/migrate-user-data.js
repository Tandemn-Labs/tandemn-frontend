#!/usr/bin/env node

/**
 * Complete migration script to move user account data from Clerk metadata to MongoDB
 * 
 * This script will:
 * 1. Connect to MongoDB
 * 2. Get all users from Clerk
 * 3. Migrate their data to MongoDB
 * 4. Verify the migration
 * 5. Optionally clean up Clerk metadata
 * 
 * Usage:
 *   node scripts/migrate-user-data.js [options]
 * 
 * Options:
 *   --dry-run       Show what would be migrated without making changes
 *   --verify-only   Only verify existing migration
 *   --cleanup       Clean up Clerk metadata after successful migration
 *   --user-id ID    Migrate specific user by Clerk ID
 *   --batch-size N  Process users in batches of N (default: 10)
 */

const { createClerkClient } = require('@clerk/nextjs/server');
const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://choprahetarth:helloworld@demo-day.tjaxr2t.mongodb.net/iroh_tandemn?retryWrites=true&w=majority&appName=demo-day';

// MongoDB schemas (simplified for migration script)
const UserAccountSchema = new mongoose.Schema({
  clerkUserId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, index: true },
  credits: { type: Number, required: true, default: 20.00 },
  lastCreditUpdate: Date,
  preferences: {
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    notifications: { type: Boolean, default: true },
    language: { type: String, default: 'en' },
  },
}, { timestamps: true });

const UserTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  clerkUserId: { type: String, required: true, index: true },
  type: { type: String, enum: ['usage_charge', 'credit_purchase', 'bonus_credit', 'refund'], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  modelId: String,
  tokens: Number,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const UserAPIKeySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  clerkUserId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  keyHash: { type: String, required: true, unique: true },
  keyPrefix: { type: String, required: true },
  isActive: { type: Boolean, required: true, default: true },
  lastUsed: Date,
  usageCount: { type: Number, default: 0 },
}, { timestamps: true });

const UserAccount = mongoose.model('UserAccount', UserAccountSchema);
const UserTransaction = mongoose.model('UserTransaction', UserTransactionSchema);
const UserAPIKey = mongoose.model('UserAPIKey', UserAPIKeySchema);

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

async function migrateUser(clerkUser, isDryRun = false) {
  const clerkUserId = clerkUser.id;
  const email = clerkUser.emailAddresses[0]?.emailAddress || '';
  
  if (!email) {
    return { success: false, message: 'User has no email address' };
  }

  try {
    // Check if user already exists
    const existingAccount = await UserAccount.findOne({ clerkUserId });
    if (existingAccount) {
      return { success: true, message: 'User already migrated', skipped: true };
    }

    if (isDryRun) {
      return { success: true, message: `Would migrate user: ${email}` };
    }

    // Create user account
    const account = new UserAccount({
      clerkUserId,
      email,
      credits: clerkUser.privateMetadata?.credits || 20.00,
      lastCreditUpdate: clerkUser.privateMetadata?.lastCreditUpdate ? 
        new Date(clerkUser.privateMetadata.lastCreditUpdate) : undefined,
    });

    await account.save();

    // Migrate transactions
    const transactions = clerkUser.privateMetadata?.transactions || [];
    let transactionCount = 0;
    
    if (transactions.length > 0) {
      const transactionDocs = transactions.map(tx => ({
        userId: account._id.toString(),
        clerkUserId,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        modelId: tx.modelId,
        tokens: tx.tokens,
        metadata: tx.metadata,
        createdAt: new Date(tx.createdAt),
      }));

      await UserTransaction.insertMany(transactionDocs);
      transactionCount = transactionDocs.length;
    }

    // Migrate API keys
    const apiKeys = clerkUser.privateMetadata?.apiKeys || [];
    let apiKeyCount = 0;
    
    if (apiKeys.length > 0) {
      const apiKeyDocs = apiKeys.map(key => ({
        userId: account._id.toString(),
        clerkUserId,
        name: key.name,
        keyHash: `migrated_${key.id}`, // Placeholder hash for migrated keys
        keyPrefix: key.key?.substring(0, 8) || 'migrated',
        isActive: key.isActive,
        lastUsed: key.lastUsed ? new Date(key.lastUsed) : undefined,
        usageCount: 0,
        createdAt: new Date(key.createdAt),
      }));

      await UserAPIKey.insertMany(apiKeyDocs);
      apiKeyCount = apiKeyDocs.length;
    }

    return { 
      success: true, 
      message: `Migrated user with ${transactionCount} transactions and ${apiKeyCount} API keys`,
      transactionCount,
      apiKeyCount
    };
  } catch (error) {
    return { success: false, message: `Migration failed: ${error.message}` };
  }
}

async function migrateAllUsers(isDryRun = false, batchSize = 10) {
  let migrated = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];

  try {
    let hasMore = true;
    let offset = 0;
    const limit = batchSize;

    while (hasMore) {
      console.log(`\n📦 Processing batch starting at offset ${offset}...`);
      
      const usersResponse = await clerkClient.users.getUserList({ 
        limit, 
        offset 
      });

      const users = usersResponse.data;
      hasMore = users.length === limit;
      offset += limit;

      for (const user of users) {
        try {
          const result = await migrateUser(user, isDryRun);
          
          if (result.success) {
            if (result.skipped) {
              skipped++;
              console.log(`⏭️  Skipped: ${user.emailAddresses[0]?.emailAddress} (already migrated)`);
            } else {
              migrated++;
              console.log(`✅ Migrated: ${user.emailAddresses[0]?.emailAddress} - ${result.message}`);
            }
          } else {
            failed++;
            const errorMsg = `${user.emailAddresses[0]?.emailAddress}: ${result.message}`;
            errors.push(errorMsg);
            console.log(`❌ Failed: ${errorMsg}`);
          }
        } catch (error) {
          failed++;
          const errorMsg = `User ${user.emailAddresses[0]?.emailAddress}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`❌ Error migrating user:`, error);
        }
      }

      // Small delay between batches to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { migrated, failed, skipped, errors };
  } catch (error) {
    console.error('Error in bulk migration:', error);
    return { migrated, failed, skipped, errors: [...errors, error.message] };
  }
}

async function verifyMigration() {
  try {
    // Count Clerk users
    const clerkUsersResponse = await clerkClient.users.getUserList({ limit: 500 });
    const clerkUsers = clerkUsersResponse.data.length;

    // Count MongoDB users
    const mongoUsers = await UserAccount.countDocuments();
    const mongoTransactions = await UserTransaction.countDocuments();
    const mongoAPIKeys = await UserAPIKey.countDocuments();

    const discrepancies = [];

    // Check for users in Clerk but not in MongoDB
    for (const clerkUser of clerkUsersResponse.data) {
      const mongoUser = await UserAccount.findOne({ 
        clerkUserId: clerkUser.id 
      });
      
      if (!mongoUser) {
        discrepancies.push(`User ${clerkUser.emailAddresses[0]?.emailAddress} exists in Clerk but not in MongoDB`);
      }
    }

    return {
      success: true,
      clerkUsers,
      mongoUsers,
      mongoTransactions,
      mongoAPIKeys,
      discrepancies,
    };
  } catch (error) {
    console.error('Error verifying migration:', error);
    return {
      success: false,
      clerkUsers: 0,
      mongoUsers: 0,
      mongoTransactions: 0,
      mongoAPIKeys: 0,
      discrepancies: [error.message],
    };
  }
}

async function cleanupClerkMetadata(clerkUserId) {
  try {
    await clerkClient.users.updateUser(clerkUserId, {
      privateMetadata: {
        migrated: true,
        migratedAt: new Date().toISOString(),
      },
    });
    return { success: true, message: 'Clerk metadata cleaned up' };
  } catch (error) {
    return { success: false, message: `Cleanup failed: ${error.message}` };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const verifyOnly = args.includes('--verify-only');
  const shouldCleanup = args.includes('--cleanup');
  const userIdIndex = args.indexOf('--user-id');
  const specificUserId = userIdIndex !== -1 ? args[userIdIndex + 1] : null;
  const batchSizeIndex = args.indexOf('--batch-size');
  const batchSize = batchSizeIndex !== -1 ? parseInt(args[batchSizeIndex + 1]) : 10;

  console.log('🚀 Starting Clerk to MongoDB migration...\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  try {
    await connectToDatabase();

    if (verifyOnly) {
      console.log('🔍 Verifying migration integrity...');
      const verification = await verifyMigration();
      
      console.log('\n📊 Verification Results:');
      console.log(`👥 Clerk users: ${verification.clerkUsers}`);
      console.log(`🗄️  MongoDB users: ${verification.mongoUsers}`);
      console.log(`📝 MongoDB transactions: ${verification.mongoTransactions}`);
      console.log(`🔑 MongoDB API keys: ${verification.mongoAPIKeys}`);
      
      if (verification.discrepancies.length > 0) {
        console.log('\n⚠️  Discrepancies found:');
        verification.discrepancies.forEach(discrepancy => 
          console.log(`  - ${discrepancy}`)
        );
      } else {
        console.log('✅ No discrepancies found - migration looks good!');
      }
      
      return;
    }

    if (specificUserId) {
      // Migrate specific user
      console.log(`👤 Migrating specific user: ${specificUserId}`);
      
      const clerkUser = await clerkClient.users.getUser(specificUserId);
      const result = await migrateUser(clerkUser, isDryRun);
      
      console.log(result.success ? '✅' : '❌', result.message);
      
      if (result.success && shouldCleanup && !isDryRun) {
        const cleanupResult = await cleanupClerkMetadata(specificUserId);
        console.log(cleanupResult.success ? '✅' : '❌', cleanupResult.message);
      }
    } else {
      // Migrate all users
      console.log('👥 Migrating all users...');
      
      const result = await migrateAllUsers(isDryRun, batchSize);
      
      console.log('\n📊 Migration Results:');
      console.log(`✅ Successfully migrated: ${result.migrated} users`);
      console.log(`⏭️  Skipped (already migrated): ${result.skipped} users`);
      console.log(`❌ Failed to migrate: ${result.failed} users`);
      
      if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
        if (result.errors.length > 10) {
          console.log(`  ... and ${result.errors.length - 10} more errors`);
        }
      }
    }

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const verification = await verifyMigration();
    
    console.log('\n📊 Final Verification:');
    console.log(`👥 Clerk users: ${verification.clerkUsers}`);
    console.log(`🗄️  MongoDB users: ${verification.mongoUsers}`);
    console.log(`📝 MongoDB transactions: ${verification.mongoTransactions}`);
    console.log(`🔑 MongoDB API keys: ${verification.mongoAPIKeys}`);
    
    if (verification.discrepancies.length > 0) {
      console.log('\n⚠️  Discrepancies found:');
      verification.discrepancies.forEach(discrepancy => 
        console.log(`  - ${discrepancy}`)
      );
    } else {
      console.log('✅ No discrepancies found - migration successful!');
    }

    console.log('\n🎉 Migration process completed!');
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the migration
main();
