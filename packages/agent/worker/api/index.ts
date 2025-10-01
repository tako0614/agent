import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAIAgent } from '../ai';
import { executeToolCall } from '../ai/tools';
import { determineMode, executeChatMode, executeAgentMode } from '../ai/modes';
import type { AgentMode } from '../ai/modes';
import account from './account';
import { createPaymentService } from '../payment';

type Bindings = {
  OPENAI_API_KEY?: string;
  DATABASE_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS
app.use('/*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount account management API
app.route('/account', account);

// Conversations API
app.post('/conversations', async (c) => {
  // Create a new conversation
  const body = await c.req.json();
  // TODO: Integrate with database
  return c.json({ id: 'conv_' + Date.now(), userId: body.userId });
});

app.get('/conversations/:id', async (c) => {
  const id = c.req.param('id');
  // TODO: Get conversation from database
  return c.json({ id, messages: [] });
});

// Messages API
app.post('/conversations/:id/messages', async (c) => {
  const conversationId = c.req.param('id');
  const body = await c.req.json() as {
    content: string;
    history?: Array<{ role: string; content: string }>;
    mode?: AgentMode;
  };
  
  const apiKey = c.env.OPENAI_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'OpenAI API key not configured' }, 500);
  }
  
  try {
    const conversationHistory = body.history || [];
    let mode = body.mode || 'auto';
    
    // Auto mode: determine the appropriate mode
    if (mode === 'auto') {
      mode = await determineMode(body.content, apiKey);
      console.log('[Auto Mode] Determined mode:', mode);
    }
    
    // Execute based on mode
    if (mode === 'agent') {
      // Agent mode: create plan and execute
      const result = await executeAgentMode(
        body.content,
        conversationHistory,
        apiKey,
        (toolCall) => executeToolCall(c, toolCall)
      );
      
      return c.json({
        id: 'msg_' + Date.now(),
        conversationId,
        role: 'assistant',
        content: result.response,
        mode: 'agent',
        planSteps: result.planSteps,
        currentStep: result.currentStep,
        toolCalls: result.toolCalls,
        createdAt: new Date().toISOString()
      });
    } else {
      // Chat mode: simple conversation
      const response = await executeChatMode(
        body.content,
        conversationHistory,
        apiKey
      );
      
      return c.json({
        id: 'msg_' + Date.now(),
        conversationId,
        role: 'assistant',
        content: response,
        mode: 'chat',
        createdAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error processing message:', error);
    return c.json({
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Streaming Messages API
app.post('/conversations/:id/messages/stream', async (c) => {
  const body = await c.req.json() as {
    content: string;
    history?: Array<{ role: string; content: string }>;
  };
  
  const apiKey = c.env.OPENAI_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'OpenAI API key not configured' }, 500);
  }
  
  try {
    const agent = createAIAgent(apiKey);
    const conversationHistory = body.history || [];
    
    const stream = await agent.streamResponse(conversationHistory, body.content);
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error streaming message:', error);
    return c.json({
      error: 'Failed to stream message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Services API
app.get('/services', async (c) => {
  // TODO: Get services from database
  return c.json({ services: [] });
});

app.post('/services', async (c) => {
  const body = await c.req.json();
  // TODO: Create service in database
  return c.json({ id: 'srv_' + Date.now(), ...body });
});

app.get('/services/:id', async (c) => {
  const id = c.req.param('id');
  // TODO: Get service from database
  return c.json({ id, type: 'BOOKING' });
});

// Bookings API
app.get('/services/:serviceId/bookings', async (c) => {
  const serviceId = c.req.param('serviceId');
  // TODO: Get bookings from database
  return c.json({ bookings: [] });
});

app.post('/services/:serviceId/bookings', async (c) => {
  const serviceId = c.req.param('serviceId');
  const body = await c.req.json();
  // TODO: Create booking in database
  return c.json({ id: 'bkg_' + Date.now(), serviceId, ...body });
});

// Products API
app.get('/services/:serviceId/products', async (c) => {
  const serviceId = c.req.param('serviceId');
  // TODO: Get products from database
  return c.json({ products: [] });
});

app.post('/services/:serviceId/products', async (c) => {
  const serviceId = c.req.param('serviceId');
  const body = await c.req.json();
  // TODO: Create product in database
  return c.json({ id: 'prd_' + Date.now(), serviceId, ...body });
});

// Orders API
app.get('/orders', async (c) => {
  // TODO: Get orders from database
  return c.json({ orders: [] });
});

app.post('/orders', async (c) => {
  const body = await c.req.json() as {
    productId: string;
    quantity: number;
    userId: string;
  };
  
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json({ error: 'Stripe API key not configured' }, 500);
  }
  
  try {
    const paymentService = createPaymentService(stripeKey);
    
    // TODO: Get product details from database
    const productPrice = 1000; // Placeholder price in yen
    const amount = productPrice * body.quantity;
    
    // Create payment intent
    const paymentIntent = await paymentService.createPaymentIntent({
      amount,
      currency: 'jpy',
      metadata: {
        productId: body.productId,
        quantity: body.quantity.toString(),
        userId: body.userId,
      },
    });
    
    // TODO: Create order in database
    
    return c.json({
      id: 'ord_' + Date.now(),
      orderNumber: 'ORD-' + Date.now(),
      status: 'PENDING',
      amount,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      ...body
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return c.json({
      error: 'Failed to create order',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/orders/:id', async (c) => {
  const id = c.req.param('id');
  // TODO: Get order from database
  return c.json({ id, status: 'PENDING' });
});

// Forms API
app.get('/services/:serviceId/forms', async (c) => {
  const serviceId = c.req.param('serviceId');
  // TODO: Get forms from database
  return c.json({ forms: [] });
});

app.post('/services/:serviceId/forms', async (c) => {
  const serviceId = c.req.param('serviceId');
  const body = await c.req.json();
  // TODO: Create form in database
  return c.json({ id: 'frm_' + Date.now(), serviceId, ...body });
});

app.post('/forms/:formId/submissions', async (c) => {
  const formId = c.req.param('formId');
  const body = await c.req.json();
  // TODO: Save form submission to database
  return c.json({ id: 'sub_' + Date.now(), formId, ...body });
});

// Stripe Webhooks
app.post('/webhooks/stripe', async (c) => {
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json({ error: 'Stripe API key not configured' }, 500);
  }

  try {
    const signature = c.req.header('stripe-signature');
    if (!signature) {
      return c.json({ error: 'No signature provided' }, 400);
    }

    const rawBody = await c.req.text();
    const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET || '';
    
    const paymentService = createPaymentService(stripeKey);
    const event = paymentService.verifyWebhookSignature(
      rawBody,
      signature,
      webhookSecret
    );

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('PaymentIntent succeeded:', paymentIntent.id);
        // TODO: Update order status in database
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log('PaymentIntent failed:', paymentIntent.id);
        // TODO: Update order status in database
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('Checkout session completed:', session.id);
        // TODO: Fulfill the order
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('Subscription event:', event.type, subscription.id);
        // TODO: Update subscription status in database
        break;
      }
      default:
        console.log('Unhandled event type:', event.type);
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

// Payment API endpoints
app.post('/checkout/session', async (c) => {
  const body = await c.req.json() as {
    items: Array<{
      productId: string;
      name: string;
      description?: string;
      price: number;
      quantity: number;
    }>;
    successUrl: string;
    cancelUrl: string;
  };

  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json({ error: 'Stripe API key not configured' }, 500);
  }

  try {
    const paymentService = createPaymentService(stripeKey);

    const lineItems = body.items.map(item => ({
      price_data: {
        currency: 'jpy',
        product_data: {
          name: item.name,
          description: item.description,
        },
        unit_amount: item.price,
      },
      quantity: item.quantity,
    }));

    const session = await paymentService.createCheckoutSession({
      lineItems,
      mode: 'payment',
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });

    return c.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return c.json({
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/checkout/session/:id', async (c) => {
  const sessionId = c.req.param('id');
  
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json({ error: 'Stripe API key not configured' }, 500);
  }

  try {
    const paymentService = createPaymentService(stripeKey);
    const session = await paymentService.getCheckoutSession(sessionId);

    return c.json({
      id: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_email,
      amountTotal: session.amount_total,
    });
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    return c.json({
      error: 'Failed to retrieve checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
