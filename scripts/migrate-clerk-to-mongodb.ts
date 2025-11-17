#!/usr/bin/env node

/**
 * Clerk to MongoDB Migration Script
 * 
 * This script migrates user data from Clerk's metadata system to MongoDB collections.
 * It handles:
 * - User account data (email, credits, admin roles)
 * - Transaction history
 * - Idempotent operation (skips already migrated users)
 * 
 * Usage:
 *   npm run migrate:clerk           # Run migration
 *   npm run migrate:clerk --dry-run # Preview without making changes
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local first, then .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { createClerkClient } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import dbConnect from '../src/lib/database';
import UserAccount from '../src/lib/models/UserAccount';
import UserTransaction from '../src/lib/models/UserTransaction';

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');

// Initialize Clerk client
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

interface MigrationStats {
  totalUsers: number;
  alreadyMigrated: number;
  newlyMigrated: number;
  failed: number;
  transactionsMigrated: number;
  errors: Array<{ userId: string; email: string; error: string }>;
}

interface ClerkMetadata {
  publicMetadata?: {
    role?: string;
    isAdmin?: boolean;
    [key: string]: any;
  };
  privateMetadata?: {
    credits?: number;
    transactions?: Array<{
      id?: string;
      type: string;
      amount: number;
      description: string;
      modelId?: string;
      tokens?: number;
      metadata?: any;
      createdAt: string;
    }>;
    [key: string]: any;
  };
}

async function fetchAllClerkUsers() {
  console.log('📥 Fetching users from Clerk API...');
  const allUsers = [];
  let hasMore = true;
  let offset = 0;
  const limit = 100;

  while (hasMore) {
    const response = await clerkClient.users.getUserList({
      limit,
      offset,
    });

    allUsers.push(...response.data);
    offset += limit;
    hasMore = response.data.length === limit;

    process.stdout.write(`\r  Fetched ${allUsers.length} users...`);
  }

  console.log(`\n✅ Fetched ${allUsers.length} total users from Clerk\n`);
  return allUsers;
}

async function migrateUser(clerkUser: any, stats: MigrationStats): Promise<boolean> {
  const userId = clerkUser.id;
  const email = clerkUser.emailAddresses[0]?.emailAddress || 'no-email@unknown.com';
  const metadata = clerkUser as ClerkMetadata;

  try {
    // Check if user already exists in MongoDB
    const existingAccount = await UserAccount.findOne({ clerkUserId: userId });
    
    if (existingAccount) {
      console.log(`  ⏭️  ${email} - Already migrated`);
      stats.alreadyMigrated++;
      return true;
    }

    // Extract data from Clerk metadata
    const credits = (metadata.privateMetadata?.credits as number) || 20.00;
    const transactions = (metadata.privateMetadata?.transactions as any[]) || [];
    const isAdmin = metadata.publicMetadata?.role === 'admin' || metadata.publicMetadata?.isAdmin === true;

    if (isDryRun) {
      console.log(`  🔍 [DRY RUN] Would migrate ${email}`);
      console.log(`     - Credits: $${credits.toFixed(2)}`);
      console.log(`     - Transactions: ${transactions.length}`);
      console.log(`     - Admin: ${isAdmin}`);
      stats.newlyMigrated++;
      stats.transactionsMigrated += transactions.length;
      return true;
    }

    // Create UserAccount document
    const userAccount = new UserAccount({
      clerkUserId: userId,
      email: email,
      credits: credits,
      preferences: {
        theme: 'light',
        language: 'en',
      },
    });

    // Add admin role if applicable
    if (isAdmin) {
      (userAccount as any).isAdmin = true;
      (userAccount as any).role = 'admin';
    }

    await userAccount.save();

    // Migrate transactions
    let transactionCount = 0;
    for (const txn of transactions) {
      try {
        const transaction = new UserTransaction({
          userId: userAccount._id.toString(),
          clerkUserId: userId,
          type: txn.type || 'usage_charge',
          amount: txn.amount || 0,
          description: txn.description || 'Migrated transaction',
          status: 'completed',
          modelId: txn.modelId,
          tokens: txn.tokens,
          metadata: txn.metadata || {},
          createdAt: txn.createdAt ? new Date(txn.createdAt) : new Date(),
        });

        await transaction.save();
        transactionCount++;
      } catch (txnError: any) {
        console.log(`     ⚠️  Failed to migrate transaction: ${txnError.message}`);
      }
    }

    console.log(`  ✅ ${email} - Migrated (${transactionCount} transactions)${isAdmin ? ' [ADMIN]' : ''}`);
    stats.newlyMigrated++;
    stats.transactionsMigrated += transactionCount;
    return true;

  } catch (error: any) {
    console.log(`  ❌ ${email} - Failed: ${error.message}`);
    stats.failed++;
    stats.errors.push({
      userId,
      email,
      error: error.message,
    });
    return false;
  }
}

async function runMigration() {
  const stats: MigrationStats = {
    totalUsers: 0,
    alreadyMigrated: 0,
    newlyMigrated: 0,
    failed: 0,
    transactionsMigrated: 0,
    errors: [],
  };

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         Clerk to MongoDB Migration Script                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Validate environment variables
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('❌ Error: CLERK_SECRET_KEY environment variable is not set');
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  try {
    // Connect to MongoDB
    console.log('📊 Connecting to MongoDB...');
    await dbConnect();
    console.log('✅ MongoDB connected\n');

    // Fetch all users from Clerk
    const clerkUsers = await fetchAllClerkUsers();
    stats.totalUsers = clerkUsers.length;

    if (stats.totalUsers === 0) {
      console.log('⚠️  No users found in Clerk');
      return;
    }

    // Migrate each user
    console.log('🔄 Starting migration...\n');
    for (let i = 0; i < clerkUsers.length; i++) {
      const user = clerkUsers[i];
      console.log(`[${i + 1}/${clerkUsers.length}]`);
      await migrateUser(user, stats);
    }

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Migration Summary                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`  Total users processed:      ${stats.totalUsers}`);
    console.log(`  Already migrated (skipped): ${stats.alreadyMigrated}`);
    console.log(`  Newly migrated:             ${stats.newlyMigrated}`);
    console.log(`  Failed:                     ${stats.failed}`);
    console.log(`  Transactions migrated:      ${stats.transactionsMigrated}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.email} (${err.userId})`);
        console.log(`     Error: ${err.error}`);
      });
    }

    if (isDryRun) {
      console.log('\n🔍 DRY RUN completed - No changes were made');
      console.log('   Run without --dry-run to perform actual migration');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n📊 MongoDB connection closed');
    }
  }
}

// Run migration
runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

