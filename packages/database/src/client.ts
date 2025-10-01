import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Function to create Prisma client with optional connection string for Workers
export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const connectionString = databaseUrl || process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  // Use adapter for Cloudflare Workers or other edge environments
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  // @ts-ignore - adapter support
  return new PrismaClient({ adapter });
}

// Default instance for Node.js environment
let prisma: PrismaClient | undefined;

if (typeof process !== 'undefined' && process.env.DATABASE_URL) {
  prisma = globalThis.__prisma || new PrismaClient();
  if (process.env.NODE_ENV === 'development') {
    globalThis.__prisma = prisma;
  }
}

export { prisma };
export * from '@prisma/client';
