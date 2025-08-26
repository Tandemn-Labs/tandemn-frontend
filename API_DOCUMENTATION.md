# API Documentation

## Overview

Our API provides programmatic access to AI models with a simple credit-based pricing system:
- **Standard API calls**: 1 credit per request
- **Batch requests**: 2 credits per request (add `?batch=1` to URL)

## Authentication

All API requests require an API key. Generate your API key from the dashboard at `/keys`.

```bash
Authorization: Bearer YOUR_API_KEY
```

## Generate API Key

### Via Dashboard
1. Sign in to your account
2. Navigate to `/keys`
3. Click "Generate Key" and provide a name
4. Copy the generated key (it won't be shown again)

### Via cURL (authenticated users only)
```bash
curl -X POST https://yourdomain.com/api/keys \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json" \
  -d '{"name": "My API Key"}'
```

## Chat Completion API

### Endpoint
```
POST /api/v1/chat
```

### Standard Request (1 credit)
```bash
curl -X POST https://yourdomain.com/api/v1/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "groq/gemma-groq-416",
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ],
    "max_tokens": 150
  }'
```

### Batch Request (2 credits)
```bash
curl -X POST https://yourdomain.com/api/v1/chat?batch=1 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "groq/gemma-groq-416",
    "messages": [
      {"role": "user", "content": "Process this batch request"}
    ],
    "max_tokens": 150
  }'
```

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model ID (e.g., "groq/gemma-groq-416") |
| `messages` | array | Yes | Array of message objects |
| `max_tokens` | integer | No | Maximum tokens to generate (default: 150) |
| `batch` | query param | No | Set to "1" for batch processing (2 credits) |

## Response Format

### Success Response
```json
{
  "id": "chatcmpl-1234567890",
  "object": "chat.completion",
  "created": 1699999999,
  "model": "groq/gemma-groq-416",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  },
  "credits_charged": 1,
  "credits_remaining": 99,
  "batch_request": false
}
```

### Error Responses

#### Invalid API Key (401)
```json
{
  "error": "Invalid API key"
}
```

#### Insufficient Credits (402)
```json
{
  "error": "Insufficient credits. Required: 1, Available: 0",
  "credits_required": 1,
  "credits_available": 0
}
```

#### Model Not Found (404)
```json
{
  "error": "Model 'invalid-model' not found"
}
```

#### Invalid Request (400)
```json
{
  "error": "Missing required fields: model and messages array"
}
```

## Available Models

Get the list of available models:

```bash
curl -X GET https://yourdomain.com/api/models
```

Popular models include:
- `groq/gemma-groq-416` - Fast and efficient
- `mistral/mistral-large-135` - Large context window
- `openai/gpt-4` - High quality responses
- `anthropic/claude-3-sonnet` - Balanced performance

## Credit Management

### Check Credit Balance
Your credit balance and remaining credits are included in each API response.

### Purchase Credits
Visit the dashboard to purchase additional credits. Credits are priced at $1 = 1 credit.

### Credit Packages
- $5 = 5 credits
- $10 = 10 credits  
- $25 = 25 credits + 2.5 bonus (10% bonus)
- $50 = 50 credits + 7.5 bonus (15% bonus)
- $100 = 100 credits + 20 bonus (20% bonus)

## Rate Limits

- 60 requests per minute per IP address
- No concurrent request limits per API key

## Support

For API support, visit the dashboard or contact support through the web interface.

## SDKs and Libraries

### Python Example
```python
import requests

headers = {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
}

data = {
    'model': 'groq/gemma-groq-416',
    'messages': [
        {'role': 'user', 'content': 'Hello!'}
    ]
}

response = requests.post('https://yourdomain.com/api/v1/chat', 
                        headers=headers, json=data)
print(response.json())
```

### JavaScript/Node.js Example
```javascript
const response = await fetch('https://yourdomain.com/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'groq/gemma-groq-416',
    messages: [
      { role: 'user', content: 'Hello!' }
    ]
  })
});

const data = await response.json();
console.log(data);
```

## Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid API key)
- `402` - Payment Required (insufficient credits)
- `404` - Not Found (invalid model)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error