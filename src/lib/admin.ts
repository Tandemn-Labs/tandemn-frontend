import { auth, createClerkClient } from '@clerk/nextjs/server';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Admin role checking utilities
export async function isAdmin(userId?: string): Promise<boolean> {
  try {
    const userIdToCheck = userId || (await auth()).userId;
    if (!userIdToCheck) return false;

    const user = await clerkClient.users.getUser(userIdToCheck);
    
    // Check if user has admin role in public metadata
    const isAdminRole = user.publicMetadata?.role === 'admin' || user.publicMetadata?.isAdmin === true;
    
    // Also check if it's the specific admin email
    const isAdminEmail = user.emailAddresses.some(
      (email: any) => email.emailAddress === 'projectsnightlight@gmail.com'
    );
    
    return isAdminRole || isAdminEmail;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Get current user with admin status
export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const user = await clerkClient.users.getUser(userId);
    const adminStatus = await isAdmin(userId);
    
    return {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      isAdmin: adminStatus,
      metadata: user.publicMetadata
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Admin-only API route wrapper
export function withAdmin<T extends any[]>(
  handler: (...args: T) => Promise<Response> | Response
) {
  return async (...args: T): Promise<Response> => {
    const adminStatus = await isAdmin();
    
    if (!adminStatus) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }), 
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return handler(...args);
  };
}

// Set admin role for a user (can only be done by existing admin)
export async function setAdminRole(userIdOrEmail: string, isAdminRole: boolean = true) {
  const currentAdminStatus = await isAdmin();
  if (!currentAdminStatus) {
    throw new Error('Only admins can set admin roles');
  }

  try {
    // Try to find user by ID first, then by email
    let user;
    if (userIdOrEmail.includes('@')) {
      const users = await clerkClient.users.getUserList({
        emailAddress: [userIdOrEmail]
      });
      user = users.data[0];
    } else {
      user = await clerkClient.users.getUser(userIdOrEmail);
    }

    if (!user) {
      throw new Error('User not found');
    }

    await clerkClient.users.updateUser(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        role: isAdminRole ? 'admin' : 'user',
        isAdmin: isAdminRole
      }
    });

    return { success: true, userId: user.id };
  } catch (error) {
    console.error('Error setting admin role:', error);
    throw error;
  }
}