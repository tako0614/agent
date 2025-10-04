import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

let prismaSingleton: PrismaClient | undefined;

export const getPrisma = (d1: D1Database): PrismaClient => {
  if (!d1) {
    throw new Error('D1 database binding is not configured');
  }

  if (!prismaSingleton) {
    const adapter = new PrismaD1(d1);
    // Cast to any since current @prisma/client typings might not include the `adapter` option for D1
    prismaSingleton = new PrismaClient({ adapter } as any);
  }

  return prismaSingleton;
};
