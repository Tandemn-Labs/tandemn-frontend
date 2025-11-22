/**
 * Cluster Routing Middleware
 * 
 * Handles routing of API requests to the appropriate cluster based on CLI session tokens
 */

import { NextRequest } from 'next/server';
import { getClustersForSession, getDefaultCluster, routeRequestToCluster } from '@/lib/cli-session';
import { DEFAULT_CLUSTER } from '@/config/clusters';

/**
 * Extract cluster information from request
 * Checks for CLI session token in X-Tandemn-Session header
 * and X-Tandemn-Target-Cluster for explicit cluster selection
 * 
 * @param request - Next.js request object
 * @returns Cluster ID or default cluster
 */
export async function getRequestCluster(request: NextRequest): Promise<string> {
  try {
    // Check for CLI session token in custom header
    const sessionToken = request.headers.get('X-Tandemn-Session');
    
    if (sessionToken) {
      const sessionClusters = await getClustersForSession(sessionToken);
      
      if (sessionClusters && sessionClusters.length > 0) {
        // Check for explicit target cluster header
        const targetCluster = request.headers.get('X-Tandemn-Target-Cluster');
        
        if (targetCluster) {
          // Validate that the target cluster is in the session's allowed clusters
          if (sessionClusters.includes(targetCluster)) {
            return targetCluster;
          } else {
            console.warn(`Target cluster '${targetCluster}' not in session clusters: ${sessionClusters.join(', ')}`);
            // Fall through to default logic
          }
        }
        
        // No target cluster specified, use default logic
        // Prefer non-Tandemn clusters, fall back to Tandemn if it's the only option
        return getDefaultCluster(sessionClusters);
      }
    }

    // If no valid session token, return default cluster
    return DEFAULT_CLUSTER;
  } catch (error) {
    console.error('Error determining request cluster:', error);
    return DEFAULT_CLUSTER;
  }
}

/**
 * Check if request should be routed to a different cluster
 * 
 * @param request - Next.js request object
 * @returns Object with routing decision and cluster info
 */
export async function shouldRouteToCluster(request: NextRequest): Promise<{
  shouldRoute: boolean;
  cluster: string;
  targetUrl?: string;
}> {
  const cluster = await getRequestCluster(request);
  
  // If not default cluster, we should route
  if (cluster !== DEFAULT_CLUSTER) {
    return {
      shouldRoute: true,
      cluster,
    };
  }

  return {
    shouldRoute: false,
    cluster: DEFAULT_CLUSTER,
  };
}

/**
 * Build the target URL for proxying a request to a cluster
 * 
 * @param request - Next.js request object
 * @param cluster - Target cluster ID
 * @returns Full URL to proxy the request to
 */
export function buildClusterProxyUrl(request: NextRequest, cluster: string): string {
  // Extract the API endpoint path from the request URL
  const url = new URL(request.url);
  const apiPath = url.pathname;
  
  // Build full URL including query parameters
  const targetUrl = routeRequestToCluster(cluster, apiPath);
  
  // Add query parameters if present
  if (url.search) {
    return `${targetUrl}${url.search}`;
  }
  
  return targetUrl;
}

/**
 * Proxy a request to the appropriate cluster
 * This function forwards the request to the cluster's endpoint
 * 
 * @param request - Next.js request object
 * @param cluster - Target cluster ID
 * @returns Response from the cluster
 */
export async function proxyToCluster(
  request: NextRequest,
  cluster: string
): Promise<Response> {
  try {
    const targetUrl = buildClusterProxyUrl(request, cluster);
    
    // Copy headers from original request
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      // Skip headers that shouldn't be forwarded
      if (!['host', 'x-tandemn-session', 'connection'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });
    
    // Add custom header to indicate this is a routed request
    headers.set('X-Routed-From', 'Tandemn-Gateway');
    headers.set('X-Source-Cluster', DEFAULT_CLUSTER);
    headers.set('X-Target-Cluster', cluster);
    
    // Forward the request to the target cluster
    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.body ? await request.text() : undefined,
    });
    
    return proxyResponse;
  } catch (error) {
    console.error('Error proxying to cluster:', error);
    throw error;
  }
}

/**
 * Middleware helper to check and route requests based on cluster
 * Use this in API routes that need cluster-aware routing
 * 
 * @param request - Next.js request object
 * @returns null if no routing needed, or Response if routed to cluster
 */
export async function handleClusterRouting(
  request: NextRequest
): Promise<Response | null> {
  const routingDecision = await shouldRouteToCluster(request);
  
  if (routingDecision.shouldRoute) {
    console.log(`Routing request to ${routingDecision.cluster} cluster`);
    return await proxyToCluster(request, routingDecision.cluster);
  }
  
  return null;
}

/**
 * Get cluster information for logging/monitoring
 * 
 * @param request - Next.js request object
 * @returns Cluster information object
 */
export async function getClusterInfo(request: NextRequest): Promise<{
  cluster: string;
  isCliSession: boolean;
  sessionToken?: string;
}> {
  const sessionToken = request.headers.get('X-Tandemn-Session');
  const cluster = await getRequestCluster(request);
  
  return {
    cluster,
    isCliSession: !!sessionToken,
    sessionToken: sessionToken || undefined,
  };
}

