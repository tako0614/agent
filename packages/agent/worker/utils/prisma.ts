import { PrismaClient } from '@prisma/client/edge';

let prismaSingleton: PrismaClient | undefined;

export const getPrisma = (databaseUrl: string): PrismaClient => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient({
      datasourceUrl: databaseUrl,
    });
  }

  return prismaSingleton;
};
