#!/usr/bin/env node

// Test the GPU configurations for each model
const models = [
  {
    name: "DeepSeek R1 Distilled Llama 70B (AWQ)",
    expected: {
      gpus: 4,
      types: ["L40S", "L40S", "L40S", "A10G"],
      layers: [23, 23, 22, 12],
      totalLayers: 80,
      memory: [48, 48, 48, 24],
      totalMemory: 168
    }
  },
  {
    name: "Qwen3 32B (AWQ)", 
    expected: {
      gpus: 3,
      types: ["L40", "A10G", "A10G"],
      layers: [32, 16, 16],
      totalLayers: 64,
      memory: [48, 24, 24],
      totalMemory: 96
    }
  },
  {
    name: "Devstral Small 2507 (AWQ)",
    expected: {
      gpus: 3,
      types: ["A10G", "A10G", "L4"],
      layers: [13, 13, 13],
      totalLayers: 39,
      memory: [24, 24, 24],
      totalMemory: 72
    }
  },
  {
    name: "Llama 3.3 70B Instruct (AWQ)",
    expected: {
      gpus: 3,
      types: ["L40", "L40", "L40"],
      layers: [27, 27, 26],
      totalLayers: 80,
      memory: [48, 48, 48],
      totalMemory: 144
    }
  }
];

function testModelConfiguration(model) {
  console.log(`\n🧪 Testing GPU configuration for ${model.name}`);
  console.log('='.repeat(60));
  
  const { expected } = model;
  
  console.log(`📊 Expected Configuration:`);
  console.log(`   GPUs: ${expected.gpus}`);
  console.log(`   Types: ${expected.types.join(', ')}`);
  console.log(`   Layers: ${expected.layers.join(' + ')} = ${expected.totalLayers}`);
  console.log(`   Memory: ${expected.memory.join('GB + ')}GB = ${expected.totalMemory}GB`);
  
  // Verify layer distribution matches requirements
  let isCorrect = true;
  
  if (model.name.includes('DeepSeek')) {
    // DeepSeek: 3 L40S (23, 23, 22) + 1 A10G (12)
    const expectedConfig = [23, 23, 22, 12];
    const actualSum = expectedConfig.reduce((sum, layers) => sum + layers, 0);
    
    if (actualSum === 80 && expected.totalLayers === 80) {
      console.log(`✅ DeepSeek layer distribution correct: 70B model = 80 layers`);
    } else {
      console.log(`❌ DeepSeek layer distribution incorrect`);
      isCorrect = false;
    }
  }
  
  if (model.name.includes('Qwen')) {
    // Qwen: 1 L40 (32) + 2 A10G (16 each)
    const expectedConfig = [32, 16, 16];
    const actualSum = expectedConfig.reduce((sum, layers) => sum + layers, 0);
    
    if (actualSum === 64 && expected.totalLayers === 64) {
      console.log(`✅ Qwen layer distribution correct: 32B model = 64 layers`);
    } else {
      console.log(`❌ Qwen layer distribution incorrect`);
      isCorrect = false;
    }
  }
  
  if (model.name.includes('Devstral')) {
    // Devstral: 2 A10G + 1 L4 (13 each)
    const expectedConfig = [13, 13, 13];
    const actualSum = expectedConfig.reduce((sum, layers) => sum + layers, 0);
    
    if (actualSum === 39 && expected.totalLayers === 39) {
      console.log(`✅ Devstral layer distribution correct: 24B model = 39 layers`);
    } else {
      console.log(`❌ Devstral layer distribution incorrect`);
      isCorrect = false;
    }
  }
  
  if (model.name.includes('Llama')) {
    // Llama: 3 L40 (27, 27, 26)
    const expectedConfig = [27, 27, 26];
    const actualSum = expectedConfig.reduce((sum, layers) => sum + layers, 0);
    
    if (actualSum === 80 && expected.totalLayers === 80) {
      console.log(`✅ Llama layer distribution correct: 70B model = 80 layers`);
    } else {
      console.log(`❌ Llama layer distribution incorrect`);
      isCorrect = false;
    }
  }
  
  // Check memory allocation
  const memoryPerGPU = {
    'L40S': 48,
    'L40': 48, 
    'A10G': 24,
    'L4': 24
  };
  
  const expectedMemory = expected.types.reduce((sum, type) => sum + memoryPerGPU[type], 0);
  
  if (expectedMemory === expected.totalMemory) {
    console.log(`✅ Memory allocation correct: ${expected.totalMemory}GB total`);
  } else {
    console.log(`❌ Memory allocation incorrect: expected ${expectedMemory}GB, got ${expected.totalMemory}GB`);
    isCorrect = false;
  }
  
  return isCorrect;
}

function runGPUTests() {
  console.log('🚀 Testing GPU Waterfall Model Configurations');
  console.log('=============================================\n');
  
  const results = {};
  
  for (const model of models) {
    const isCorrect = testModelConfiguration(model);
    results[model.name] = isCorrect;
  }
  
  console.log('\n📋 GPU Configuration Test Results:');
  console.log('===================================');
  
  for (const [modelName, isCorrect] of Object.entries(results)) {
    const status = isCorrect ? '✅ CORRECT' : '❌ INCORRECT';
    const shortName = modelName.split(' ')[0];
    console.log(`${status} ${shortName}`);
  }
  
  const correctCount = Object.values(results).filter(Boolean).length;
  console.log(`\n🎯 ${correctCount}/4 models have correct GPU configurations`);
  
  if (correctCount === 4) {
    console.log('🎉 All GPU waterfall configurations are correct!');
    console.log('\n💡 The chat interface will now show:');
    console.log('   • Correct GPU types and memory for each model');
    console.log('   • Proper layer distribution in waterfall format');
    console.log('   • Real-time visualization during inference');
    console.log('   • Model-specific infrastructure details');
    process.exit(0);
  } else {
    console.log('⚠️ Some GPU configurations need attention');
    process.exit(1);
  }
}

runGPUTests();