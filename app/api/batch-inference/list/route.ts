import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserBatchInferenceTasks } from '@/lib/services/batch-inference-service';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status') || undefined;

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Get user's tasks
    const tasks = await getUserBatchInferenceTasks(userId, limit);

    // Format response
    const formattedTasks = tasks.map((task) => ({
      taskId: task.taskId,
      modelName: task.modelName,
      status: task.status,
      progress: task.progress,
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      totalDurationMs: task.totalDurationMs,
      inputFile: {
        path: task.inputFile.path,
        columnName: task.inputFile.columnName,
      },
      tokenMetrics: task.tokenMetrics,
      performanceMetrics: task.performanceMetrics,
      hasOutput: !!(task.outputFile?.s3Path),
      error: task.error,
    }));

    return NextResponse.json({
      tasks: formattedTasks,
      count: formattedTasks.length,
    });
  } catch (error) {
    console.error('Error listing batch inference tasks:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

