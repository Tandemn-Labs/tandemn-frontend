/**
 * Cluster Configuration
 * 
 * Manages cluster definitions and routing for the Tandemn CLI.
 * Clusters represent different data centers that users can connect to.
 */

export interface Cluster {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
}

/**
 * Get all available cluster definitions from environment variables
 */
export function getClusterDefinitions(): Cluster[] {
  return [
    {
      id: 'Tandemn',
      name: 'Tandemn',
      description: 'Main Tandemn cluster - available to all users',
      baseUrl: process.env.CLUSTER_TANDEMN_URL || 'https://api.tandemn.com',
    },
    {
      id: 'HAL',
      name: 'HAL',
      description: 'HAL cluster at NCSA - restricted access',
      baseUrl: process.env.CLUSTER_HAL_URL || 'https://hal.ncsa.illinois.edu',
    },
    {
      id: 'DELTA',
      name: 'DELTA',
      description: 'DELTA cluster at NCSA - restricted access',
      baseUrl: process.env.CLUSTER_DELTA_URL || 'https://delta.ncsa.illinois.edu',
    },
  ];
}

/**
 * Get the base URL for a specific cluster
 * @param clusterId - The cluster ID (e.g., 'Tandemn', 'HAL', 'DELTA')
 * @returns The base URL for the cluster
 * @throws Error if cluster is not found
 */
export function getClusterUrl(clusterId: string): string {
  const clusters = getClusterDefinitions();
  const cluster = clusters.find(c => c.id === clusterId);
  
  if (!cluster) {
    throw new Error(
      `Unknown cluster: ${clusterId}. Available clusters: ${clusters.map(c => c.id).join(', ')}`
    );
  }
  
  return cluster.baseUrl;
}

/**
 * Check if a cluster ID is valid
 * @param clusterId - The cluster ID to check
 * @returns true if the cluster exists
 */
export function isValidCluster(clusterId: string): boolean {
  const clusters = getClusterDefinitions();
  return clusters.some(c => c.id === clusterId);
}

/**
 * Get all available cluster IDs
 * @returns Array of cluster IDs
 */
export function getAvailableClusterIds(): string[] {
  return getClusterDefinitions().map(c => c.id);
}

/**
 * Get clusters that a user has access to based on their allowed list
 * @param allowedClusters - Array of cluster IDs the user has access to
 * @returns Array of cluster definitions
 */
export function getUserClusters(allowedClusters: string[]): Cluster[] {
  const allClusters = getClusterDefinitions();
  return allClusters.filter(c => allowedClusters.includes(c.id));
}

/**
 * Get the default cluster for all users
 */
export const DEFAULT_CLUSTER = 'Tandemn';

/**
 * Default clusters for new users
 */
export const DEFAULT_USER_CLUSTERS = [DEFAULT_CLUSTER];

