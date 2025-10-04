import { PrismaClient } from '@prisma/client';

let prismaSingleton: PrismaClient | undefined;

export const getPrisma = (databaseUrl: string): PrismaClient => {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient({
      datasources: {
        db: { url: databaseUrl },
      },
    });
  }

  return prismaSingleton;
};
