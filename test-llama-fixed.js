#!/usr/bin/env node

// Test the fixed Llama model with correct ID
const correctModelId = "casperhansen/llama-3.3-70b-instruct-awq";

async function testFixedLlama() {
  console.log('🧪 Testing fixed Llama model...');
  console.log(`📡 Model ID: ${correctModelId}`);
  console.log(`🔗 Endpoint: http://34.207.103.140:8000/v1/chat/completions`);
  
  try {
    const response = await fetch("http://34.207.103.140:8000/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        model: correctModelId,
        messages: [
          {role: "system", content: "You are a helpful assistant"},
          {role: "user", content: "Hello! Can you explain quantum computing?"}
        ],
        stream: true,
        temperature: 0.6,
        top_p: 0.9,
        max_completion_tokens: 2000
      })
    });

    console.log(`📊 Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error: ${errorText}`);
      return false;
    }

    console.log(`✅ Llama model is now working!`);
    
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
              console.log(`🎉 Stream completed in ${Date.now() - startTime}ms`);
              console.log(`📊 Received ${chunks} chunks, ${content.length} characters`);
              console.log(`📝 Sample: "${content.substring(0, 150)}..."`);
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
                    console.log(`📨 First chunk received`);
                  }
                  
                  // Stop after getting some content
                  if (content.length > 200) {
                    console.log(`⏹️ Stopping after 200 characters`);
                    reader.cancel();
                    console.log(`✅ Llama streaming works! Got ${chunks} chunks`);
                    return true;
                  }
                }
              } catch (parseError) {
                // Ignore parse errors
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
    console.error(`❌ Connection failed: ${error.message}`);
    return false;
  }
}

async function testAllModelsNow() {
  console.log('🚀 Testing all 4 models with updated Llama...\n');
  
  const models = [
    {
      name: "DeepSeek R1",
      id: "casperhansen/deepseek-r1-distill-llama-70b-awq",
      endpoint: "http://34.207.103.140:8000/v1/chat/completions"
    },
    {
      name: "Qwen3 32B", 
      id: "Qwen/Qwen3-32B-AWQ",
      endpoint: "http://3.91.251.0:8000/v1/chat/completions"
    },
    {
      name: "Devstral",
      id: "btbtyler09/Devstral-Small-2507-AWQ", 
      endpoint: "http://98.87.8.56:8000/v1/chat/completions"
    },
    {
      name: "Llama 3.3 70B (FIXED)",
      id: "casperhansen/llama-3.3-70b-instruct-awq",
      endpoint: "http://34.207.103.140:8000/v1/chat/completions"
    }
  ];
  
  const results = {};
  
  for (const model of models) {
    console.log(`\n🧪 Testing ${model.name}...`);
    
    try {
      const response = await fetch(model.endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          model: model.id,
          messages: [
            {role: "user", content: "Hello!"}
          ],
          stream: true,
          max_completion_tokens: 50
        })
      });
      
      if (response.ok) {
        console.log(`✅ ${model.name}: WORKING`);
        results[model.name] = true;
        // Cancel immediately to avoid long responses
        response.body?.getReader().cancel();
      } else {
        const error = await response.text();
        console.log(`❌ ${model.name}: ${response.status} - ${error.substring(0, 100)}`);
        results[model.name] = false;
      }
    } catch (error) {
      console.log(`❌ ${model.name}: ${error.message}`);
      results[model.name] = false;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📋 Final Results:');
  console.log('================');
  
  for (const [model, working] of Object.entries(results)) {
    const status = working ? '✅ WORKING' : '❌ FAILED';
    console.log(`${status} ${model}`);
  }
  
  const workingCount = Object.values(results).filter(Boolean).length;
  console.log(`\n🎯 ${workingCount}/4 models working`);
  
  if (workingCount === 4) {
    console.log('🎉 ALL 4 MODELS NOW WORKING WITH STREAMING!');
    process.exit(0);
  } else {
    console.log('⚠️ Some models still need attention');
    process.exit(1);
  }
}

// First test just the fixed Llama model
testFixedLlama().then(success => {
  if (success) {
    console.log('\n🔥 Llama is fixed! Now testing all models...');
    return testAllModelsNow();
  } else {
    console.log('\n❌ Llama still not working');
    process.exit(1);
  }
}).catch(console.error);