import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Check if this is the first time setup (no admin users exist)
    const existingUsers = await clerkClient.users.getUserList({
      emailAddress: ['projectsnightlight@gmail.com']
    });

    if (existingUsers.data.length > 0) {
      const existingUser = existingUsers.data[0];
      
      // Update existing user to be admin
      await clerkClient.users.updateUser(existingUser.id, {
        publicMetadata: {
          ...existingUser.publicMetadata,
          role: 'admin',
          isAdmin: true,
          setupDate: new Date().toISOString()
        }
      });

      return NextResponse.json({
        message: 'Admin user already exists - updated with admin privileges',
        userId: existingUser.id,
        email: existingUser.emailAddresses[0]?.emailAddress
      });
    }

    // Create new admin user
    const adminUser = await clerkClient.users.createUser({
      emailAddress: ['projectsnightlight@gmail.com'],
      firstName: 'Admin',
      lastName: 'User',
      publicMetadata: {
        role: 'admin',
        isAdmin: true,
        setupDate: new Date().toISOString()
      },
      privateMetadata: {
        adminLevel: 'super',
        createdBy: 'api-setup'
      }
    });

    return NextResponse.json({
      message: 'Admin user created successfully',
      userId: adminUser.id,
      email: adminUser.emailAddresses[0]?.emailAddress,
      instructions: [
        'Admin user has been created',
        'They can now sign in using projectsnightlight@gmail.com',
        'First-time sign in will require email verification',
        'Admin privileges are automatically assigned'
      ]
    });

  } catch (error: any) {
    console.error('Admin setup error:', error);

    if (error.errors?.some((err: any) => err.code === 'form_identifier_exists')) {
      return NextResponse.json(
        { 
          error: 'User already exists',
          message: 'An account with this email already exists. Use the dashboard to assign admin role.'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to create admin user',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Get admin setup status
export async function GET() {
  try {
    const adminUsers = await clerkClient.users.getUserList({
      emailAddress: ['projectsnightlight@gmail.com']
    });

    const hasAdmin = adminUsers.data.length > 0;
    const adminUser = adminUsers.data[0];

    return NextResponse.json({
      hasAdmin,
      adminUser: hasAdmin ? {
        id: adminUser.id,
        email: adminUser.emailAddresses[0]?.emailAddress,
        isAdmin: adminUser.publicMetadata?.isAdmin === true,
        role: adminUser.publicMetadata?.role,
        createdAt: adminUser.createdAt
      } : null
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check admin status' },
      { status: 500 }
    );
  }
}