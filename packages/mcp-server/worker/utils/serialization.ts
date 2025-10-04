import type { McpAuthType, McpStatus, Prisma } from '@agent/database';

export type McpServerWithTags = Prisma.McpServerGetPayload<{ include: { tags: true } }>;

export type SerializedMcpServer = {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  ownerUserId?: string | null;
  status: McpStatus;
  authType: McpAuthType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export const serializeMcpServer = (server: McpServerWithTags): SerializedMcpServer => ({
  id: server.id,
  name: server.name,
  url: server.url,
  description: server.description,
  ownerUserId: server.ownerUserId,
  status: server.status as McpStatus,
  authType: server.authType as McpAuthType,
  tags: server.tags.map((tag) => tag.tag),
  createdAt: server.createdAt.toISOString(),
  updatedAt: server.updatedAt.toISOString(),
});
