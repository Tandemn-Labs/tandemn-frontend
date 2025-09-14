import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { withAdmin } from '@/lib/admin';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const { userId, keyId } = await request.json();

    if (!userId || !keyId) {
      return NextResponse.json(
        { error: 'userId and keyId are required' },
        { status: 400 }
      );
    }

    // Get user data
    const user = await clerkClient.users.getUser(userId);
    const apiKeys = (user.privateMetadata?.apiKeys as any[]) || [];

    // Find and deactivate the key
    const updatedKeys = apiKeys.map(key => 
      key.id === keyId 
        ? { ...key, isActive: false, deactivatedAt: new Date().toISOString() }
        : key
    );

    // Update user metadata
    await clerkClient.users.updateUser(userId, {
      privateMetadata: {
        ...user.privateMetadata,
        apiKeys: updatedKeys,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'API key deactivated successfully',
    });
  } catch (error) {
    console.error('Error deactivating API key:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate API key' },
      { status: 500 }
    );
  }
});