// API client utilities

const API_BASE_URL = '/api';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Conversations
  async createConversation(userId: string) {
    return this.request<{ id: string; userId: string }>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async getConversation(conversationId: string) {
    return this.request<any>(`/conversations/${conversationId}`);
  }

  async sendMessage(conversationId: string, content: string) {
    return this.request<{
      id: string;
      conversationId: string;
      role: string;
      content: string;
      createdAt: string;
    }>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Services
  async getServices() {
    return this.request<{ services: any[] }>('/services');
  }

  async createService(data: {
    name: string;
    type: 'BOOKING' | 'ECOMMERCE' | 'FORM';
    description?: string;
    userId: string;
  }) {
    return this.request<any>('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getService(serviceId: string) {
    return this.request<any>(`/services/${serviceId}`);
  }

  // Bookings
  async getBookings(serviceId: string) {
    return this.request<{ bookings: any[] }>(`/services/${serviceId}/bookings`);
  }

  async createBooking(serviceId: string, data: {
    title: string;
    startTime: string;
    endTime: string;
    customerName?: string;
    customerEmail?: string;
  }) {
    return this.request<any>(`/services/${serviceId}/bookings`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Products
  async getProducts(serviceId: string) {
    return this.request<{ products: any[] }>(`/services/${serviceId}/products`);
  }

  async createProduct(serviceId: string, data: {
    name: string;
    price: number;
    description?: string;
    stock?: number;
  }) {
    return this.request<any>(`/services/${serviceId}/products`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Orders
  async getOrders() {
    return this.request<{ orders: any[] }>('/orders');
  }

  async createOrder(data: {
    customerName: string;
    customerEmail: string;
    items: Array<{ productId: string; quantity: number }>;
    userId: string;
  }) {
    return this.request<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOrder(orderId: string) {
    return this.request<any>(`/orders/${orderId}`);
  }

  // Forms
  async getForms(serviceId: string) {
    return this.request<{ forms: any[] }>(`/services/${serviceId}/forms`);
  }

  async createForm(serviceId: string, data: {
    name: string;
    fields: any[];
    description?: string;
  }) {
    return this.request<any>(`/services/${serviceId}/forms`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitForm(formId: string, data: Record<string, any>) {
    return this.request<any>(`/forms/${formId}/submissions`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }
}

export const apiClient = new ApiClient();
