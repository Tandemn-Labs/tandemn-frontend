import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-key-for-dev-only-12345';
const ALGORITHM = 'aes-256-cbc';

// Ensure key is exactly 32 bytes
const KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

export interface EncryptedData {
  iv: string;
  authTag: string;
  data: string;
}

/**
 * Encrypt sensitive data using AES-256-CBC
 */
export function encrypt(text: string): EncryptedData {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Generate auth tag using HMAC for integrity
  const authTag = crypto.createHmac('sha256', KEY).update(encrypted).digest('hex');
  
  return {
    iv: iv.toString('hex'),
    authTag: authTag,
    data: encrypted,
  };
}

/**
 * Decrypt sensitive data using AES-256-CBC
 */
export function decrypt(encryptedData: EncryptedData): string {
  // Verify integrity
  const expectedAuthTag = crypto.createHmac('sha256', KEY).update(encryptedData.data).digest('hex');
  if (expectedAuthTag !== encryptedData.authTag) {
    throw new Error('Data integrity check failed');
  }
  
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  
  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Create a user-specific encryption key based on their user ID
 */
export function getUserKey(userId: string): Buffer {
  return crypto.createHash('sha256').update(`${ENCRYPTION_KEY}-${userId}`).digest();
}

/**
 * Encrypt data with user-specific key
 */
export function encryptForUser(text: string, userId: string): EncryptedData {
  const userKey = getUserKey(userId);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, userKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Generate auth tag using HMAC with user key
  const authTag = crypto.createHmac('sha256', userKey).update(encrypted).digest('hex');
  
  return {
    iv: iv.toString('hex'),
    authTag: authTag,
    data: encrypted,
  };
}

/**
 * Decrypt data with user-specific key
 */
export function decryptForUser(encryptedData: EncryptedData, userId: string): string {
  const userKey = getUserKey(userId);
  
  // Verify integrity with user key
  const expectedAuthTag = crypto.createHmac('sha256', userKey).update(encryptedData.data).digest('hex');
  if (expectedAuthTag !== encryptedData.authTag) {
    throw new Error('Data integrity check failed or wrong user');
  }
  
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, userKey, iv);
  
  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Hash sensitive data for indexing (one-way hash)
 */
export function hashForIndex(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}