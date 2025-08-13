import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/mock/db';
import { sleep } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await sleep(100);
    
    const { id } = await params;
    const modelId = decodeURIComponent(id);
    const model = db.getModelById(modelId);
    
    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(model);
  } catch (error) {
    console.error('Error in /api/models/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
