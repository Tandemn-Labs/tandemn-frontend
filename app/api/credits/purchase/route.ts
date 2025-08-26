import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { purchaseCredits, CREDIT_PACKAGES } from '@/lib/credits';
import { sleep } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    await sleep(200);
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { packageId } = await request.json();
    
    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID is required' },
        { status: 400 }
      );
    }
    
    const creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
    if (!creditPackage) {
      return NextResponse.json(
        { error: 'Invalid package ID' },
        { status: 400 }
      );
    }
    
    // Process credit purchase through Clerk metadata
    const result = await purchaseCredits(packageId, userId);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        package: creditPackage,
      });
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in /api/credits/purchase:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
