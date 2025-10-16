/**
 * Manual test to insert a batch inference task into MongoDB
 * This simulates what the API route does
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function testInsert() {
  try {
    // Read MONGODB_URI from .env.local
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/MONGODB_URI=["']?([^"'\n]+)["']?/);
    
    if (!match) {
      console.log('❌ MONGODB_URI not found in .env.local');
      return;
    }
    
    const MONGODB_URI = match[1];
    console.log('📊 Connecting to MongoDB...');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('📁 Database:', mongoose.connection.db.databaseName);
    
    // Import the model
    const modelModule = await import('./src/lib/models/BatchInferenceTask.ts');
    let BatchInferenceTask = modelModule.default || modelModule.BatchInferenceTask || modelModule;
    
    // If it's still wrapped, unwrap it
    if (BatchInferenceTask.default) {
      BatchInferenceTask = BatchInferenceTask.default;
    }
    
    console.log('Model type:', typeof BatchInferenceTask);
    
    console.log('\n💾 Creating test task...');
    
    const testTask = new BatchInferenceTask({
      userId: 'manual_test_user_' + Date.now(),
      clerkUserId: 'user_manual_test',
      taskId: 'manual_test_' + Date.now(),
      modelName: 'meta-llama/Llama-3.3-70B-Instruct',
      status: 'queued',
      inputFile: {
        path: 's3://test-bucket/manual-test.csv',
        columnName: 'prompt',
        delimiter: ',',
        totalLines: 10,
      },
      processingConfig: {
        systemPrompt: 'You are a helpful assistant.',
        maxBufferSize: 1000,
        minBufferSize: 500,
        startingId: 0,
        dryRun: false,
      },
      samplingParams: {
        maxCompletionTokens: 100,
        temperature: 0.7,
      },
      progress: {
        linesProcessed: 0,
        batchesSent: 0,
        currentBufferSize: 0,
      },
      tokenMetrics: {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
      },
      performanceMetrics: {
        totalBatches: 0,
      },
      queuedAt: new Date(),
    });
    
    await testTask.save();
    
    console.log('✅ Task saved successfully!');
    console.log('Document ID:', testTask._id);
    console.log('Task ID:', testTask.taskId);
    
    // Verify it's in the database
    const count = await BatchInferenceTask.countDocuments();
    console.log(`\n📊 Total tasks in collection: ${count}`);
    
    // Clean up
    console.log('\n🧹 Cleaning up test task...');
    await BatchInferenceTask.deleteOne({ _id: testTask._id });
    console.log('✅ Test task deleted');
    
    await mongoose.connection.close();
    console.log('✅ Connection closed');
    
    console.log('\n✅ TEST PASSED: MongoDB insertion works correctly!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testInsert();

