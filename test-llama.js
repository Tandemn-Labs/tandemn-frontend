#!/usr/bin/env node

// Test different Llama model names on the first endpoint
const llamaVariants = [
  "meta-llama/llama-3.3-70b-instruct", 
  "llama-3.3-70b-instruct",
  "meta-llama/Llama-3.3-70B-Instruct",
  "Llama-3.3-70B-Instruct",
  "llama3.3-70b-instruct",
  "llama-70b",
  "llama3-70b"
];

async function testLlamaVariant(modelName) {
  console.log(`Testing: ${modelName}`);
  
  try {
    const response = await fetch("http://34.207.103.140:8000/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {role: "system", content: "You are a helpful assistant"},
          {role: "user", content: "Hello"}
        ],
        stream: true,
        temperature: 0.6,
        top_p: 0.9,
        max_completion_tokens: 50
      })
    });

    console.log(`${modelName}: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log(`✅ ${modelName} WORKS!`);
      return modelName;
    } else {
      const error = await response.text();
      console.log(`❌ ${modelName}: ${error.substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`❌ ${modelName}: ${error.message}`);
  }
  
  return null;
}

async function findWorkingLlama() {
  console.log("🔍 Testing different Llama model names on first endpoint...\n");
  
  for (const variant of llamaVariants) {
    const working = await testLlamaVariant(variant);
    if (working) {
      console.log(`\n🎉 Found working Llama model: ${working}`);
      return working;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log("\n❌ No working Llama variant found on this endpoint");
  console.log("💡 Llama 70B might be on a different endpoint or not deployed yet");
}

findWorkingLlama().catch(console.error);