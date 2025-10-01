// Type definitions for the application

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface Service {
  id: string;
  name: string;
  type: 'BOOKING' | 'ECOMMERCE' | 'FORM';
  description?: string;
  config?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images: string[];
  isActive: boolean;
  serviceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  stripePaymentId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Form {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  isActive: boolean;
  serviceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, any>;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  config?: Record<string, any>;
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  completedAt?: string;
  userId: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
}
