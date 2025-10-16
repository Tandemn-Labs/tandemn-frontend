#!/usr/bin/env node

/**
 * Migration script to move user account data from Clerk metadata to MongoDB
 * 
 * Usage:
 *   node scripts/migrate-to-mongodb.js [options]
 * 
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --verify     Verify migration integrity
 *   --cleanup    Clean up Clerk metadata after migration
 *   --user-id    Migrate specific user by Clerk ID
 */

const { migrateAllUsers, migrateUserFromClerk, verifyMigration, cleanupClerkMetadata } = require('../src/lib/migration-utils');

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const shouldVerify = args.includes('--verify');
  const shouldCleanup = args.includes('--cleanup');
  const userIdIndex = args.indexOf('--user-id');
  const specificUserId = userIdIndex !== -1 ? args[userIdIndex + 1] : null;

  console.log('🚀 Starting Clerk to MongoDB migration...\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  try {
    if (specificUserId) {
      // Migrate specific user
      console.log(`👤 Migrating specific user: ${specificUserId}`);
      
      if (!isDryRun) {
        const result = await migrateUserFromClerk(specificUserId);
        console.log(result.success ? '✅' : '❌', result.message);
        
        if (result.success && shouldCleanup) {
          const cleanupResult = await cleanupClerkMetadata(specificUserId);
          console.log(cleanupResult.success ? '✅' : '❌', cleanupResult.message);
        }
      } else {
        console.log('🔍 Would migrate user:', specificUserId);
      }
    } else {
      // Migrate all users
      console.log('👥 Migrating all users...');
      
      if (!isDryRun) {
        const result = await migrateAllUsers();
        
        console.log('\n📊 Migration Results:');
        console.log(`✅ Successfully migrated: ${result.migrated} users`);
        console.log(`❌ Failed to migrate: ${result.failed} users`);
        
        if (result.errors.length > 0) {
          console.log('\n❌ Errors:');
          result.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        if (shouldCleanup && result.migrated > 0) {
          console.log('\n🧹 Cleaning up Clerk metadata...');
          // Note: In a real implementation, you'd want to clean up metadata
          // for successfully migrated users. This is a placeholder.
          console.log('⚠️  Cleanup not implemented in this script - do manually if needed');
        }
      } else {
        console.log('🔍 Would migrate all users (dry run)');
      }
    }

    if (shouldVerify) {
      console.log('\n🔍 Verifying migration integrity...');
      const verification = await verifyMigration();
      
      console.log('\n📊 Verification Results:');
      console.log(`👥 Clerk users: ${verification.clerkUsers}`);
      console.log(`🗄️  MongoDB users: ${verification.mongoUsers}`);
      
      if (verification.discrepancies.length > 0) {
        console.log('\n⚠️  Discrepancies found:');
        verification.discrepancies.forEach(discrepancy => 
          console.log(`  - ${discrepancy}`)
        );
      } else {
        console.log('✅ No discrepancies found - migration looks good!');
      }
    }

    console.log('\n🎉 Migration process completed!');
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the migration
main();
