#!/usr/bin/env node

// Test script for all 4 models with streaming
const models = [
  "casperhansen/deepseek-r1-distill-llama-70b-awq",
  "Qwen/Qwen3-32B-AWQ", 
  "btbtyler09/Devstral-Small-2507-AWQ",
  "meta-llama/llama-3.3-70b-instruct"
];

const endpoints = [
  "http://34.207.103.140:8000/v1/chat/completions",
  "http://3.91.251.0:8000/v1/chat/completions",
  "http://98.87.8.56:8000/v1/chat/completions",
  "http://34.207.103.140:8000/v1/chat/completions" // Same as first for now
];

const testConfigs = [
  {
    model: "casperhansen/deepseek-r1-distill-llama-70b-awq",
    endpoint: "http://34.207.103.140:8000/v1/chat/completions",
    payload: {
      model: "casperhansen/deepseek-r1-distill-llama-70b-awq",
      messages: [
        {role: "system", content: "You are a helpful assistant"},
        {role: "user", content: "Hello! Can you tell me about AI?"}
      ],
      stream: true,
      temperature: 0.6,
      top_p: 0.9,
      max_completion_tokens: 2000
    }
  },
  {
    model: "Qwen/Qwen3-32B-AWQ",
    endpoint: "http://3.91.251.0:8000/v1/chat/completions", 
    payload: {
      model: "Qwen/Qwen3-32B-AWQ",
      messages: [
        {role: "system", content: "You are a helpful assistant /no_think"},
        {role: "user", content: "Generate a short story about a robot"}
      ],
      stream: true,
      temperature: 0.7,
      top_k: 20,
      top_p: 0.8,
      min_p: 0,
      max_completion_tokens: 2000
    }
  },
  {
    model: "btbtyler09/Devstral-Small-2507-AWQ",
    endpoint: "http://98.87.8.56:8000/v1/chat/completions",
    payload: {
      model: "btbtyler09/Devstral-Small-2507-AWQ",
      messages: [
        {
          role: "system", 
          content: "You are Devstral, a helpful agentic model trained by Mistral AI and using the OpenHands scaffold. You can interact with a computer to solve tasks.\n\n<ROLE>\nYour primary role is to assist users by executing commands, modifying code, and solving technical problems effectively. You should be thorough, methodical, and prioritize quality over speed.\n* If the user asks a question, like \"why is X happening\", don't try to fix the problem. Just give an answer to the question.\n</ROLE>"
        },
        {role: "user", content: "Give me the python code for hello world"}
      ],
      stream: true,
      max_completion_tokens: 100
    }
  },
  {
    model: "meta-llama/llama-3.3-70b-instruct",
    endpoint: "http://34.207.103.140:8000/v1/chat/completions", // Same endpoint for now
    payload: {
      model: "meta-llama/llama-3.3-70b-instruct", 
      messages: [
        {role: "system", content: "You are a helpful assistant"},
        {role: "user", content: "What is machine learning?"}
      ],
      stream: true,
      temperature: 0.6,
      top_p: 0.9,
      max_completion_tokens: 2000
    }
  }
];

async function testModel(config) {
  console.log(`\n🧪 Testing ${config.model}...`);
  console.log(`📡 Endpoint: ${config.endpoint}`);
  
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config.payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ${config.model}: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText}`);
      return false;
    }

    console.log(`✅ ${config.model}: Connected successfully`);
    
    // Test streaming
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let chunks = 0;
    let content = '';
    
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
              console.log(`🎉 ${config.model}: Stream completed in ${Date.now() - startTime}ms`);
              console.log(`📊 ${config.model}: Received ${chunks} chunks, ${content.length} characters`);
              console.log(`📝 ${config.model}: Sample: "${content.substring(0, 100)}..."`);
              return true;
            }
            
            if (trimmedLine.startsWith('data: ')) {
              try {
                const jsonData = trimmedLine.slice(6);
                const chunk = JSON.parse(jsonData);
                const deltaContent = chunk.choices?.[0]?.delta?.content;
                
                if (deltaContent) {
                  chunks++;
                  content += deltaContent;
                  
                  if (chunks === 1) {
                    console.log(`📨 ${config.model}: First chunk received`);
                  }
                  
                  // Stop after getting some content to avoid long responses
                  if (content.length > 200) {
                    console.log(`⏹️  ${config.model}: Stopping after 200 characters`);
                    reader.cancel();
                    console.log(`✅ ${config.model}: Streaming works! Got ${chunks} chunks`);
                    return true;
                  }
                }
              } catch (parseError) {
                // Ignore parse errors for test
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
    
    return chunks > 0;
    
  } catch (error) {
    console.error(`❌ ${config.model}: Connection failed`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing all 4 model endpoints with streaming...\n');
  
  const results = {};
  
  for (const config of testConfigs) {
    const success = await testModel(config);
    results[config.model] = success;
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📋 Test Results:');
  console.log('================');
  
  for (const [model, success] of Object.entries(results)) {
    const status = success ? '✅ WORKING' : '❌ FAILED';
    console.log(`${status} ${model}`);
  }
  
  const workingCount = Object.values(results).filter(Boolean).length;
  console.log(`\n🎯 ${workingCount}/4 models working`);
  
  if (workingCount === 4) {
    console.log('🎉 All models are working with streaming!');
    process.exit(0);
  } else {
    console.log('⚠️  Some models need attention');
    process.exit(1);
  }
}

runTests().catch(console.error);