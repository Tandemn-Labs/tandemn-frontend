import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchRealKPIStats, getKPIStats } from '@/lib/models-config';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to get real data first, fallback to local data
    const useRealData = request.nextUrl.searchParams.get('real') === 'true';
    
    let stats;
    if (useRealData) {
      stats = await fetchRealKPIStats();
    } else {
      stats = getKPIStats();
    }

    return NextResponse.json({ 
      stats,
      source: useRealData ? 'external' : 'local',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching KPI stats:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch KPI stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
