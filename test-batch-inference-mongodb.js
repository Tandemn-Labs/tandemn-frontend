/**
 * Test script to verify MongoDB storage for batch inference tasks
 * Tests MongoDB models directly without Clerk dependencies
 */

const mongoose = require('mongoose');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test data
const testUserId = 'test_user_' + Date.now();
const testTaskId = 'test_task_' + Date.now();

async function connectToMongoDB() {
  logSection('Connecting to MongoDB');
  
  // Load environment variables manually from .env file
  const fs = require('fs');
  const path = require('path');
  
  let MONGODB_URI = process.env.MONGODB_URI;
  
  // If not in env, try to read from .env.local or .env file
  if (!MONGODB_URI) {
    const envFiles = ['.env.local', '.env'];
    for (const envFile of envFiles) {
      try {
        const envPath = path.join(__dirname, envFile);
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/MONGODB_URI=["']?([^"'\n]+)["']?/);
        if (match) {
          MONGODB_URI = match[1];
          logInfo(`Loaded MONGODB_URI from ${envFile}`);
          break;
        }
      } catch (error) {
        // File not found or couldn't be read, try next
      }
    }
  }
  
  if (!MONGODB_URI) {
    logError('MONGODB_URI not found in environment variables or .env file');
    logInfo('Make sure you have MONGODB_URI set in your .env file');
    logInfo('Or run: MONGODB_URI="your-uri" npx tsx test-batch-inference-mongodb.js');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(MONGODB_URI);
    logSuccess('Connected to MongoDB');
    return true;
  } catch (error) {
    logError(`Failed to connect to MongoDB: ${error.message}`);
    return false;
  }
}

async function testCreateTask(BatchInferenceTask) {
  logSection('TEST 1: Create Batch Inference Task');
  
  try {
    const taskData = {
      taskId: testTaskId,
      clerkUserId: testUserId,
      userId: 'test_mongo_user_' + Date.now(), // MongoDB UserAccount _id
      modelName: 'meta-llama/Llama-3.3-70B-Instruct',
      status: 'queued',
      inputFile: {
        path: 's3://test-bucket/test-input.csv',
        filename: 'test-input.csv',
        s3Path: 's3://test-bucket/test-input.csv',
        s3Bucket: 'test-bucket',
        s3Key: 'test-input.csv',
        columnName: 'prompt',
        delimiter: ',',
        fileSize: 1024,
        totalLines: 5,
      },
      processingConfig: {
        batchSize: 2,
        maxConcurrentRequests: 5,
        minBufferSize: 10,
        maxBufferSize: 100,
        systemPrompt: 'You are a helpful assistant.',
      },
      samplingParams: {
        maxTokens: 100,
        temperature: 0.7,
      },
      progress: {
        linesProcessed: 0,
        batchesSent: 0,
        currentBufferSize: 0,
      },
    };
    
    logInfo('Creating task with data:');
    console.log(JSON.stringify(taskData, null, 2));
    
    const task = new BatchInferenceTask(taskData);
    await task.save();
    
    logSuccess('Task created successfully!');
    logInfo(`MongoDB _id: ${task._id}`);
    logInfo(`Task ID: ${task.taskId}`);
    logInfo(`Status: ${task.status}`);
    logInfo(`Model: ${task.modelName}`);
    logInfo(`Created at: ${task.createdAt}`);
    
    return task;
  } catch (error) {
    logError(`Failed to create task: ${error.message}`);
    console.error(error);
    return null;
  }
}

async function testRetrieveTask(BatchInferenceTask, taskId) {
  logSection('TEST 2: Retrieve Task from MongoDB');
  
  try {
    logInfo(`Retrieving task: ${taskId}`);
    const task = await BatchInferenceTask.findOne({ taskId });
    
    if (!task) {
      logError('Task not found in MongoDB');
      return false;
    }
    
    logSuccess('Task retrieved successfully!');
    logInfo(`Task ID: ${task.taskId}`);
    logInfo(`Status: ${task.status}`);
    logInfo(`Model: ${task.modelName}`);
    logInfo(`User ID: ${task.clerkUserId}`);
    logInfo(`Input file: ${task.inputFile?.filename}`);
    
    return true;
  } catch (error) {
    logError(`Failed to retrieve task: ${error.message}`);
    return false;
  }
}

async function testUpdateProgress(BatchInferenceTask, taskId) {
  logSection('TEST 3: Update Task Progress');
  
  try {
    const updateData = {
      status: 'processing',
      startedAt: new Date(),
      'progress.linesProcessed': 3,
      'progress.batchesSent': 2,
      'progress.currentBufferSize': 1,
      'performanceMetrics.linesPerSecond': 1.5,
      'performanceMetrics.totalBatches': 2,
    };
    
    logInfo('Updating progress:');
    console.log(JSON.stringify(updateData, null, 2));
    
    const updatedTask = await BatchInferenceTask.findOneAndUpdate(
      { taskId },
      { $set: updateData },
      { new: true }
    );
    
    if (!updatedTask) {
      logError('Task not found for update');
      return false;
    }
    
    logSuccess('Progress updated successfully!');
    logInfo(`Status: ${updatedTask.status}`);
    logInfo(`Lines processed: ${updatedTask.progress.linesProcessed}`);
    logInfo(`Batches sent: ${updatedTask.progress.batchesSent}`);
    logInfo(`Lines/sec: ${updatedTask.performanceMetrics.linesPerSecond}`);
    
    return true;
  } catch (error) {
    logError(`Failed to update progress: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function testCompleteTask(BatchInferenceTask, taskId) {
  logSection('TEST 4: Complete Task with Output File');
  
  try {
    const completionData = {
      status: 'completed',
      completedAt: new Date(),
      'outputFile.s3Path': 's3://test-bucket/results/output.csv',
      'outputFile.s3Bucket': 'test-bucket',
      'outputFile.s3Key': 'results/output.csv',
      'outputFile.fileSize': 2048,
      'progress.linesProcessed': 5,
    };
    
    logInfo('Marking task as completed:');
    console.log(JSON.stringify(completionData, null, 2));
    
    const completedTask = await BatchInferenceTask.findOneAndUpdate(
      { taskId },
      { $set: completionData },
      { new: true }
    );
    
    if (!completedTask) {
      logError('Task not found for completion');
      return false;
    }
    
    logSuccess('Task completed successfully!');
    logInfo(`Status: ${completedTask.status}`);
    logInfo(`Completed at: ${completedTask.completedAt}`);
    logInfo(`Output file S3 path: ${completedTask.outputFile?.s3Path}`);
    logInfo(`Output file size: ${completedTask.outputFile?.fileSize} bytes`);
    logInfo(`Lines processed: ${completedTask.progress.linesProcessed}`);
    
    return true;
  } catch (error) {
    logError(`Failed to complete task: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function testListUserTasks(BatchInferenceTask, userId) {
  logSection('TEST 5: List User Tasks');
  
  try {
    logInfo(`Retrieving tasks for user: ${userId}`);
    const tasks = await BatchInferenceTask.find({ clerkUserId: userId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    logSuccess(`Found ${tasks.length} task(s) for user`);
    
    tasks.forEach((task, index) => {
      logInfo(`\nTask ${index + 1}:`);
      logInfo(`  Task ID: ${task.taskId}`);
      logInfo(`  Status: ${task.status}`);
      logInfo(`  Model: ${task.modelName}`);
      logInfo(`  Created: ${task.createdAt}`);
      logInfo(`  Lines processed: ${task.progress?.linesProcessed || 0}`);
      if (task.outputFile?.s3Path) {
        logInfo(`  Output: ${task.outputFile.s3Path}`);
      }
    });
    
    return tasks.length > 0;
  } catch (error) {
    logError(`Failed to list user tasks: ${error.message}`);
    return false;
  }
}

async function testQueryByStatus(BatchInferenceTask) {
  logSection('TEST 6: Query Tasks by Status');
  
  try {
    const statusCounts = await BatchInferenceTask.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    logSuccess('Status counts in database:');
    statusCounts.forEach(item => {
      logInfo(`  ${item._id}: ${item.count}`);
    });
    
    // Query completed tasks
    const completedTasks = await BatchInferenceTask.find({ status: 'completed' })
      .limit(3)
      .sort({ completedAt: -1 });
    
    logInfo(`\nRecent completed tasks: ${completedTasks.length}`);
    
    return true;
  } catch (error) {
    logError(`Failed to query by status: ${error.message}`);
    return false;
  }
}

async function testFailTask(BatchInferenceTask) {
  logSection('TEST 7: Test Task Failure Handling');
  
  try {
    const failTaskId = 'test_fail_' + Date.now();
    
    // Create a task
    const task = new BatchInferenceTask({
      taskId: failTaskId,
      clerkUserId: testUserId,
      userId: 'test_mongo_user_' + Date.now(),
      modelName: 'test-model',
      status: 'processing',
      inputFile: {
        path: 's3://test/test.csv',
        filename: 'test.csv',
        s3Path: 's3://test/test.csv',
        s3Bucket: 'test',
        s3Key: 'test.csv',
        columnName: 'prompt',
        delimiter: ',',
        fileSize: 100,
        totalLines: 1,
      },
      processingConfig: {
        batchSize: 2,
        maxConcurrentRequests: 5,
        minBufferSize: 10,
        maxBufferSize: 100,
        systemPrompt: 'Test',
      },
      progress: {
        linesProcessed: 0,
        batchesSent: 0,
        currentBufferSize: 0,
      },
    });
    await task.save();
    
    logInfo(`Created task ${failTaskId}, now marking as failed...`);
    
    // Mark as failed
    const failedTask = await BatchInferenceTask.findOneAndUpdate(
      { taskId: failTaskId },
      {
        $set: {
          status: 'failed',
          completedAt: new Date(),
          'error.message': 'Test error message',
          'error.type': 'TestError',
          'error.timestamp': new Date(),
        },
      },
      { new: true }
    );
    
    logSuccess('Task marked as failed successfully!');
    logInfo(`Status: ${failedTask.status}`);
    logInfo(`Error message: ${failedTask.error?.message}`);
    logInfo(`Error type: ${failedTask.error?.type}`);
    logInfo(`Failed at: ${failedTask.completedAt}`);
    
    return true;
  } catch (error) {
    logError(`Failed to test error handling: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function testDirectModelAccess(BatchInferenceTask) {
  logSection('TEST 8: Direct Model Access & Aggregations');
  
  try {
    // Count total documents
    const totalCount = await BatchInferenceTask.countDocuments();
    logInfo(`Total tasks in database: ${totalCount}`);
    
    // Get test user's tasks
    const userTasks = await BatchInferenceTask.find({ clerkUserId: testUserId });
    logSuccess(`Found ${userTasks.length} task(s) for test user`);
    
    // Get the most recent task
    const recentTask = await BatchInferenceTask.findOne()
      .sort({ createdAt: -1 });
    
    if (recentTask) {
      logInfo('\nMost recent task in database:');
      logInfo(`  Task ID: ${recentTask.taskId}`);
      logInfo(`  Status: ${recentTask.status}`);
      logInfo(`  Model: ${recentTask.modelName}`);
      logInfo(`  Created: ${recentTask.createdAt}`);
    }
    
    // Test indexing by querying with taskId
    const startTime = Date.now();
    await BatchInferenceTask.findOne({ taskId: testTaskId });
    const queryTime = Date.now() - startTime;
    logSuccess(`Query by taskId took ${queryTime}ms (should be fast with index)`);
    
    return true;
  } catch (error) {
    logError(`Failed direct model access: ${error.message}`);
    return false;
  }
}

async function cleanupTestData(BatchInferenceTask) {
  logSection('Cleanup: Removing Test Data');
  
  try {
    const result = await BatchInferenceTask.deleteMany({ clerkUserId: testUserId });
    
    logSuccess(`Deleted ${result.deletedCount} test task(s)`);
    return true;
  } catch (error) {
    logError(`Failed to cleanup: ${error.message}`);
    return false;
  }
}

async function runTests() {
  log('\n🧪 BATCH INFERENCE MONGODB STORAGE TEST SUITE 🧪\n', 'cyan');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };
  
  // Connect to MongoDB
  const connected = await connectToMongoDB();
  if (!connected) {
    logError('Cannot proceed without MongoDB connection');
    process.exit(1);
  }
  
  // Import the model dynamically after connection
  let BatchInferenceTask;
  try {
    const modelModule = await import('./src/lib/models/BatchInferenceTask.ts');
    // Handle both default and named exports
    BatchInferenceTask = modelModule.default || modelModule.BatchInferenceTask || modelModule;
    
    // If it's still wrapped, unwrap it
    if (BatchInferenceTask.default) {
      BatchInferenceTask = BatchInferenceTask.default;
    }
    
    logSuccess('Loaded BatchInferenceTask model');
    logInfo(`Model type: ${typeof BatchInferenceTask}`);
    logInfo(`Has find: ${typeof BatchInferenceTask.find}`);
  } catch (error) {
    logError(`Failed to load model: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
  
  // Run tests
  const tests = [
    { name: 'Create Task', fn: testCreateTask, args: [BatchInferenceTask], captureResult: true },
    { name: 'Retrieve Task', fn: testRetrieveTask, args: [BatchInferenceTask, testTaskId] },
    { name: 'Update Progress', fn: testUpdateProgress, args: [BatchInferenceTask, testTaskId] },
    { name: 'Complete Task', fn: testCompleteTask, args: [BatchInferenceTask, testTaskId] },
    { name: 'List User Tasks', fn: testListUserTasks, args: [BatchInferenceTask, testUserId] },
    { name: 'Query by Status', fn: testQueryByStatus, args: [BatchInferenceTask] },
    { name: 'Task Failure Handling', fn: testFailTask, args: [BatchInferenceTask] },
    { name: 'Direct Model Access', fn: testDirectModelAccess, args: [BatchInferenceTask] },
  ];
  
  let createdTask = null;
  
  for (const test of tests) {
    results.total++;
    
    try {
      const result = await test.fn(...test.args);
      
      if (test.captureResult) {
        createdTask = result;
      }
      
      if (result || result === true) {
        results.passed++;
        logSuccess(`✓ Test passed: ${test.name}`);
      } else {
        results.failed++;
        logError(`✗ Test failed: ${test.name}`);
      }
    } catch (error) {
      results.failed++;
      logError(`✗ Test failed with exception: ${test.name}`);
      console.error(error);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Cleanup
  await cleanupTestData(BatchInferenceTask);
  
  // Summary
  logSection('TEST SUMMARY');
  log(`Total tests: ${results.total}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  
  if (results.failed === 0) {
    log('\n🎉 ALL TESTS PASSED! MongoDB storage is working correctly! 🎉\n', 'green');
  } else {
    log('\n⚠️  SOME TESTS FAILED. Check the output above for details. ⚠️\n', 'yellow');
  }
  
  // Close connection
  await mongoose.connection.close();
  logInfo('MongoDB connection closed');
}

// Run the tests
runTests().catch(console.error);
