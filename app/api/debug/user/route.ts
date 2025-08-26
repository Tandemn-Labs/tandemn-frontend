import { NextRequest, NextResponse } from 'next/server';
import { auth, createClerkClient } from '@clerk/nextjs/server';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await clerkClient.users.getUser(userId);
    
    return NextResponse.json({
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      privateMetadata: user.privateMetadata,
      publicMetadata: user.publicMetadata,
    });
  } catch (error) {
    console.error('Error in debug route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}