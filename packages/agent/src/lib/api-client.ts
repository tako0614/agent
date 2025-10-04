/**
 * APIクライアント
 * packages/agent/worker/index.tsのAPI仕様に対応
 */

import type {
  UserMeResponse,
  McpLinkedResponse,
  McpSearchRequest,
  McpSearchResponse,
  McpLinkRequest,
  McpLinkResponse,
  McpUnlinkRequest,
  McpTestRequest,
  McpTestResponse,
  AgentChatRequest,
  AgentStateResponse,
  AgentInterruptRequest,
  ApiError,
} from '../types/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Cookieを含める
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'Unknown error',
        message: response.statusText,
      })) as ApiError;
      throw new Error(error.message || error.error);
    }

    return response.json();
  }

  // User API
  async getMe(): Promise<UserMeResponse> {
    return this.request<UserMeResponse>('/user/me');
  }

  // MCP API
  async getLinkedMcps(includeDisabled = false): Promise<McpLinkedResponse> {
    const query = includeDisabled ? '?includeDisabled=true' : '';
    return this.request<McpLinkedResponse>(`/mcp/linked${query}`);
  }

  async searchMcps(req: McpSearchRequest): Promise<McpSearchResponse> {
    return this.request<McpSearchResponse>('/mcp/search', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async linkMcp(req: McpLinkRequest): Promise<McpLinkResponse> {
    return this.request<McpLinkResponse>('/mcp/link', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async unlinkMcp(req: McpUnlinkRequest): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>('/mcp/unlink', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async testMcp(req: McpTestRequest): Promise<McpTestResponse> {
    return this.request<McpTestResponse>('/mcp/test', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // Agent API
  async sendChat(req: AgentChatRequest): Promise<any> {
    if (req.stream) {
      // SSE対応は後で実装
      throw new Error('Streaming not yet implemented');
    }
    return this.request<any>('/agent/chat', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async getSessionState(sessionId: string): Promise<AgentStateResponse> {
    return this.request<AgentStateResponse>(`/agent/state/${sessionId}`);
  }

  async interruptSession(req: AgentInterruptRequest): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>('/agent/interrupt', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }
}

export const apiClient = new ApiClient();
