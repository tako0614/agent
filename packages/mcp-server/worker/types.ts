import type { PrismaClient } from '@prisma/client';

export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  MCP_ISSUER: string;
  ALLOWED_ORIGINS?: string;
  BUILTIN_MCP_SERVERS?: string;
};

export type AuthContext = {
  userId: string | null;
  scopes: string[];
  token: string;
};

export type AppVariables = {
  prisma: PrismaClient;
  requestId: string;
  auth?: AuthContext;
};
