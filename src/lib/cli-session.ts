import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';
import dbConnect from '@/lib/database';
import CLISession from '@/lib/models/CLISession';
import { getClusterUrl, isValidCluster } from '@/config/clusters';

// JWT secret for CLI sessions
const CLI_SESSION_SECRET = new TextEncoder().encode(
  process.env.CLI_SESSION_SECRET || process.env.BETTER_AUTH_SECRET || 'tandemn-cli-secret-key'
);

// Session expiration time (30 days in seconds)
const SESSION_EXPIRATION_DAYS = 30;
const SESSION_EXPIRATION_SECONDS = SESSION_EXPIRATION_DAYS * 24 * 60 * 60;

export interface CLISessionPayload {
  type: 'cli-session';
  userId: string;
  clerkUserId: string;
  apiKeyId: string;
  cluster: string;
  iat: number;
  exp: number;
}

/**
 * Create a new CLI session token
 * @param userId - MongoDB UserAccount _id
 * @param clerkUserId - Clerk user ID
 * @param apiKeyId - API key ID
 * @param cluster - Selected cluster
 * @returns JWT session token
 */
export async function createCliSessionToken(
  userId: string,
  clerkUserId: string,
  apiKeyId: string,
  cluster: string
): Promise<{ token: string; expiresAt: Date }> {
  if (!isValidCluster(cluster)) {
    throw new Error(`Invalid cluster: ${cluster}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + SESSION_EXPIRATION_SECONDS) * 1000);

  // Create JWT token
  const token = await new SignJWT({
    type: 'cli-session',
    userId,
    clerkUserId,
    apiKeyId,
    cluster,
  } as Omit<CLISessionPayload, 'iat' | 'exp'>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_EXPIRATION_SECONDS)
    .sign(CLI_SESSION_SECRET);

  // Store session in database
  await dbConnect();
  
  // Hash the token for storage (security best practice)
  const tokenHash = createHash('sha256').update(token).digest('hex');

  // Delete any existing sessions for this API key
  await CLISession.deleteMany({ apiKeyId });

  // Create new session
  await CLISession.create({
    sessionToken: tokenHash,
    apiKeyId,
    userId,
    clerkUserId,
    selectedCluster: cluster,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Validate and decode a CLI session token
 * @param token - JWT session token
 * @returns Session payload or null if invalid
 */
export async function validateCliSession(
  token: string
): Promise<CLISessionPayload | null> {
  try {
    // Verify JWT signature and expiration
    const { payload } = await jwtVerify(token, CLI_SESSION_SECRET);

    // Check payload structure
    if (
      payload.type !== 'cli-session' ||
      !payload.userId ||
      !payload.clerkUserId ||
      !payload.apiKeyId ||
      !payload.cluster
    ) {
      return null;
    }

    // Check if session exists in database
    await dbConnect();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    
    const session = await CLISession.findOne({
      sessionToken: tokenHash,
      expiresAt: { $gt: new Date() }, // Not expired
    });

    if (!session) {
      return null;
    }

    return payload as unknown as CLISessionPayload;
  } catch (error) {
    console.error('Error validating CLI session:', error);
    return null;
  }
}

/**
 * Get the selected cluster for a session token
 * @param token - JWT session token
 * @returns Cluster ID or null if invalid
 */
export async function getClusterForSession(token: string): Promise<string | null> {
  const session = await validateCliSession(token);
  return session?.cluster || null;
}

/**
 * Route a request to the appropriate cluster
 * @param cluster - Cluster ID
 * @param endpoint - API endpoint path (e.g., '/v1/chat/completions')
 * @returns Full URL to the cluster endpoint
 */
export function routeRequestToCluster(cluster: string, endpoint: string): string {
  const baseUrl = getClusterUrl(cluster);
  
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Remove trailing slash from base URL if present
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  return `${normalizedBaseUrl}${normalizedEndpoint}`;
}

/**
 * Invalidate a CLI session
 * @param token - JWT session token
 * @returns true if session was invalidated
 */
export async function invalidateCliSession(token: string): Promise<boolean> {
  try {
    await dbConnect();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    
    const result = await CLISession.deleteOne({ sessionToken: tokenHash });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error invalidating CLI session:', error);
    return false;
  }
}

/**
 * Clean up expired sessions (can be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    await dbConnect();
    const result = await CLISession.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return 0;
  }
}

/**
 * Get all active sessions for a user
 * @param userId - MongoDB UserAccount _id
 * @returns Array of active sessions
 */
export async function getUserSessions(userId: string): Promise<Array<{
  cluster: string;
  expiresAt: Date;
  createdAt: Date;
}>> {
  try {
    await dbConnect();
    const sessions = await CLISession.find({
      userId,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    return sessions.map(s => ({
      cluster: s.selectedCluster,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    }));
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return [];
  }
}

