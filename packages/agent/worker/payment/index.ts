import Stripe from 'stripe';

export class PaymentService {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-09-30.clover',
    });
  }

  /**
   * Create a payment intent for one-time payment
   */
  async createPaymentIntent(params: {
    amount: number; // Amount in cents
    currency?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    const { amount, currency = 'jpy', metadata } = params;

    return await this.stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  /**
   * Create a checkout session
   */
  async createCheckoutSession(params: {
    lineItems: Array<{
      price_data: {
        currency: string;
        product_data: {
          name: string;
          description?: string;
          images?: string[];
        };
        unit_amount: number;
      };
      quantity: number;
    }>;
    mode: 'payment' | 'subscription';
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.create({
      line_items: params.lineItems,
      mode: params.mode,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });
  }

  /**
   * Create a customer
   */
  async createCustomer(params: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    return await this.stripe.customers.create(params);
  }

  /**
   * Create a product
   */
  async createProduct(params: {
    name: string;
    description?: string;
    images?: string[];
    metadata?: Record<string, string>;
  }): Promise<Stripe.Product> {
    return await this.stripe.products.create(params);
  }

  /**
   * Create a price for a product
   */
  async createPrice(params: {
    product: string;
    unit_amount: number;
    currency?: string;
    recurring?: {
      interval: 'day' | 'week' | 'month' | 'year';
      interval_count?: number;
    };
  }): Promise<Stripe.Price> {
    const { currency = 'jpy', ...rest } = params;
    return await this.stripe.prices.create({
      ...rest,
      currency,
    });
  }

  /**
   * Create a subscription
   */
  async createSubscription(params: {
    customer: string;
    items: Array<{ price: string; quantity?: number }>;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.create(params);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Retrieve a checkout session
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.retrieve(sessionId);
  }

  /**
   * List all customers
   */
  async listCustomers(params?: {
    limit?: number;
    starting_after?: string;
  }): Promise<Stripe.ApiList<Stripe.Customer>> {
    return await this.stripe.customers.list(params);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  /**
   * Process a refund
   */
  async createRefund(params: {
    payment_intent: string;
    amount?: number;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  }): Promise<Stripe.Refund> {
    return await this.stripe.refunds.create(params);
  }
}

export function createPaymentService(secretKey: string): PaymentService {
  return new PaymentService(secretKey);
}
