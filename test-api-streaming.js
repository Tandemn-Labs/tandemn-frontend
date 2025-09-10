#!/usr/bin/env node

// Test our v1/chat API with streaming for all working models
const API_BASE = 'http://localhost:3002';  // Adjust port if needed
const TEST_API_KEY = 'gk-loadtest_12345678901234567890';

const workingModels = [
  "casperhansen/deepseek-r1-distill-llama-70b-awq",
  "Qwen/Qwen3-32B-AWQ", 
  "btbtyler09/Devstral-Small-2507-AWQ"
];

async function testAPIStreamingForModel(model) {
  console.log(`\n🧪 Testing API streaming for ${model}...`);
  
  const payload = {
    model: model,
    messages: [
      { role: "user", content: "Hello! Write a short poem about AI." }
    ],
    stream: true,
    max_tokens: 200
  };

  try {
    const response = await fetch(`${API_BASE}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(payload)
    });

    console.log(`📡 ${model}: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ${model}: ${errorText}`);
      return false;
    }

    // Test streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let chunks = 0;
    let content = '';
    let hasContent = false;

    if (reader) {
      let buffer = '';
      const startTime = Date.now();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine === 'data: [DONE]') {
              console.log(`🎉 ${model}: Stream completed in ${Date.now() - startTime}ms`);
              console.log(`📊 ${model}: Received ${chunks} chunks, ${content.length} characters`);
              if (content.length > 0) {
                console.log(`📝 ${model}: Sample: "${content.substring(0, 100)}..."`);
              }
              return hasContent;
            }
            
            if (trimmedLine.startsWith('data: ')) {
              try {
                const jsonData = trimmedLine.slice(6);
                const chunk = JSON.parse(jsonData);
                const deltaContent = chunk.choices?.[0]?.delta?.content;
                
                if (deltaContent) {
                  chunks++;
                  content += deltaContent;
                  hasContent = true;
                  
                  if (chunks === 1) {
                    console.log(`📨 ${model}: First chunk received`);
                  }
                  
                  // Stop after getting enough content  
                  if (content.length > 150) {
                    console.log(`⏹️  ${model}: Stopping after 150 characters`);
                    reader.cancel();
                    console.log(`✅ ${model}: API streaming works! Got ${chunks} chunks`);
                    return true;
                  }
                }
              } catch (parseError) {
                console.warn(`⚠️  ${model}: Parse error:`, parseError.message);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
    
    return hasContent;
    
  } catch (error) {
    console.error(`❌ ${model}: API test failed`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function startLocalServer() {
  console.log('🚀 Starting local development server...');
  
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const server = spawn('npm', ['run', 'dev'], {
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverReady = false;
    
    server.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('📊 Server:', output.trim());
      
      if (output.includes('Ready in') || output.includes('ready') || output.includes('Local:')) {
        if (!serverReady) {
          serverReady = true;
          console.log('✅ Server is ready!');
          resolve(server);
        }
      }
    });
    
    server.stderr.on('data', (data) => {
      console.error('🔴 Server Error:', data.toString().trim());
    });
    
    server.on('close', (code) => {
      console.log(`🛑 Server exited with code ${code}`);
      if (!serverReady) {
        reject(new Error('Server failed to start'));
      }
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        server.kill();
        reject(new Error('Server startup timeout'));
      }
    }, 30000);
  });
}

async function checkServerHealth() {
  try {
    console.log('🩺 Checking server health...');
    const response = await fetch(`${API_BASE}/api/health`);
    
    if (response.ok) {
      console.log('✅ Server health check passed');
      return true;
    } else {
      console.log('⚠️  Server health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Server health check error:', error.message);
    return false;
  }
}

async function runAPITests() {
  console.log('🧪 Testing v1/chat API with streaming for all working models...\n');
  
  // Check if server is running
  const isHealthy = await checkServerHealth();
  
  if (!isHealthy) {
    console.log('🚀 Server not running, attempting to start...');
    try {
      const server = await startLocalServer();
      
      // Wait a bit for full startup
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check health again
      const healthyAfterStart = await checkServerHealth();
      if (!healthyAfterStart) {
        throw new Error('Server health check failed after startup');
      }
      
      console.log('✅ Server started and healthy');
    } catch (error) {
      console.error('❌ Failed to start server:', error.message);
      console.log('💡 Please start the server manually with: npm run dev');
      return;
    }
  }

  const results = {};
  
  for (const model of workingModels) {
    const success = await testAPIStreamingForModel(model);
    results[model] = success;
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📋 API Streaming Test Results:');
  console.log('=============================');
  
  for (const [model, success] of Object.entries(results)) {
    const status = success ? '✅ WORKING' : '❌ FAILED';
    console.log(`${status} ${model}`);
  }
  
  const workingCount = Object.values(results).filter(Boolean).length;
  console.log(`\n🎯 ${workingCount}/${workingModels.length} models working through API`);
  
  if (workingCount === workingModels.length) {
    console.log('🎉 All models are working with streaming through the API!');
    process.exit(0);
  } else {
    console.log('⚠️  Some models need attention');
    process.exit(1);
  }
}

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, cleaning up...');
  process.exit(0);
});

runAPITests().catch(console.error);