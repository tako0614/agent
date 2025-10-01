// Type definitions for MCP Server

export interface AuthContext {
  type: 'ai-service' | 'mcp-admin';
  userId: string;
  scope: string[];
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
  };
}

export interface McpVariables {
  auth?: AuthContext;
}
