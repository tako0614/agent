import { Hono } from 'hono';
import { requireScope } from '../middleware';

const booking = new Hono();

// [PUBLIC] Get available booking slots
booking.get('/available-slots', async (c) => {
  const serviceId = c.req.query('serviceId');
  const date = c.req.query('date');
  
  if (!serviceId || !date) {
    return c.json({ error: 'serviceId and date are required' }, 400);
  }

  // TODO: Query database for available slots
  const slots = [
    { time: '09:00', available: true },
    { time: '10:00', available: false },
    { time: '11:00', available: true },
    { time: '13:00', available: true },
    { time: '14:00', available: true },
    { time: '15:00', available: false },
    { time: '16:00', available: true }
  ];

  return c.json({
    success: true,
    data: {
      serviceId,
      date,
      slots
    }
  });
});

// [USER] Create a booking
booking.post('/create', requireScope('booking:create'), async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth');
  
  const { serviceId, date, time, customerName, customerEmail, notes } = body;

  if (!serviceId || !date || !time) {
    return c.json({ error: 'serviceId, date, and time are required' }, 400);
  }

  // TODO: Create booking in database
  const bookingId = `bkg_${Date.now()}`;

  return c.json({
    success: true,
    data: {
      id: bookingId,
      serviceId,
      date,
      time,
      customerName: customerName || auth.user.name,
      customerEmail: customerEmail || auth.user.email,
      notes,
      status: 'confirmed',
      userId: auth.userId,
      createdAt: new Date().toISOString()
    }
  });
});

// [USER] Get booking details
booking.get('/:id', requireScope('booking:read'), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');

  // TODO: Query database
  return c.json({
    success: true,
    data: {
      id,
      serviceId: 'srv_123',
      date: '2025-10-15',
      time: '10:00',
      customerName: auth.user.name,
      customerEmail: auth.user.email,
      status: 'confirmed',
      userId: auth.userId,
      createdAt: '2025-10-02T10:00:00Z'
    }
  });
});

// [USER] Cancel booking
booking.post('/:id/cancel', requireScope('booking:delete'), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');

  // TODO: Cancel booking in database
  return c.json({
    success: true,
    message: `Booking ${id} cancelled successfully`,
    data: {
      id,
      status: 'cancelled',
      cancelledBy: auth.userId,
      cancelledAt: new Date().toISOString()
    }
  });
});

// [ADMIN] Create booking service
booking.post('/service/create', requireScope('booking:admin'), async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth');

  const { name, description, duration, price, availability } = body;

  if (!name || !duration) {
    return c.json({ error: 'name and duration are required' }, 400);
  }

  // TODO: Create service in database
  const serviceId = `srv_${Date.now()}`;

  return c.json({
    success: true,
    data: {
      id: serviceId,
      name,
      description,
      duration,
      price,
      availability,
      createdBy: auth.userId,
      createdAt: new Date().toISOString()
    }
  });
});

// [ADMIN] List all bookings
booking.get('/', requireScope('booking:admin'), async (c) => {
  const status = c.req.query('status');
  const date = c.req.query('date');

  // TODO: Query database with filters
  return c.json({
    success: true,
    data: {
      bookings: [
        {
          id: 'bkg_001',
          serviceId: 'srv_123',
          date: '2025-10-15',
          time: '10:00',
          customerName: 'John Doe',
          status: 'confirmed'
        },
        {
          id: 'bkg_002',
          serviceId: 'srv_123',
          date: '2025-10-16',
          time: '14:00',
          customerName: 'Jane Smith',
          status: 'pending'
        }
      ],
      filters: { status, date }
    }
  });
});

export default booking;
