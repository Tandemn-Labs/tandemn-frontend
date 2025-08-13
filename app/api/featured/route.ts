import { NextResponse } from 'next/server';
import { db } from '@/mock/db';
import { sleep } from '@/lib/utils';

export async function GET() {
  try {
    await sleep(150);
    
    const featured = db.getFeatured();
    return NextResponse.json(featured);
  } catch (error) {
    console.error('Error in /api/featured:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
