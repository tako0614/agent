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

  // Create sample services
  const bookingService = await prisma.service.create({
    data: {
      name: '予約管理システム',
      type: 'BOOKING',
      description: 'レストランや美容室などの予約を管理',
      config: {
        businessHours: { start: '09:00', end: '18:00' },
        slotDuration: 30,
      },
      userId: user.id,
    },
  });

  const ecommerceService = await prisma.service.create({
    data: {
      name: 'ECサイト',
      type: 'ECOMMERCE',
      description: 'オンラインショップ',
      config: {
        currency: 'JPY',
        shippingFee: 500,
      },
      userId: user.id,
    },
  });

  const formService = await prisma.service.create({
    data: {
      name: 'お問い合わせフォーム',
      type: 'FORM',
      description: '顧客からの問い合わせを受付',
      userId: user.id,
    },
  });

  console.log('🛠️ Created services');

  // Create sample bookings
  await prisma.booking.createMany({
    data: [
      {
        title: '山田太郎様 - カット',
        startTime: new Date('2025-10-05T10:00:00'),
        endTime: new Date('2025-10-05T11:00:00'),
        status: 'CONFIRMED',
        customerName: '山田太郎',
        customerEmail: 'yamada@example.com',
        customerPhone: '090-1234-5678',
        serviceId: bookingService.id,
      },
      {
        title: '佐藤花子様 - カラー',
        startTime: new Date('2025-10-05T14:00:00'),
        endTime: new Date('2025-10-05T16:00:00'),
        status: 'PENDING',
        customerName: '佐藤花子',
        customerEmail: 'sato@example.com',
        serviceId: bookingService.id,
      },
    ],
  });

  console.log('📅 Created bookings');

  // Create sample products
  await prisma.product.createMany({
    data: [
      {
        name: 'ワイヤレスイヤホン',
        description: '高音質Bluetoothイヤホン',
        price: 8900,
        stock: 50,
        images: ['/images/earphones.jpg'],
        serviceId: ecommerceService.id,
      },
      {
        name: 'スマートウォッチ',
        description: '健康管理機能搭載',
        price: 15900,
        stock: 30,
        images: ['/images/watch.jpg'],
        serviceId: ecommerceService.id,
      },
      {
        name: 'ノートPC',
        description: '軽量ハイスペックモデル',
        price: 98000,
        stock: 10,
        images: ['/images/laptop.jpg'],
        serviceId: ecommerceService.id,
      },
    ],
  });

  console.log('🛒 Created products');

  // Create sample form
  await prisma.form.create({
    data: {
      name: 'お問い合わせフォーム',
      description: '商品やサービスに関するお問い合わせ',
      fields: {
        fields: [
          { id: '1', type: 'text', label: 'お名前', required: true },
          { id: '2', type: 'email', label: 'メールアドレス', required: true },
          { id: '3', type: 'textarea', label: 'お問い合わせ内容', required: true },
        ],
      },
      serviceId: formService.id,
    },
  });

  console.log('📝 Created forms');

  // Create sample conversation
  await prisma.conversation.create({
    data: {
      userId: user.id,
      messages: {
        create: [
          {
            role: 'USER',
            content: 'こんにちは',
          },
          {
            role: 'ASSISTANT',
            content: 'こんにちは!何かお手伝いできることはありますか?',
          },
        ],
      },
    },
  });

  console.log('💬 Created conversation');

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
