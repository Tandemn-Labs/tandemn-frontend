import { NextResponse } from 'next/server';
import { db } from '@/mock/db';
import { sleep } from '@/lib/utils';
import { fetchRealKPIStats, getKPIStats } from '@/lib/models-config';

export async function GET() {
  try {
    await sleep(150);
    
    const featured = db.getFeatured();
    
    // Try to get real KPI stats, fallback to local data
    let kpis;
    try {
      kpis = await fetchRealKPIStats();
    } catch (error) {
      console.warn('Failed to fetch real KPI stats, using local data:', error);
      kpis = getKPIStats();
    }
    
    return NextResponse.json({
      featured,
      kpis,
    });
  } catch (error) {
    console.error('Error in /api/featured:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
