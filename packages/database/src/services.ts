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
