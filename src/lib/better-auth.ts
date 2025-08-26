import { z } from "zod";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

// Define user schema
const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  image: z.string().optional(),
  credits: z.number().default(0),
  stripeCustomerId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof userSchema>;

// In-memory storage for demo (replace with your database)
const users = new Map<string, User>();
const sessions = new Map<string, { userId: string; expiresAt: Date }>();

// JWT secret (in production, use a secure secret)
const JWT_SECRET = new TextEncoder().encode(
  process.env.BETTER_AUTH_SECRET || "your-secret-key"
);

// Simple authentication class
class SimpleAuth {
  async createUser(data: {
    id: string;
    email: string;
    name?: string;
    image?: string;
  }): Promise<User> {
    const user: User = {
      id: data.id,
      email: data.email,
      name: data.name,
      image: data.image,
      credits: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.set(user.id, user);
    return user;
  }

  async getUser(id: string): Promise<User | null> {
    return users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return Array.from(users.values()).find(u => u.email === email) || null;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    const user = users.get(id);
    if (!user) return null;
    const updatedUser = { ...user, ...data, updatedAt: new Date() };
    users.set(id, updatedUser);
    return updatedUser;
  }

  async createSession(userId: string): Promise<string> {
    const token = await new SignJWT({ userId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(JWT_SECRET);
    
    return token;
  }

  async verifySession(token: string): Promise<{ userId: string } | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      return { userId: payload.userId as string };
    } catch {
      return null;
    }
  }

  async signIn(provider: string, credentials?: any): Promise<{ ok: boolean }> {
    if (provider === "credentials") {
      const { email, password } = credentials;
      
      // Demo credentials for development
      if (email === 'demo@demo.dev' && password === 'demo') {
        let user = await this.getUserByEmail('demo@demo.dev');
        if (!user) {
          user = await this.createUser({
            id: 'demo-user',
            email: 'demo@demo.dev',
            name: 'Demo User',
          });
        }
        return { ok: true };
      }
    }
    
    return { ok: false };
  }

  async signOut(): Promise<void> {
    // In a real implementation, you'd invalidate the session
  }

  // React hooks simulation
  useSession() {
    // This would be implemented with React hooks in a real scenario
    // For now, return a mock session
    return {
      session: {
        user: {
          id: 'demo-user',
          email: 'demo@demo.dev',
          name: 'Demo User',
          credits: 100,
        }
      },
      signOut: this.signOut.bind(this)
    };
  }

  // Server-side session getter
  async getSession(request?: Request): Promise<{ user: User } | null> {
    if (!request) return null;
    
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;
    
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(cookie => {
        const [name, value] = cookie.trim().split('=');
        return [name, value];
      })
    );
    
    const token = cookies['auth-token'];
    if (!token) return null;
    
    const session = await this.verifySession(token);
    if (!session) return null;
    
    const user = await this.getUser(session.userId);
    if (!user) return null;
    
    return { user };
  }
}

export const auth = new SimpleAuth();

// Export types
export type Session = Awaited<ReturnType<typeof auth.getSession>>;
export type AuthConfig = typeof auth;
