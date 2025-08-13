import { NextResponse } from 'next/server';
import { db } from '@/mock/db';
import { sleep } from '@/lib/utils';

export async function GET() {
  try {
    await sleep(200);
    
    const rankings = db.getRankings();
    return NextResponse.json({ items: rankings });
  } catch (error) {
    console.error('Error in /api/rankings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
