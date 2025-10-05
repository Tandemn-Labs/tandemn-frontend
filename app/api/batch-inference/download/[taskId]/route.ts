import { NextRequest, NextResponse } from 'next/server';

const BATCH_INFERENCE_BASE_URL = 'http://98.80.0.197:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    console.log('Requesting download for task:', taskId);

    // First, get the task status to get the final file path
    const statusResponse = await fetch(`${BATCH_INFERENCE_BASE_URL}/batch_task_status/${taskId}`, {
      method: 'GET',
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Task status check error:', {
        taskId,
        status: statusResponse.status,
        statusText: statusResponse.statusText,
        body: errorText
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to check task status',
          details: errorText,
          status: statusResponse.status
        },
        { status: statusResponse.status }
      );
    }

    const taskStatus = await statusResponse.json();
    
    // Check if task is completed
    if (taskStatus.status !== 'completed') {
      return NextResponse.json(
        { error: 'Task is not completed yet' },
        { status: 400 }
      );
    }

    console.log('Task completed, waiting for S3 upload before attempting download for:', taskId);

    // Add a delay to allow S3 upload to complete
    const initialDelay = 5000; // 5 seconds initial delay
    const maxRetries = 6; // Maximum number of retry attempts
    const retryDelay = 2000; // 2 seconds between retries
    
    // Wait for initial delay
    await new Promise(resolve => setTimeout(resolve, initialDelay));
    
    // Use the specific backend endpoint that returns signed S3 URLs
    const endpoint = `${BATCH_INFERENCE_BASE_URL}/get_results/${taskId}`;
    console.log(`Getting results from: ${endpoint}`);
    
    let lastError: any = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Download attempt ${attempt + 1}/${maxRetries + 1} for task: ${taskId}`);
        
        const response = await fetch(endpoint, { method: 'GET' });
        
        if (response.ok) {
          // Success! Break out of retry loop
          const data = await response.json();
          console.log('Got response from backend:', data);
          
          // Extract the signed URL and filename
          const downloadUrl = data.download_url;
          const fileName = data.filename || `batch_results_${taskId}.csv`;
          
          if (!downloadUrl) {
            return NextResponse.json(
              { 
                error: 'No download URL provided by backend',
                details: 'Backend response missing download_url field',
                taskId: taskId,
                backendResponse: data
              },
              { status: 500 }
            );
          }

          // Download the file from the signed S3 URL
          console.log('Downloading from S3 signed URL:', downloadUrl);
          const s3Response = await fetch(downloadUrl);
          
          if (!s3Response.ok) {
            throw new Error(`S3 download failed: ${s3Response.status} ${s3Response.statusText}`);
          }

          const fileBuffer = await s3Response.arrayBuffer();
          console.log(`Successfully downloaded file: ${fileName} (${fileBuffer.byteLength} bytes)`);
          
          // Return the file as a download
          return new NextResponse(fileBuffer, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${fileName}"`,
              'Content-Length': fileBuffer.byteLength.toString(),
            },
          });
        }
        
        // Handle 404 specifically - file not ready yet
        if (response.status === 404) {
          const errorText = await response.text();
          lastError = {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          };
          
          console.log(`File not ready yet (attempt ${attempt + 1}/${maxRetries + 1}): ${errorText}`);
          
          // If this is not the last attempt, wait and retry
          if (attempt < maxRetries) {
            console.log(`Waiting ${retryDelay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        } else {
          // Other errors - don't retry
          const errorText = await response.text();
          console.error('Backend endpoint error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          
          return NextResponse.json(
            { 
              error: 'Failed to get results from backend',
              details: `Backend returned ${response.status}: ${errorText}`,
              taskId: taskId,
              endpoint: endpoint
            },
            { status: response.status }
          );
        }
      } catch (error) {
        lastError = error;
        console.error(`Download attempt ${attempt + 1} failed:`, error);
        
        // If this is not the last attempt, wait and retry
        if (attempt < maxRetries) {
          console.log(`Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
      }
    }
    
    // All retries exhausted
    console.error('All download attempts failed. Last error:', lastError);
    
    return NextResponse.json(
      { 
        error: 'Failed to get results from backend after multiple attempts',
        details: lastError ? `Last error: ${JSON.stringify(lastError)}` : 'Unknown error',
        taskId: taskId,
        endpoint: endpoint,
        attempts: maxRetries + 1
      },
      { status: 404 }
    );

  } catch (error) {
    console.error('Error downloading results:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'Cannot connect to batch inference server',
          details: 'The batch inference server at 98.80.0.197:8000 is not responding. Please check if the server is running.'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
