import { prisma } from './client.js';

type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// User services
export const userService = {
  async create(data: { email: string; name?: string }) {
    return prisma.user.create({ data });
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        agents: true,
        tasks: true,
      },
    });
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        agents: true,
        tasks: true,
      },
    });
  },

  async update(id: string, data: { name?: string; email?: string }) {
    return prisma.user.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  },
};

// Agent services
export const agentService = {
  async create(data: {
    name: string;
    description?: string;
    config?: any;
    userId: string;
  }) {
    return prisma.agent.create({ data });
  },

  async findById(id: string) {
    return prisma.agent.findUnique({
      where: { id },
      include: {
        user: true,
        tasks: true,
      },
    });
  },

  async findByUserId(userId: string) {
    return prisma.agent.findMany({
      where: { userId },
      include: {
        tasks: true,
      },
    });
  },

  async update(id: string, data: {
    name?: string;
    description?: string;
    config?: any;
    isActive?: boolean;
  }) {
    return prisma.agent.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.agent.delete({
      where: { id },
    });
  },
};

// Task services
export const taskService = {
  async create(data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: Priority;
    dueDate?: Date;
    userId: string;
    agentId?: string;
  }) {
    return prisma.task.create({ data });
  },

  async findById(id: string) {
    return prisma.task.findUnique({
      where: { id },
      include: {
        user: true,
        agent: true,
      },
    });
  },

  async findByUserId(userId: string) {
    return prisma.task.findMany({
      where: { userId },
      include: {
        agent: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async findByAgentId(agentId: string) {
    return prisma.task.findMany({
      where: { agentId },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async update(id: string, data: {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: Priority;
    dueDate?: Date;
    completedAt?: Date;
    agentId?: string;
  }) {
    return prisma.task.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.task.delete({
      where: { id },
    });
  },

  async markCompleted(id: string) {
    return prisma.task.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  },
};

// Log service
export const logService = {
  async create(data: {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    metadata?: any;
  }) {
    return prisma.log.create({ data });
  },

  async findRecent(limit = 100) {
    return prisma.log.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async findByLevel(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') {
    return prisma.log.findMany({
      where: { level },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },
};

// Service services
export const serviceService = {
  async create(data: {
    name: string;
    type: 'BOOKING' | 'ECOMMERCE' | 'FORM';
    description?: string;
    config?: any;
    userId: string;
  }) {
    return prisma.service.create({ data });
  },

  async findById(id: string) {
    return prisma.service.findUnique({
      where: { id },
      include: {
        user: true,
        bookings: true,
        products: true,
        forms: true,
      },
    });
  },

  async findByUserId(userId: string) {
    return prisma.service.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async update(id: string, data: {
    name?: string;
    description?: string;
    config?: any;
    isActive?: boolean;
  }) {
    return prisma.service.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.service.delete({
      where: { id },
    });
  },
};

// Booking services
export const bookingService = {
  async create(data: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    metadata?: any;
    serviceId: string;
  }) {
    return prisma.booking.create({ data });
  },

  async findById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        service: true,
      },
    });
  },

  async findByServiceId(serviceId: string) {
    return prisma.booking.findMany({
      where: { serviceId },
      orderBy: {
        startTime: 'asc',
      },
    });
  },

  async findByDateRange(serviceId: string, startDate: Date, endDate: Date) {
    return prisma.booking.findMany({
      where: {
        serviceId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  },

  async update(id: string, data: {
    title?: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    metadata?: any;
  }) {
    return prisma.booking.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.booking.delete({
      where: { id },
    });
  },
};

// Product services
export const productService = {
  async create(data: {
    name: string;
    description?: string;
    price: number;
    stock?: number;
    images?: string[];
    metadata?: any;
    serviceId: string;
  }) {
    return prisma.product.create({ data });
  },

  async findById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        service: true,
      },
    });
  },

  async findByServiceId(serviceId: string) {
    return prisma.product.findMany({
      where: { serviceId, isActive: true },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async search(serviceId: string, query: string) {
    return prisma.product.findMany({
      where: {
        serviceId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
    });
  },

  async update(id: string, data: {
    name?: string;
    description?: string;
    price?: number;
    stock?: number;
    images?: string[];
    isActive?: boolean;
    metadata?: any;
  }) {
    return prisma.product.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.product.delete({
      where: { id },
    });
  },
};

// Order services
export const orderService = {
  async create(data: {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    totalAmount: number;
    stripePaymentId?: string;
    metadata?: any;
    userId: string;
    items: {
      productId: string;
      quantity: number;
      price: number;
    }[];
  }) {
    const { items, ...orderData } = data;
    return prisma.order.create({
      data: {
        ...orderData,
        items: {
          create: items,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  },

  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
      },
    });
  },

  async findByUserId(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async update(id: string, data: {
    status?: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
    stripePaymentId?: string;
    metadata?: any;
  }) {
    return prisma.order.update({
      where: { id },
      data,
    });
  },
};

// Form services
export const formService = {
  async create(data: {
    name: string;
    description?: string;
    fields: any;
    serviceId: string;
  }) {
    return prisma.form.create({ data });
  },

  async findById(id: string) {
    return prisma.form.findUnique({
      where: { id },
      include: {
        service: true,
        submissions: true,
      },
    });
  },

  async findByServiceId(serviceId: string) {
    return prisma.form.findMany({
      where: { serviceId, isActive: true },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async update(id: string, data: {
    name?: string;
    description?: string;
    fields?: any;
    isActive?: boolean;
  }) {
    return prisma.form.update({
      where: { id },
      data,
    });
  },

  async submitForm(formId: string, data: any) {
    return prisma.formSubmission.create({
      data: {
        formId,
        data,
      },
    });
  },
};

// Conversation services
export const conversationService = {
  async create(userId: string) {
    return prisma.conversation.create({
      data: { userId },
    });
  },

  async findById(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        user: true,
      },
    });
  },

  async findByUserId(userId: string) {
    return prisma.conversation.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  },

  async addMessage(conversationId: string, data: {
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    content: string;
    metadata?: any;
  }) {
    return prisma.message.create({
      data: {
        ...data,
        conversationId,
      },
    });
  },

  async delete(id: string) {
    return prisma.conversation.delete({
      where: { id },
    });
  },
};

