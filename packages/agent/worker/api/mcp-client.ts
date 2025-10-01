/**
 * MCP Server API Client
 * Handles API calls to MCP Server with automatic token refresh
 */

export interface McpClientConfig {
  baseUrl: string;
  clientId: string;
  tokenEndpoint: string;
}

export interface McpToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class McpClient {
  private config: McpClientConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefresh?: (accessToken: string, refreshToken: string) => void;

  constructor(config: McpClientConfig) {
    this.config = config;
  }

  /**
   * Set tokens for API calls
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * Set callback for token refresh
   * This callback is called when tokens are refreshed
   */
  onTokenRefreshed(callback: (accessToken: string, refreshToken: string) => void): void {
    this.onTokenRefresh = callback;
  }

  /**
   * Call MCP tool with automatic token refresh on 401
   */
  async callTool<T = any>(
    tool: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<McpToolResponse<T>> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please call setTokens() first.');
    }

    // First attempt with current access token
    let response = await this.makeRequest(tool, method, body, this.accessToken);

    // If 401 Unauthorized, try to refresh token
    if (response.status === 401 && this.refreshToken) {
      try {
        const { accessToken, refreshToken } = await this.refreshAccessToken(this.refreshToken);
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;

        // Notify caller about token refresh
        if (this.onTokenRefresh) {
          this.onTokenRefresh(accessToken, refreshToken);
        }

        // Retry with new access token
        response = await this.makeRequest(tool, method, body, accessToken);
      } catch (refreshError) {
        return {
          success: false,
          error: 'Authentication failed. Please login again.',
        };
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  }

  /**
   * Make HTTP request to MCP Server
   */
  private async makeRequest(
    tool: string,
    method: string,
    body: any,
    accessToken: string
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(`${this.config.baseUrl}/mcp/tools/${tool}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }

    const tokens = await response.json();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  }

  // ========================================
  // Convenience methods for specific tools
  // ========================================

  /**
   * Booking tools
   */
  async listBookings() {
    return this.callTool('booking/list', 'GET');
  }

  async createBooking(data: {
    serviceId: string;
    startTime: string;
    endTime: string;
    customerName: string;
    customerEmail: string;
  }) {
    return this.callTool('booking/create', 'POST', data);
  }

  async cancelBooking(bookingId: string) {
    return this.callTool('booking/cancel', 'POST', { bookingId });
  }

  /**
   * Product tools
   */
  async listProducts() {
    return this.callTool('product/list', 'GET');
  }

  async getProduct(productId: string) {
    return this.callTool('product/get', 'GET', { productId });
  }

  /**
   * Order tools
   */
  async listOrders() {
    return this.callTool('order/list', 'GET');
  }

  async createOrder(data: {
    items: Array<{ productId: string; quantity: number }>;
    shippingAddress: string;
  }) {
    return this.callTool('order/create', 'POST', data);
  }

  async cancelOrder(orderId: string) {
    return this.callTool('order/cancel', 'POST', { orderId });
  }

  /**
   * Form tools
   */
  async listForms() {
    return this.callTool('form/list', 'GET');
  }

  async submitForm(formId: string, data: Record<string, any>) {
    return this.callTool('form/submit', 'POST', { formId, data });
  }
}

/**
 * Create MCP client from environment variables
 */
export function createMcpClient(env: {
  MCP_SERVER_URL: string;
  OAUTH_CLIENT_ID: string;
}): McpClient {
  return new McpClient({
    baseUrl: env.MCP_SERVER_URL,
    clientId: env.OAUTH_CLIENT_ID,
    tokenEndpoint: `${env.MCP_SERVER_URL}/oauth/token`,
  });
}
