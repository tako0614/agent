import { Context } from 'hono';

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
 * Execute a tool call by routing to the appropriate MCP endpoint
 */
export async function executeToolCall(
  c: Context,
  toolCall: ToolCall
): Promise<ToolResult> {
  try {
    switch (toolCall.name) {
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

async function executeBookingTool(
  c: Context,
  params: any
): Promise<ToolResult> {
  const { action, serviceId, date, slotId, customerName, customerEmail, customerPhone, notes, bookingId } = params;

  switch (action) {
    case 'list_slots': {
      // [PUBLIC] List available booking slots
      const query = new URLSearchParams();
      if (serviceId) query.set('serviceId', serviceId);
      if (date) query.set('date', date);

      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/booking/available-slots?${query}`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'create': {
      // [PUBLIC] Create a booking (user makes reservation)
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/booking/create`,
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
        `${c.req.url.split('/api')[0]}/mcp/tools/booking/${bookingId}`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'cancel': {
      // [PUBLIC] Cancel a booking
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/booking/${bookingId}/cancel`,
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
      // [ADMIN] Create a booking service
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/booking/service/create`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          },
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
      // [ADMIN] List all bookings for a service
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/booking/service/${serviceId}/bookings`,
        {
          headers: {
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          }
        }
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
        `${c.req.url.split('/api')[0]}/mcp/tools/product/search?${searchQuery}`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'list': {
      // [PUBLIC] List all products
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/product/list`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'get': {
      // [PUBLIC] Get product details
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/product/${productId}`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'create': {
      // [ADMIN] Create a product
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/product/create`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          },
          body: JSON.stringify({ name, description, price, stock, images }),
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'update': {
      // [ADMIN] Update a product
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/product/${productId}`,
        {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          },
          body: JSON.stringify({ name, description, price, stock }),
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'delete': {
      // [ADMIN] Delete a product
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/product/${productId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          }
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
  const { action, userId, orderId, items, shippingAddress, status, trackingNumber } = params;

  switch (action) {
    case 'create': {
      // [PUBLIC] Create an order (user purchases)
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/order/create`,
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
        `${c.req.url.split('/api')[0]}/mcp/tools/order/${orderId}`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'list_user': {
      // [PUBLIC] List user's orders
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/order/user/${userId}/orders`
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'cancel': {
      // [PUBLIC] Cancel an order
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/order/${orderId}/cancel`,
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
      // [ADMIN] List all orders
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/order/list`,
        {
          headers: {
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          }
        }
      );
      const data = await response.json();
      return { success: true, data };
    }

    case 'update_status': {
      // [ADMIN] Update order status
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/order/${orderId}/status`,
        {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          },
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
  const { action, formId, name, description, fields, settings, data, submitterName, submitterEmail } = params;

  switch (action) {
    case 'get': {
      // [PUBLIC] Get form details for rendering
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/form/${formId}`
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    case 'submit': {
      // [PUBLIC] Submit a form response
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/form/${formId}/submit`,
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
      // [ADMIN] Create a form
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/form/create`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          },
          body: JSON.stringify({ name, description, fields, settings }),
        }
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    case 'list': {
      // [ADMIN] List all forms
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/form/list`,
        {
          headers: {
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          }
        }
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    case 'list_submissions': {
      // [ADMIN] List form submissions
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/form/${formId}/submissions`,
        {
          headers: {
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          }
        }
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    case 'update': {
      // [ADMIN] Update a form
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/form/${formId}`,
        {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          },
          body: JSON.stringify({ name, description, fields, settings }),
        }
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    case 'delete': {
      // [ADMIN] Delete a form
      const response = await fetch(
        `${c.req.url.split('/api')[0]}/mcp/tools/form/${formId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${c.env.MCP_API_KEY || ''}`
          }
        }
      );
      const responseData = await response.json();
      return { success: true, data: responseData };
    }

    default:
      return { success: false, error: `Unknown form action: ${action}` };
  }
}
