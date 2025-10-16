import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserBatchInferenceTasks } from '@/lib/services/batch-inference-service';
import dbConnect from '@/lib/database';
import BatchInferenceTask from '@/lib/models/BatchInferenceTask';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action') || 'list';

    await dbConnect();

    switch (action) {
      case 'list':
        // Get user's tasks
        const tasks = await getUserBatchInferenceTasks(userId, 100);
        
        return NextResponse.json({
          success: true,
          count: tasks.length,
          tasks: tasks.map(task => ({
            taskId: task.taskId,
            status: task.status,
            modelName: task.modelName,
            createdAt: task.createdAt,
            completedAt: task.completedAt,
            hasOutputFile: !!(task.outputFile?.s3Path),
            linesProcessed: task.progress?.linesProcessed || 0,
          })),
        });

      case 'count':
        // Count all tasks in database
        const totalCount = await BatchInferenceTask.countDocuments({});
        const userCount = await BatchInferenceTask.countDocuments({ clerkUserId: userId });
        const statusCounts = await BatchInferenceTask.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        return NextResponse.json({
          success: true,
          totalTasksInDB: totalCount,
          userTasks: userCount,
          byStatus: statusCounts.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>),
        });

      case 'recent':
        // Get 10 most recent tasks across all users (admin view)
        const recentTasks = await BatchInferenceTask.find({})
          .sort({ createdAt: -1 })
          .limit(10)
          .select('taskId status modelName clerkUserId createdAt completedAt progress.linesProcessed outputFile.s3Path');
        
        return NextResponse.json({
          success: true,
          recentTasks: recentTasks.map(task => ({
            taskId: task.taskId,
            status: task.status,
            modelName: task.modelName,
            userId: task.clerkUserId?.substring(0, 12) + '...',
            createdAt: task.createdAt,
            completedAt: task.completedAt,
            hasOutputFile: !!(task.outputFile?.s3Path),
            linesProcessed: task.progress?.linesProcessed || 0,
          })),
        });

      case 'detail':
        // Get full details of a specific task
        const taskId = searchParams.get('taskId');
        if (!taskId) {
          return NextResponse.json({ error: 'taskId required' }, { status: 400 });
        }

        const task = await BatchInferenceTask.findOne({ taskId, clerkUserId: userId });
        if (!task) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          task: {
            taskId: task.taskId,
            status: task.status,
            modelName: task.modelName,
            progress: task.progress,
            performanceMetrics: task.performanceMetrics,
            tokenMetrics: task.tokenMetrics,
            outputFile: task.outputFile,
            costInfo: task.costInfo,
            queuedAt: task.queuedAt,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            totalDurationMs: task.totalDurationMs,
            error: task.error,
          },
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

