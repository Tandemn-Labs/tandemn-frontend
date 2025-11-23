import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/database';
import UserAccount from '@/lib/models/UserAccount';
import { isValidCluster, getAvailableClusterIds } from '@/config/clusters';
import { isAdmin } from '@/lib/admin';

/**
 * POST /api/admin/user-clusters
 * 
 * Add or set clusters for a user
 * 
 * Request body:
 * {
 *   "userId": "clerk_user_id",
 *   "cluster": "HAL",         // For single cluster addition
 *   "clusters": ["HAL", "DELTA"], // For setting multiple clusters (overwrites)
 *   "action": "add" | "set"   // default: "add"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: adminUserId } = await auth();
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (!isAdmin(adminUserId)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, cluster, clusters, action = 'add' } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    await dbConnect();

    const user = await UserAccount.findOne({ clerkUserId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (action === 'add') {
      // Add single cluster
      if (!cluster) {
        return NextResponse.json({ error: 'cluster is required for add action' }, { status: 400 });
      }

      if (!isValidCluster(cluster)) {
        return NextResponse.json(
          { error: `Invalid cluster: ${cluster}. Available: ${getAvailableClusterIds().join(', ')}` },
          { status: 400 }
        );
      }

      const currentClusters = user.clusters || ['Tandemn'];
      if (currentClusters.includes(cluster)) {
        return NextResponse.json({
          message: `User already has access to ${cluster}`,
          clusters: currentClusters,
        });
      }

      await UserAccount.updateOne(
        { clerkUserId: userId },
        { $addToSet: { clusters: cluster } }
      );

      const updatedClusters = [...currentClusters, cluster];

      return NextResponse.json({
        message: `Added ${cluster} access to user`,
        clusters: updatedClusters,
      });

    } else if (action === 'set') {
      // Set multiple clusters (overwrite)
      if (!clusters || !Array.isArray(clusters)) {
        return NextResponse.json({ error: 'clusters array is required for set action' }, { status: 400 });
      }

      if (clusters.length === 0) {
        return NextResponse.json({ error: 'Must specify at least one cluster' }, { status: 400 });
      }

      // Validate all clusters
      for (const c of clusters) {
        if (!isValidCluster(c)) {
          return NextResponse.json(
            { error: `Invalid cluster: ${c}. Available: ${getAvailableClusterIds().join(', ')}` },
            { status: 400 }
          );
        }
      }

      await UserAccount.updateOne(
        { clerkUserId: userId },
        { $set: { clusters } }
      );

      return NextResponse.json({
        message: `Set clusters for user`,
        clusters,
      });

    } else {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

  } catch (error) {
    console.error('Error managing user clusters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/user-clusters
 * 
 * Remove a cluster from a user
 * 
 * Request body:
 * {
 *   "userId": "clerk_user_id",
 *   "cluster": "HAL"
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId: adminUserId } = await auth();
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (!isAdmin(adminUserId)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, cluster } = body;

    if (!userId || !cluster) {
      return NextResponse.json({ error: 'userId and cluster are required' }, { status: 400 });
    }

    await dbConnect();

    const user = await UserAccount.findOne({ clerkUserId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentClusters = user.clusters || ['Tandemn'];
    if (!currentClusters.includes(cluster)) {
      return NextResponse.json({
        message: `User doesn't have access to ${cluster}`,
        clusters: currentClusters,
      });
    }

    // Prevent removing the last cluster
    if (currentClusters.length === 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last cluster. Users must have at least one cluster.' },
        { status: 400 }
      );
    }

    await UserAccount.updateOne(
      { clerkUserId: userId },
      { $pull: { clusters: cluster } }
    );

    const updatedClusters = currentClusters.filter((c: string) => c !== cluster);

    return NextResponse.json({
      message: `Removed ${cluster} access from user`,
      clusters: updatedClusters,
    });

  } catch (error) {
    console.error('Error removing user cluster:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

