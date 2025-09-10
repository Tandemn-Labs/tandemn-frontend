#!/usr/bin/env node

// Test both model APIs to ensure they only show our 4 Tandemn models
const API_BASE = 'http://localhost:3002';  // Adjust port if needed

async function testModelAPI(endpoint, name) {
  console.log(`\n🧪 Testing ${name} (${endpoint})...`);
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    
    if (!response.ok) {
      console.error(`❌ ${name}: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ ${name}: API responded successfully`);
    
    // Check data structure
    if (endpoint.includes('/api/v1/models')) {
      // v1/models format
      const models = data.data || [];
      console.log(`📊 ${name}: Found ${models.length} models`);
      
      models.forEach(model => {
        console.log(`   • ${model.name} (${model.id})`);
      });
      
      return models.length === 3; // Only 3 available models (Llama disabled)
      
    } else {
      // /api/models format  
      const models = data.items || [];
      console.log(`📊 ${name}: Found ${models.length} models`);
      
      models.forEach(model => {
        console.log(`   • ${model.name} (${model.id}) - ${model.vendor}`);
      });
      
      return models.length === 3; // Only 3 available models (Llama disabled)
    }
    
  } catch (error) {
    console.error(`❌ ${name}: Error - ${error.message}`);
    return false;
  }
}

async function checkServerHealth() {
  try {
    console.log('🩺 Checking server health...');
    const response = await fetch(`${API_BASE}/api/health`);
    
    if (response.ok) {
      console.log('✅ Server is running');
      return true;
    } else {
      console.log('⚠️  Server responded but health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Server not reachable:', error.message);
    console.log('💡 Please start the server with: npm run dev');
    return false;
  }
}

async function runPlaygroundModelTests() {
  console.log('🎮 Testing Playground Model APIs...\n');
  console.log('Expected: Only 3 Tandemn models (Llama disabled)');
  console.log('- casperhansen/deepseek-r1-distill-llama-70b-awq');
  console.log('- Qwen/Qwen3-32B-AWQ');
  console.log('- btbtyler09/Devstral-Small-2507-AWQ');
  
  // Check if server is running
  const isHealthy = await checkServerHealth();
  if (!isHealthy) {
    return;
  }

  const tests = [
    { endpoint: '/api/v1/models', name: 'Models Page API' },
    { endpoint: '/api/models?limit=50', name: 'Chat Page API' }
  ];
  
  const results = {};
  
  for (const test of tests) {
    const success = await testModelAPI(test.endpoint, test.name);
    results[test.name] = success;
  }
  
  console.log('\n📋 Playground Model Test Results:');
  console.log('=================================');
  
  for (const [name, success] of Object.entries(results)) {
    const status = success ? '✅ SHOWING ONLY TANDEMN MODELS' : '❌ STILL SHOWING OTHER MODELS';
    console.log(`${status} ${name}`);
  }
  
  const allGood = Object.values(results).every(Boolean);
  
  if (allGood) {
    console.log('\n🎉 Perfect! Playground now shows only your 4 Tandemn models!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some APIs still need attention');
    process.exit(1);
  }
}

runPlaygroundModelTests().catch(console.error);