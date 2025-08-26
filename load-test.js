#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

// Test configuration
const CONCURRENT_USERS = 10; // Small test first
const BASE_URL = 'http://localhost:3002';
const TEST_API_KEY = 'gk-loadtest_12345678901234567890'; // Mock format
const MODELS = [
  'groq/gemma-groq-416',
  'anthropic/claude-3-5-sonnet-260',
  'google/gemini-2-0-pro-130',
  'openai/gpt-4-451',
  'perplexity/perplexity-70b-73'
];

// Statistics tracking
let stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responses: {},
  machineDistribution: {},
  totalResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  errors: {},
  queuePositions: []
};

// Make a single API request
async function makeRequest(userId, requestId) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    
    // Randomly select a model for this request
    const model = MODELS[Math.floor(Math.random() * MODELS.length)];
    
    const payload = JSON.stringify({
      model: model,
      messages: [
        {
          role: "user",
          content: `Hello from user ${userId}, request ${requestId}. Test concurrent load.`
        }
      ],
      max_tokens: 50
    });

    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/v1/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        stats.totalRequests++;
        stats.totalResponseTime += responseTime;
        stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
        stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);

        if (res.statusCode === 200) {
          stats.successfulRequests++;
          try {
            const result = JSON.parse(data);
            const content = result.choices?.[0]?.message?.content || '';
            const machineInfo = result.instance_info || result.gateway;
            
            // Track response content
            stats.responses[content] = (stats.responses[content] || 0) + 1;
            
            // Track machine distribution
            if (machineInfo && machineInfo.machine_number) {
              const machine = `Machine ${machineInfo.machine_number}`;
              stats.machineDistribution[machine] = (stats.machineDistribution[machine] || 0) + 1;
            }
            
            // Track processing mode
            const processingMode = result.processing_mode || 'unknown';
            stats.responses[processingMode] = (stats.responses[processingMode] || 0) + 1;

          } catch (parseError) {
            stats.errors['parse_error'] = (stats.errors['parse_error'] || 0) + 1;
          }
        } else {
          stats.failedRequests++;
          try {
            const errorResult = JSON.parse(data);
            const errorKey = errorResult.error || `http_${res.statusCode}`;
            stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
            
            // Track queue positions if available
            if (errorResult.queue_status && errorResult.queue_status.position) {
              stats.queuePositions.push(errorResult.queue_status.position);
            }
          } catch (parseError) {
            stats.errors[`http_${res.statusCode}`] = (stats.errors[`http_${res.statusCode}`] || 0) + 1;
          }
        }

        resolve({
          success: res.statusCode === 200,
          responseTime,
          statusCode: res.statusCode
        });
      });
    });

    req.on('error', (error) => {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      stats.totalRequests++;
      stats.failedRequests++;
      stats.totalResponseTime += responseTime;
      stats.errors[error.code || 'request_error'] = (stats.errors[error.code || 'request_error'] || 0) + 1;
      
      resolve({
        success: false,
        responseTime,
        error: error.message
      });
    });

    req.write(payload);
    req.end();
  });
}

// Create test API key first
async function createTestAPIKey() {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      action: 'create_test_key',
      credits: 1000 // Give enough credits for testing
    });

    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/admin/setup',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Setup response:', data);
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', (error) => {
      console.log('Setup failed, proceeding with default test key');
      resolve(true); // Continue anyway
    });

    req.write(payload);
    req.end();
  });
}

// Run the load test
async function runLoadTest() {
  console.log(`🚀 Starting load test with ${CONCURRENT_USERS} concurrent users`);
  console.log(`📊 Testing models: ${MODELS.join(', ')}`);
  console.log(`🏗️  API Gateway enabled: ${process.env.GATEWAY_ENABLED || 'true'}`);
  console.log();

  // Setup test environment
  console.log('Setting up test environment...');
  await createTestAPIKey();
  
  // Reset stats
  stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responses: {},
    machineDistribution: {},
    totalResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    errors: {},
    queuePositions: []
  };

  const startTime = performance.now();
  console.log(`⏰ Test started at: ${new Date().toISOString()}\n`);

  // Create concurrent requests
  const promises = [];
  for (let userId = 1; userId <= CONCURRENT_USERS; userId++) {
    // Each user makes 1 request
    const promise = makeRequest(userId, 1);
    promises.push(promise);
  }

  // Wait for all requests to complete
  const results = await Promise.all(promises);
  const endTime = performance.now();
  const totalTestTime = endTime - startTime;

  // Calculate statistics
  const avgResponseTime = stats.totalResponseTime / stats.totalRequests;
  const successRate = (stats.successfulRequests / stats.totalRequests) * 100;
  
  console.log('\n📈 LOAD TEST RESULTS');
  console.log('═'.repeat(50));
  console.log(`Total Test Time: ${Math.round(totalTestTime)}ms`);
  console.log(`Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Successful Requests: ${stats.successfulRequests}`);
  console.log(`Failed Requests: ${stats.failedRequests}`);
  console.log(`Success Rate: ${successRate.toFixed(2)}%`);
  console.log();
  
  console.log('📊 Response Times:');
  console.log(`  Average: ${Math.round(avgResponseTime)}ms`);
  console.log(`  Min: ${Math.round(stats.minResponseTime)}ms`);
  console.log(`  Max: ${Math.round(stats.maxResponseTime)}ms`);
  console.log();
  
  console.log('🤖 Machine Distribution:');
  Object.entries(stats.machineDistribution).forEach(([machine, count]) => {
    const percentage = ((count / stats.successfulRequests) * 100).toFixed(1);
    console.log(`  ${machine}: ${count} requests (${percentage}%)`);
  });
  console.log();
  
  console.log('📝 Sample Responses:');
  Object.entries(stats.responses)
    .filter(([key, count]) => key.startsWith('Hello from Machine'))
    .slice(0, 5)
    .forEach(([response, count]) => {
      console.log(`  "${response}": ${count} times`);
    });
  console.log();
  
  if (Object.keys(stats.errors).length > 0) {
    console.log('❌ Errors:');
    Object.entries(stats.errors).forEach(([error, count]) => {
      console.log(`  ${error}: ${count} times`);
    });
    console.log();
  }

  if (stats.queuePositions.length > 0) {
    console.log('⏳ Queue Information:');
    const avgQueuePosition = stats.queuePositions.reduce((a, b) => a + b, 0) / stats.queuePositions.length;
    console.log(`  Average Queue Position: ${avgQueuePosition.toFixed(1)}`);
    console.log(`  Max Queue Position: ${Math.max(...stats.queuePositions)}`);
    console.log();
  }

  // Performance metrics
  const requestsPerSecond = (stats.totalRequests / (totalTestTime / 1000)).toFixed(2);
  console.log('⚡ Performance:');
  console.log(`  Requests per second: ${requestsPerSecond}`);
  console.log(`  Concurrent processing capability: ${CONCURRENT_USERS} users`);
  
  console.log('\n✅ Load test completed!');
}

// Check if server is running before starting test
function checkServerHealth() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/gateway/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const health = JSON.parse(data);
          console.log('🔍 Gateway Health Check:');
          console.log(`  Overall Status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
          console.log(`  Redis: ${health.checks.redis ? '✅ Connected' : '❌ Disconnected'}`);
          console.log(`  Instances: ${health.checks.instances.healthy}/${health.checks.instances.total} healthy`);
          console.log();
          resolve(health.healthy);
        } else {
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      console.log('❌ Server not responding. Make sure the development server is running.');
      resolve(false);
    });

    req.end();
  });
}

// Main execution
async function main() {
  console.log('🧪 API Gateway Load Test');
  console.log('═'.repeat(30));
  
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    console.log('\n❌ Server health check failed. Please ensure:');
    console.log('  1. Development server is running (npm run dev)');
    console.log('  2. Redis is running (redis-server)');
    console.log('  3. Gateway is enabled (GATEWAY_ENABLED=true)');
    process.exit(1);
  }

  await runLoadTest();
}

// Run the test
main().catch(console.error);