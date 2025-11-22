# Cluster Routing Integration Guide

This document explains how to integrate cluster routing into existing API endpoints.

## Overview

The cluster routing system allows CLI users to select a cluster (Tandemn, HAL, DELTA) and have their API requests automatically routed to the appropriate data center.

## How It Works

1. CLI user authenticates with API key via `/api/cli/login`
2. User selects a cluster via `/api/cli/select-cluster` and receives a session token
3. User includes session token in `X-Tandemn-Session` header on subsequent requests
4. API routes check for the session token and route to the appropriate cluster

## Integration Steps

### Step 1: Import Cluster Routing Helper

```typescript
import { handleClusterRouting, getClusterInfo } from '@/lib/cluster-routing';
```

### Step 2: Add Routing Logic at the Start of Your API Route

Add this at the beginning of your API route handler, right after CORS/OPTIONS handling:

```typescript
export async function POST(request: NextRequest) {
  try {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: corsHeaders });
    }

    // CHECK FOR CLUSTER ROUTING - Add this
    const routedResponse = await handleClusterRouting(request);
    if (routedResponse) {
      return routedResponse;
    }

    // Continue with normal request handling
    // ... rest of your existing code
  }
}
```

### Step 3: (Optional) Add Cluster Logging

For monitoring and debugging, you can log which cluster handled the request:

```typescript
// Get cluster info for logging
const clusterInfo = await getClusterInfo(request);
console.log(`Request handled by ${clusterInfo.cluster} cluster`);
```

## Example Integration

Here's a complete example for `/api/v1/chat/completions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { handleClusterRouting, getClusterInfo } from '@/lib/cluster-routing';
// ... other imports

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    // CLUSTER ROUTING - Check if request should be routed to another cluster
    const routedResponse = await handleClusterRouting(request);
    if (routedResponse) {
      return routedResponse;
    }

    // Log cluster info for monitoring (optional)
    const clusterInfo = await getClusterInfo(request);
    console.log(`Processing request on ${clusterInfo.cluster} cluster`);

    // Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    // ... rest of existing code
  }
}
```

## Routes That Should Have Cluster Routing

The following routes should integrate cluster routing:

- [x] `/app/api/v1/chat/route.ts` - Example integration below
- [ ] `/app/api/v1/chat/completions/route.ts` 
- [ ] `/app/api/v1/external-chat/route.ts`
- [ ] `/app/api/v1/balance/route.ts`
- [ ] `/app/api/v1/models/route.ts`
- [ ] `/app/api/batch-inference/route.ts`

## CLI Usage Example

Once integrated, CLI users can use cluster routing like this:

```bash
# 1. Login with API key
curl -X POST https://api.tandemn.com/api/cli/login \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "gk-xxx"}'

# Returns: { clusters: ["Tandemn", "HAL"], ... }

# 2. Select cluster and get session token
curl -X POST https://api.tandemn.com/api/cli/select-cluster \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "gk-xxx", "cluster": "HAL"}'

# Returns: { sessionToken: "eyJ...", cluster: "HAL", ... }

# 3. Make API calls with session token
curl -X POST https://api.tandemn.com/api/v1/chat/completions \
  -H "Authorization: Bearer gk-xxx" \
  -H "X-Tandemn-Session: eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"model": "...", "messages": [...]}'

# Request is automatically routed to HAL cluster
```

## Environment Setup

Make sure to add cluster URLs to your `.env.local`:

```env
# Cluster Base URLs
CLUSTER_TANDEMN_URL=https://api.tandemn.com
CLUSTER_HAL_URL=https://hal.ncsa.illinois.edu
CLUSTER_DELTA_URL=https://delta.ncsa.illinois.edu

# CLI Session Secret (optional, defaults to BETTER_AUTH_SECRET)
CLI_SESSION_SECRET=your-secure-random-secret-here
```

## Security Considerations

1. Session tokens are JWT tokens signed with `CLI_SESSION_SECRET`
2. Session tokens are also stored in MongoDB for validation
3. Tokens expire after 30 days by default
4. Users can only access clusters they have permission for
5. Cluster permissions are managed via admin endpoints or scripts

## Admin Management

Grant cluster access to users:

```bash
# Add HAL access to a specific user
npx tsx scripts/manage-user-clusters.ts add user_xxx HAL

# Grant multiple clusters to all illinois.edu users
npx tsx scripts/manage-user-clusters.ts bulk-domain illinois.edu Tandemn HAL DELTA
```

Or via API:

```bash
# Add cluster access
curl -X POST https://api.tandemn.com/api/admin/user-clusters \
  -H "Authorization: Bearer <admin-session>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_xxx", "cluster": "HAL", "action": "add"}'
```

## Testing

To test cluster routing without a CLI:

```bash
# Login and get session token
SESSION_TOKEN=$(curl -s -X POST http://localhost:3000/api/cli/login \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "gk-xxx"}' | jq -r '.sessionToken')

# Select cluster
curl -X POST http://localhost:3000/api/cli/select-cluster \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\": \"gk-xxx\", \"cluster\": \"HAL\"}"

# Test API call with session
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Authorization: Bearer gk-xxx" \
  -H "X-Tandemn-Session: $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "test", "messages": [{"role": "user", "content": "hello"}]}'
```

