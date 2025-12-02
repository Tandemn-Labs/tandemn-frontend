#!/bin/bash

# Test script for CLI job submission endpoint
# Usage: ./test-cli-job-submit.sh YOUR_API_KEY

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if API key is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: API key is required${NC}"
    echo "Usage: ./test-cli-job-submit.sh YOUR_API_KEY"
    exit 1
fi

API_KEY="$1"
BASE_URL="${2:-http://localhost:3000}"

echo -e "${BLUE}=== Testing CLI Job Submission Endpoint ===${NC}\n"

# Step 1: Login to get available clusters
echo -e "${BLUE}Step 1: Login with API key${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/cli/login" \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\": \"${API_KEY}\"}")

echo "$LOGIN_RESPONSE" | jq '.'

# Check if login was successful
SUCCESS=$(echo "$LOGIN_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" != "true" ]; then
    echo -e "${RED}Login failed. Please check your API key.${NC}"
    exit 1
fi

# Extract available clusters
CLUSTERS=$(echo "$LOGIN_RESPONSE" | jq -r '.clusters[].id' | tr '\n' ' ')
echo -e "${GREEN}Available clusters: ${CLUSTERS}${NC}\n"

# Step 2: Select cluster(s) to get session token
CLUSTER_ARRAY=$(echo "$LOGIN_RESPONSE" | jq -c '[.clusters[].id]')
echo -e "${BLUE}Step 2: Select clusters and get session token${NC}"
SESSION_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/cli/select-cluster" \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\": \"${API_KEY}\", \"clusters\": ${CLUSTER_ARRAY}}")

echo "$SESSION_RESPONSE" | jq '.'

# Extract session token
SESSION_TOKEN=$(echo "$SESSION_RESPONSE" | jq -r '.session_token')
if [ "$SESSION_TOKEN" == "null" ] || [ -z "$SESSION_TOKEN" ]; then
    echo -e "${RED}Failed to get session token.${NC}"
    exit 1
fi

echo -e "${GREEN}Session token obtained!${NC}\n"

# Step 3: Submit a batched inference job
echo -e "${BLUE}Step 3: Submit batched inference job${NC}"
JOB_SUBMIT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/cli/jobs/submit" \
  -H "Authorization: Bearer ${SESSION_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "task_mode": "batched_inference",
    "model_name": "llama-70b-hf",
    "backend": "vllm",
    "quantization": "awq",
    "dataset_path": "s3://tandemn-user-data/test-dataset.csv",
    "column_names": ["prompt", "response"],
    "slo": "2h",
    "generation_kwargs": {
      "max_tokens": 100,
      "temperature": 0.7
    }
  }')

echo "$JOB_SUBMIT_RESPONSE" | jq '.'

# Check if job submission was successful
JOB_STATUS=$(echo "$JOB_SUBMIT_RESPONSE" | jq -r '.status')
if [ "$JOB_STATUS" == "success" ]; then
    JOB_ID=$(echo "$JOB_SUBMIT_RESPONSE" | jq -r '.job_id')
    APP_QUEUE_KEY=$(echo "$JOB_SUBMIT_RESPONSE" | jq -r '.application_queue_key')
    echo -e "${GREEN}✅ Job submitted successfully!${NC}"
    echo -e "${GREEN}Job ID: ${JOB_ID}${NC}"
    echo -e "${GREEN}Application Queue Key: ${APP_QUEUE_KEY}${NC}\n"
else
    echo -e "${RED}❌ Job submission failed${NC}\n"
fi

# Step 4: Submit an online inference job (minimal parameters)
echo -e "${BLUE}Step 4: Submit online inference job (minimal params)${NC}"
ONLINE_JOB_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/cli/jobs/submit" \
  -H "Authorization: Bearer ${SESSION_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "task_mode": "online_inference",
    "model_name": "llama-8b-instruct",
    "backend": "vllm"
  }')

echo "$ONLINE_JOB_RESPONSE" | jq '.'

ONLINE_JOB_STATUS=$(echo "$ONLINE_JOB_RESPONSE" | jq -r '.status')
if [ "$ONLINE_JOB_STATUS" == "success" ]; then
    ONLINE_JOB_ID=$(echo "$ONLINE_JOB_RESPONSE" | jq -r '.job_id')
    echo -e "${GREEN}✅ Online inference job submitted successfully!${NC}"
    echo -e "${GREEN}Job ID: ${ONLINE_JOB_ID}${NC}\n"
else
    echo -e "${RED}❌ Online job submission failed${NC}\n"
fi

# Step 5: Test error case - invalid task mode
echo -e "${BLUE}Step 5: Test error handling (invalid task_mode)${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/cli/jobs/submit" \
  -H "Authorization: Bearer ${SESSION_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "task_mode": "invalid_mode",
    "model_name": "llama-70b-hf"
  }')

echo "$ERROR_RESPONSE" | jq '.'
echo ""

# Step 6: Test authentication error
echo -e "${BLUE}Step 6: Test authentication error (invalid token)${NC}"
AUTH_ERROR_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/cli/jobs/submit" \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{
    "task_mode": "batched_inference",
    "model_name": "llama-70b-hf"
  }')

echo "$AUTH_ERROR_RESPONSE" | jq '.'
echo ""

echo -e "\n${GREEN}=== Test Complete ===${NC}"
echo -e "${YELLOW}Note: These tests require a running central orchestrator server.${NC}"
echo -e "${YELLOW}If you see 'Central server connection failed' errors, make sure:${NC}"
echo -e "${YELLOW}  1. CENTRAL_SERVER_URL is set in .env${NC}"
echo -e "${YELLOW}  2. The central orchestrator server is running${NC}"


