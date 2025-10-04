import type {
  AgentSession,
  ConversationMessage,
  McpServer,
  McpServerTag,
  Prisma,
  User
} from '@agent/database';

export type AgentLinkWithServer = Prisma.AgentMcpLinkGetPayload<{
  include: {
    server: { include: { tags: true } };
  };
}>;

export type SessionWithMessages = Prisma.AgentSessionGetPayload<{
  include: {
    messages: true;
  };
}>;

const serializeDates = <T extends { createdAt: Date; updatedAt?: Date | null }>(entity: T) => ({
  createdAt: entity.createdAt.toISOString(),
  updatedAt: (entity as { updatedAt?: Date | null }).updatedAt
    ? ((entity as { updatedAt?: Date | null }).updatedAt as Date).toISOString()
    : undefined,
});

export const serializeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  ...serializeDates(user),
});

export const serializeMcpServer = (server: McpServer & { tags: McpServerTag[] }) => ({
  id: server.id,
  name: server.name,
  url: server.url,
  description: server.description,
  ownerUserId: server.ownerUserId,
  status: server.status,
  authType: server.authType,
  tags: server.tags.map((tag) => tag.tag),
  ...serializeDates(server),
});

export const serializeAgentLink = (link: AgentLinkWithServer) => ({
  id: link.id,
  userId: link.userId,
  mcpServerId: link.mcpServerId,
  enabled: link.enabled,
  config: link.configJson ? JSON.parse(link.configJson) : null,
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString(),
  server: serializeMcpServer(link.server),
});

export const serializeSession = (session: AgentSession) => ({
  id: session.id,
  userId: session.userId,
  graphState: JSON.parse(session.graphState),
  checkpoint: session.checkpoint ? JSON.parse(session.checkpoint) : null,
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(),
});

export const serializeConversationMessage = (message: ConversationMessage) => ({
  id: message.id,
  sessionId: message.sessionId,
  role: message.role,
  content: message.content,
  metadata: message.metadata ? JSON.parse(message.metadata) : null,
  createdAt: message.createdAt.toISOString(),
});

export const serializeSessionWithMessages = (session: SessionWithMessages) => ({
  session: serializeSession(session),
  messages: session.messages
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(serializeConversationMessage),
});
