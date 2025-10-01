import { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import {
  AccountError,
  extractSessionTokenFromAuthHeader,
  getAccountProfile,
  loginAccount,
  logoutAccount,
  registerAccount,
  updateAccount,
  deleteAccount as removeAccount,
} from '../services/account';

export interface ToolCall {
  name: string;
  params: any;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Get MCP Server URL from environment
 */
function getMcpServerUrl(c: Context): string {
  return c.env.MCP_SERVER_URL || 'http://localhost:8788';
}

/**
 * Get MCP token for authenticated requests
 */
async function getMcpToken(c: Context): Promise<string | null> {
  // Get session from cookie
  const cookie = c.req.header('Cookie');
  if (!cookie) return null;
  
  const sessionMatch = cookie.match(/session=([^;]+)/);
  if (!sessionMatch) return null;
  
  // Request MCP token from auth endpoint
  try {
    const response = await fetch(
      `${c.req.url.split('/api')[0]}/auth/mcp-token`,
      {
        headers: {
          'Cookie': `session=${sessionMatch[1]}`
        }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json() as { token?: string };
    return data.token || null;
  } catch {
    return null;
  }
}

/**
 * Execute a tool call by routing to the external MCP server
 */
export async function executeToolCall(
  c: Context,
  toolCall: ToolCall
): Promise<ToolResult> {
  try {
    switch (toolCall.name) {
      case 'account_tool':
        return await executeAccountTool(c, toolCall.params);
      
      case 'booking_tool':
        return await executeBookingTool(c, toolCall.params);
      
      case 'product_tool':
        return await executeProductTool(c, toolCall.params);
      
      case 'order_tool':
        return await executeOrderTool(c, toolCall.params);
      
      case 'form_tool':
        return await executeFormTool(c, toolCall.params);
      
      default:
        return {
          success: false,
          error: `Unknown tool: ${toolCall.name}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function executeAccountTool(
  c: Context,
  params: any
): Promise<ToolResult> {
  const { action, email, name, password, sessionToken } = params;

  const isSecureRequest = () => new URL(c.req.url).protocol === 'https:';

  const setSessionCookie = (token: string) => {
    setCookie(c, 'session', token, {
      httpOnly: true,
      secure: isSecureRequest(),
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
  };

  const clearSessionCookie = () => {
    deleteCookie(c, 'session', {
      httpOnly: true,
      secure: isSecureRequest(),
      sameSite: 'Lax',
      path: '/',
    });
  };

  const resolveSessionToken = () => {
    if (sessionToken) {
      return sessionToken as string;
    }

    const headerToken = extractSessionTokenFromAuthHeader(
      c.req.header('Authorization')
    );
    if (headerToken) {
      return headerToken;
    }

    const cookieToken = getCookie(c, 'session');
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  };

  try {
    switch (action) {
      case 'register': {
        const result = await registerAccount({ email, name, password });
        setSessionCookie(result.sessionToken);
        return {
          success: true,
          data: {
            user: result.account,
            sessionToken: result.sessionToken,
            message: result.message,
          },
        };
      }

      case 'login': {
        const result = await loginAccount({ email, password });
        setSessionCookie(result.sessionToken);
        return {
          success: true,
          data: {
            user: result.account,
            sessionToken: result.sessionToken,
            message: result.message,
          },
        };
      }

      case 'get_profile': {
        const token = resolveSessionToken();
        if (!token) {
          throw new AccountError('Authentication required', 401);
        }

        const profile = await getAccountProfile(token);
        return { success: true, data: profile };
      }

      case 'update': {
        const token = resolveSessionToken();
        if (!token) {
          throw new AccountError('Authentication required', 401);
        }

        const result = await updateAccount(token, { name, email });
        setSessionCookie(result.sessionToken);
        return {
          success: true,
          data: {
            user: result.account,
            sessionToken: result.sessionToken,
            message: result.message,
          },
        };
      }

      case 'delete': {
        const token = resolveSessionToken();
        if (!token) {
          throw new AccountError('Authentication required', 401);
        }

        const result = await removeAccount(token);
        clearSessionCookie();
        return {
          success: true,
          data: { message: result.message },
        };
      }

      case 'logout': {
        const result = await logoutAccount();
        clearSessionCookie();
        return {
          success: true,
          data: { message: result.message },
        };
      }

      default:
        return { success: false, error: `Unknown account action: ${action}` };
    }
  } catch (error) {
    if (error instanceof AccountError) {
      return { success: false, error: error.message };
    }

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return { success: false, error: 'Unknown error' };
  }
}

async function executeBookingTool(
  c: Context,
  params: any
): Promise<ToolResult> {
  const mcpServerUrl = getMcpServerUrl(c);
  const mcpToken = await getMcpToken(c);
  const { action, serviceId, date, slotId, customerName, customerEmail, customerPhone, notes, bookingId } = params;

  switch (action) {
    case 'list_slots': {
      // [PUBLIC] List available booking slots
      const query = new URLSearchParams();
      if (serviceId) query.set('serviceId', serviceId);
      if (date) query.set('date', date);

      const response = await fetch(
        `${mcpServerUrl}/tools/booking/available-slots?${query}`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'create': {
      // [PUBLIC] Create a booking (user makes reservation)
      const response = await fetch(
        `${mcpServerUrl}/tools/booking/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            serviceId, 
            slotId,
            date, 
            customerName, 
            customerEmail,
            customerPhone,
            notes
          }),
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'get': {
      // [PUBLIC] Get booking details
      const response = await fetch(
        `${mcpServerUrl}/tools/booking/${bookingId}`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'cancel': {
      // [PUBLIC] Cancel a booking
      const response = await fetch(
        `${mcpServerUrl}/tools/booking/${bookingId}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: params.reason }),
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'create_service': {
      // [ADMIN] Create a booking service - requires authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/booking/service/create`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            name: params.serviceName,
            description: params.serviceDescription,
            duration: params.duration,
            price: params.price
          }),
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'list_all': {
      // [ADMIN] List all bookings for a service - requires authentication
      const headers: Record<string, string> = {};
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/booking/service/${serviceId}/bookings`,
        { headers }
      );
      const data = await response.json();
      return { success: true, data };
    }

    default:
      return { success: false, error: `Unknown booking action: ${action}` };
  }
}

async function executeProductTool(
  c: Context,
  params: any
): Promise<ToolResult> {
  const mcpServerUrl = getMcpServerUrl(c);
  const mcpToken = await getMcpToken(c);
  const { action, query, category, minPrice, maxPrice, productId, name, description, price, stock, images } = params;

  switch (action) {
    case 'search': {
      // [PUBLIC] Search products
      const searchQuery = new URLSearchParams();
      if (query) searchQuery.set('q', query);
      if (category) searchQuery.set('category', category);
      if (minPrice) searchQuery.set('minPrice', minPrice.toString());
      if (maxPrice) searchQuery.set('maxPrice', maxPrice.toString());

      const response = await fetch(
        `${mcpServerUrl}/tools/product/search?${searchQuery}`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'list': {
      // [PUBLIC] List all products
      const response = await fetch(
        `${mcpServerUrl}/tools/product/list`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'get': {
      // [PUBLIC] Get product details
      const response = await fetch(
        `${mcpServerUrl}/tools/product/${productId}`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'create': {
      // [ADMIN] Create a product - requires authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/product/create`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ name, description, price, stock, images }),
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'update': {
      // [ADMIN] Update a product - requires authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/product/${productId}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({ name, description, price, stock }),
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'delete': {
      // [ADMIN] Delete a product - requires authentication
      const headers: Record<string, string> = {};
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/product/${productId}`,
        {
          method: 'DELETE',
          headers
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    default:
      return { success: false, error: `Unknown product action: ${action}` };
  }
}

async function executeOrderTool(c: Context, params: any): Promise<ToolResult> {
  const mcpServerUrl = getMcpServerUrl(c);
  const mcpToken = await getMcpToken(c);
  const { action, userId, orderId, items, shippingAddress, status, trackingNumber } = params;

  switch (action) {
    case 'create': {
      // [PUBLIC] Create an order (user purchases)
      const response = await fetch(
        `${mcpServerUrl}/tools/order/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, items, shippingAddress }),
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'get': {
      // [PUBLIC] Get order details
      const response = await fetch(
        `${mcpServerUrl}/tools/order/${orderId}`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'list_user': {
      // [PUBLIC] List user's orders
      const response = await fetch(
        `${mcpServerUrl}/tools/order/user/${userId}/orders`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'cancel': {
      // [PUBLIC] Cancel an order
      const response = await fetch(
        `${mcpServerUrl}/tools/order/${orderId}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: params.reason }),
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'list_all': {
      // [ADMIN] List all orders - requires authentication
      const headers: Record<string, string> = {};
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/order/list`,
        { headers }
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'update_status': {
      // [ADMIN] Update order status - requires authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/order/${orderId}/status`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({ status, trackingNumber, notes: params.notes }),
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    default:
      return { success: false, error: `Unknown order action: ${action}` };
  }
}

async function executeFormTool(c: Context, params: any): Promise<ToolResult> {
  const mcpServerUrl = getMcpServerUrl(c);
  const mcpToken = await getMcpToken(c);
  const { action, formId, name, description, fields, settings, data, submitterName, submitterEmail } = params;

  switch (action) {
    case 'get': {
      // [PUBLIC] Get form details for rendering
      const response = await fetch(
        `${mcpServerUrl}/tools/form/${formId}`
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    case 'submit': {
      // [PUBLIC] Submit a form response
      const response = await fetch(
        `${mcpServerUrl}/tools/form/${formId}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, submitterName, submitterEmail }),
        }
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    case 'create': {
      // [ADMIN] Create a form - requires authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/form/create`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ name, description, fields, settings }),
        }
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    case 'list': {
      // [ADMIN] List all forms - requires authentication
      const headers: Record<string, string> = {};
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/form/list`,
        { headers }
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    case 'list_submissions': {
      // [ADMIN] List form submissions - requires authentication
      const headers: Record<string, string> = {};
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/form/${formId}/submissions`,
        { headers }
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    case 'update': {
      // [ADMIN] Update a form - requires authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/form/${formId}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({ name, description, fields, settings }),
        }
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    case 'delete': {
      // [ADMIN] Delete a form - requires authentication
      const headers: Record<string, string> = {};
      if (mcpToken) {
        headers['Authorization'] = `Bearer ${mcpToken}`;
      }
      
      const response = await fetch(
        `${mcpServerUrl}/tools/form/${formId}`,
        {
          method: 'DELETE',
          headers
        }
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    default:
      return { success: false, error: `Unknown form action: ${action}` };
  }
}
