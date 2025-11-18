import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/database';
import UserAccount from '@/lib/models/UserAccount';
import { isAdmin } from '@/lib/admin';
import { getUserClusters } from '@/config/clusters';

/**
 * GET /api/admin/user-clusters/[userId]
 * 
 * Get cluster access for a specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: adminUserId } = await auth();
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (!isAdmin(adminUserId)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userId } = params;

    await dbConnect();

    const user = await UserAccount.findOne({ clerkUserId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userClusterIds = user.clusters || ['Tandemn'];
    const clusterDetails = getUserClusters(userClusterIds);

    return NextResponse.json({
      userId: user.clerkUserId,
      email: user.email,
      clusters: userClusterIds,
      clusterDetails: clusterDetails.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
    });

  } catch (error) {
    console.error('Error getting user clusters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

