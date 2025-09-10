import { prisma } from './client.js';

async function main() {
  console.log('🌱 Seeding database...');

  // Create sample user
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
    },
  });

  console.log('👤 Created user:', user);

  // Create sample agent
  const agent = await prisma.agent.upsert({
    where: { id: 'agent-1' },
    update: {},
    create: {
      id: 'agent-1',
      name: 'Assistant Agent',
      description: 'A helpful assistant agent',
      config: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
      },
      userId: user.id,
    },
  });

  console.log('🤖 Created agent:', agent);

  // Create sample tasks
  const tasks = await Promise.all([
    prisma.task.upsert({
      where: { id: 'task-1' },
      update: {},
      create: {
        id: 'task-1',
        title: 'Setup development environment',
        description: 'Configure all necessary tools and dependencies',
        status: 'COMPLETED',
        priority: 'HIGH',
        userId: user.id,
        agentId: agent.id,
        completedAt: new Date(),
      },
    }),
    prisma.task.upsert({
      where: { id: 'task-2' },
      update: {},
      create: {
        id: 'task-2',
        title: 'Implement user authentication',
        description: 'Add login and registration functionality',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        userId: user.id,
        agentId: agent.id,
      },
    }),
    prisma.task.upsert({
      where: { id: 'task-3' },
      update: {},
      create: {
        id: 'task-3',
        title: 'Design UI components',
        description: 'Create reusable UI components for the application',
        status: 'PENDING',
        priority: 'MEDIUM',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        userId: user.id,
      },
    }),
  ]);

  console.log('📋 Created tasks:', tasks.length);

  // Create sample logs
  await prisma.log.createMany({
    data: [
      {
        level: 'INFO',
        message: 'Application started successfully',
        metadata: { version: '1.0.0' },
      },
      {
        level: 'WARN',
        message: 'High memory usage detected',
        metadata: { usage: '85%' },
      },
      {
        level: 'ERROR',
        message: 'Failed to connect to external API',
        metadata: { endpoint: '/api/external', error: 'Timeout' },
      },
    ],
  });

  console.log('📝 Created logs');
  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
