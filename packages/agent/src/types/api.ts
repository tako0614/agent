/**
 * API型定義
 * DETAILED_SPEC.mdのAPI仕様に基づく
 */

// User関連
export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// MCPサーバー関連
export enum McpStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEGRADED = 'DEGRADED',
}

export enum McpAuthType {
  NONE = 'NONE',
  API_KEY = 'API_KEY',
  OAUTH = 'OAUTH',
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  ownerUserId?: string | null;
  status: McpStatus;
  authType: McpAuthType;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ tag: string }>;
}

export interface AgentMcpLink {
  id: string;
  userId: string;
  mcpServerId: string;
  enabled: boolean;
  configJson?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  server?: McpServer;
}

// セッション関連
export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface AgentSession {
  id: string;
  userId: string;
  graphState: Record<string, any>;
  checkpoint?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  messages?: ConversationMessage[];
}

// APIレスポンス型
export interface UserMeResponse {
  user: User;
}

export interface McpLinkedResponse {
  items: AgentMcpLink[];
}

export interface McpSearchRequest {
  query?: string;
  tags?: string[];
  limit?: number;
  cursor?: string;
}

export interface McpSearchResponse {
  items: McpServer[];
  source: 'discovery';
  nextCursor?: string;
}

export interface McpLinkRequest {
  mcpServerId: string;
  config?: Record<string, any>;
}

export interface McpLinkResponse {
  linkId: string;
}

export interface McpUnlinkRequest {
  linkId: string;
  hardDelete?: boolean;
}

export interface McpTestRequest {
  mcpServerId: string;
  tool?: string;
  args?: Record<string, any>;
}

export interface McpTestResponse {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface AgentChatRequest {
  sessionId?: string;
  messages?: ConversationMessage[];
  input: string;
  stream?: boolean;
}

export interface AgentStateResponse {
  session: AgentSession;
  messages: ConversationMessage[];
  graphState: Record<string, any>;
}

export interface AgentInterruptRequest {
  sessionId: string;
  reason?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}
