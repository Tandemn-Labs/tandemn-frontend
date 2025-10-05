import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { withAdmin } from '@/lib/admin';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

interface ApiKeyInfo {
  id: string;
  name: string;
  key: string;
  lastUsed?: string;
  createdAt: string;
  isActive: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  userCredits: number;
}

interface ApiKeyStats {
  totalKeys: number;
  activeKeys: number;
  inactiveKeys: number;
  keysUsedToday: number;
  keysUsedThisWeek: number;
  totalUsers: number;
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const usersResponse = await clerkClient.users.getUserList({ limit: 500 });
    const users = usersResponse.data;

    const allApiKeys: ApiKeyInfo[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let keysUsedToday = 0;
    let keysUsedThisWeek = 0;
    const usersWithKeys = new Set<string>();

    for (const user of users) {
      const apiKeys = (user.privateMetadata?.apiKeys as any[]) || [];
      const credits = (user.privateMetadata?.credits as number) || 0;
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No name';
      const userEmail = user.emailAddresses[0]?.emailAddress || 'No email';

      if (apiKeys.length > 0) {
        usersWithKeys.add(user.id);
      }

      for (const apiKey of apiKeys) {
        const keyInfo: ApiKeyInfo = {
          id: apiKey.id,
          name: apiKey.name,
          key: apiKey.key,
          lastUsed: apiKey.lastUsed,
          createdAt: apiKey.createdAt,
          isActive: apiKey.isActive,
          userId: user.id,
          userName,
          userEmail,
          userCredits: credits,
        };

        allApiKeys.push(keyInfo);

        // Check if key was used today or this week
        if (apiKey.lastUsed) {
          const lastUsedDate = new Date(apiKey.lastUsed);
          if (lastUsedDate >= todayStart) {
            keysUsedToday++;
          }
          if (lastUsedDate >= weekStart) {
            keysUsedThisWeek++;
          }
        }
      }
    }

    const stats: ApiKeyStats = {
      totalKeys: allApiKeys.length,
      activeKeys: allApiKeys.filter(key => key.isActive).length,
      inactiveKeys: allApiKeys.filter(key => !key.isActive).length,
      keysUsedToday,
      keysUsedThisWeek,
      totalUsers: usersWithKeys.size,
    };

    // Sort by creation date (newest first)
    allApiKeys.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      apiKeys: allApiKeys,
      stats,
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
});