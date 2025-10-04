import type { PrismaClient } from '@prisma/client';

export type Bindings = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  MCP_SERVER_URL: string;
  MCP_SERVICE_TOKEN?: string;
  MCP_ISSUER?: string;
  ALLOWED_ORIGINS?: string;
};

export type AuthContext = {
  userId: string;
  scopes: string[];
  token: string;
};

export type AppVariables = {
  prisma: PrismaClient;
  requestId: string;
  auth?: AuthContext;
};
