/**
 * Deployment Status Utility Functions
 * Helper functions for checking model deployment status
 */

export interface DeploymentInfo {
  model_name: string;
  status: string;
}

export interface DeploymentsResponse {
  deployments: DeploymentInfo[];
  timestamp?: string;
  error?: string;
}

/**
 * Fetch deployment status from the API
 * @returns Promise with array of deployment information
 */
export async function fetchDeployments(): Promise<DeploymentInfo[]> {
  try {
    const response = await fetch('/api/deployments');
    
    if (!response.ok) {
      console.error(`Deployments API returned ${response.status}`);
      return [];
    }

    const data: DeploymentsResponse = await response.json();
    
    if (data.error) {
      console.warn('Deployment API error:', data.error);
    }
    
    return data.deployments || [];
  } catch (error) {
    console.error('Failed to fetch deployments:', error);
    return [];
  }
}

/**
 * Check if a specific model is deployed
 * @param modelId - The model identifier to check
 * @param deployments - Array of deployment information
 * @returns true if the model is deployed and ready
 */
export function isModelDeployed(
  modelId: string, 
  deployments: DeploymentInfo[]
): boolean {
  const deployment = deployments.find(d => d.model_name === modelId);
  
  if (!deployment) {
    return false;
  }
  
  // Consider model deployed if status is "ready"
  return deployment.status === 'ready';
}

/**
 * Get the deployment status for a specific model
 * @param modelId - The model identifier
 * @param deployments - Array of deployment information
 * @returns Status string or "not-deployed" if not found
 */
export function getDeploymentStatus(
  modelId: string, 
  deployments: DeploymentInfo[]
): string {
  const deployment = deployments.find(d => d.model_name === modelId);
  return deployment?.status || 'not-deployed';
}

/**
 * Get a set of deployed model IDs for quick lookup
 * @param deployments - Array of deployment information
 * @returns Set of model IDs that are deployed and ready
 */
export function getDeployedModelIds(deployments: DeploymentInfo[]): Set<string> {
  return new Set(
    deployments
      .filter(d => d.status === 'ready')
      .map(d => d.model_name)
  );
}

/**
 * Filter a list of models to only include deployed ones
 * @param models - Array of model objects with an 'id' property
 * @param deployments - Array of deployment information
 * @returns Filtered array of deployed models
 */
export function filterDeployedModels<T extends { id: string }>(
  models: T[],
  deployments: DeploymentInfo[]
): T[] {
  const deployedIds = getDeployedModelIds(deployments);
  return models.filter(model => deployedIds.has(model.id));
}

