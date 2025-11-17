import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cache, CacheKeys } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Clear all cache for the current user
    cache.delete(CacheKeys.userCredits(userId));
    cache.delete(CacheKeys.userMetadata(userId));
    cache.delete(CacheKeys.userTransactions(userId));
    cache.delete(CacheKeys.userApiKeys(userId));
    cache.delete(CacheKeys.userRooms(userId));

    console.log(`✅ Cache cleared for user: ${userId}`);

    return NextResponse.json({ 
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

