/**
 * Admin Script: Manage User Cluster Access
 * 
 * This script allows administrators to manage which clusters users have access to.
 * 
 * Usage:
 *   npx tsx scripts/manage-user-clusters.ts <command> [options]
 * 
 * Commands:
 *   add <userId> <cluster>        - Add cluster access to a user
 *   remove <userId> <cluster>     - Remove cluster access from a user
 *   list <userId>                 - List clusters for a user
 *   set <userId> <clusters...>    - Set clusters for a user (overwrites existing)
 *   bulk-domain <domain> <clusters...> - Set clusters for all users with email domain
 */

import dbConnect from '@/lib/database';
import UserAccount from '@/lib/models/UserAccount';
import { getAvailableClusterIds, isValidCluster } from '@/config/clusters';

// Parse command line arguments
const [command, ...args] = process.argv.slice(2);

async function addClusterAccess(userId: string, cluster: string): Promise<void> {
  if (!isValidCluster(cluster)) {
    throw new Error(`Invalid cluster: ${cluster}. Available: ${getAvailableClusterIds().join(', ')}`);
  }

  await dbConnect();
  
  const user = await UserAccount.findOne({ clerkUserId: userId });
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const currentClusters = user.clusters || ['Tandemn'];
  if (currentClusters.includes(cluster)) {
    console.log(`✓ User ${user.email} already has access to ${cluster}`);
    return;
  }

  await UserAccount.updateOne(
    { clerkUserId: userId },
    { $addToSet: { clusters: cluster } }
  );

  console.log(`✓ Added ${cluster} access to ${user.email}`);
}

async function removeClusterAccess(userId: string, cluster: string): Promise<void> {
  await dbConnect();
  
  const user = await UserAccount.findOne({ clerkUserId: userId });
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const currentClusters = user.clusters || ['Tandemn'];
  if (!currentClusters.includes(cluster)) {
    console.log(`✓ User ${user.email} doesn't have access to ${cluster}`);
    return;
  }

  // Prevent removing the last cluster
  if (currentClusters.length === 1) {
    throw new Error('Cannot remove the last cluster. Users must have at least one cluster.');
  }

  await UserAccount.updateOne(
    { clerkUserId: userId },
    { $pull: { clusters: cluster } }
  );

  console.log(`✓ Removed ${cluster} access from ${user.email}`);
}

async function listUserClusters(userId: string): Promise<void> {
  await dbConnect();
  
  const user = await UserAccount.findOne({ clerkUserId: userId });
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const clusters = user.clusters || ['Tandemn'];
  console.log(`\nClusters for ${user.email}:`);
  clusters.forEach((cluster: string) => {
    console.log(`  - ${cluster}`);
  });
  console.log('');
}

async function setUserClusters(userId: string, clusters: string[]): Promise<void> {
  if (clusters.length === 0) {
    throw new Error('Must specify at least one cluster');
  }

  // Validate all clusters
  for (const cluster of clusters) {
    if (!isValidCluster(cluster)) {
      throw new Error(`Invalid cluster: ${cluster}. Available: ${getAvailableClusterIds().join(', ')}`);
    }
  }

  await dbConnect();
  
  const user = await UserAccount.findOne({ clerkUserId: userId });
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  await UserAccount.updateOne(
    { clerkUserId: userId },
    { $set: { clusters } }
  );

  console.log(`✓ Set clusters for ${user.email}: ${clusters.join(', ')}`);
}

async function bulkSetByEmailDomain(domain: string, clusters: string[]): Promise<void> {
  if (clusters.length === 0) {
    throw new Error('Must specify at least one cluster');
  }

  // Validate all clusters
  for (const cluster of clusters) {
    if (!isValidCluster(cluster)) {
      throw new Error(`Invalid cluster: ${cluster}. Available: ${getAvailableClusterIds().join(', ')}`);
    }
  }

  await dbConnect();
  
  // Find all users with the specified email domain
  const users = await UserAccount.find({
    email: { $regex: `@${domain}$`, $options: 'i' }
  });

  if (users.length === 0) {
    console.log(`No users found with email domain: ${domain}`);
    return;
  }

  console.log(`Found ${users.length} user(s) with domain @${domain}`);
  
  // Update all users
  const result = await UserAccount.updateMany(
    { email: { $regex: `@${domain}$`, $options: 'i' } },
    { $set: { clusters } }
  );

  console.log(`✓ Updated ${result.modifiedCount} user(s) with clusters: ${clusters.join(', ')}`);
  
  // List updated users
  console.log('\nUpdated users:');
  users.forEach(user => {
    console.log(`  - ${user.email}`);
  });
}

async function main() {
  try {
    if (!command) {
      console.log(`
Usage: npx tsx scripts/manage-user-clusters.ts <command> [options]

Commands:
  add <userId> <cluster>              Add cluster access to a user
  remove <userId> <cluster>           Remove cluster access from a user
  list <userId>                       List clusters for a user
  set <userId> <clusters...>          Set clusters for a user (overwrites)
  bulk-domain <domain> <clusters...>  Set clusters for all users with email domain

Examples:
  npx tsx scripts/manage-user-clusters.ts add user_abc123 HAL
  npx tsx scripts/manage-user-clusters.ts remove user_abc123 DELTA
  npx tsx scripts/manage-user-clusters.ts list user_abc123
  npx tsx scripts/manage-user-clusters.ts set user_abc123 Tandemn HAL DELTA
  npx tsx scripts/manage-user-clusters.ts bulk-domain illinois.edu Tandemn HAL DELTA

Available clusters: ${getAvailableClusterIds().join(', ')}
      `);
      process.exit(0);
    }

    switch (command.toLowerCase()) {
      case 'add':
        if (args.length < 2) {
          throw new Error('Usage: add <userId> <cluster>');
        }
        await addClusterAccess(args[0], args[1]);
        break;

      case 'remove':
        if (args.length < 2) {
          throw new Error('Usage: remove <userId> <cluster>');
        }
        await removeClusterAccess(args[0], args[1]);
        break;

      case 'list':
        if (args.length < 1) {
          throw new Error('Usage: list <userId>');
        }
        await listUserClusters(args[0]);
        break;

      case 'set':
        if (args.length < 2) {
          throw new Error('Usage: set <userId> <clusters...>');
        }
        await setUserClusters(args[0], args.slice(1));
        break;

      case 'bulk-domain':
        if (args.length < 2) {
          throw new Error('Usage: bulk-domain <domain> <clusters...>');
        }
        await bulkSetByEmailDomain(args[0], args.slice(1));
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

