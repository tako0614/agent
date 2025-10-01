import { Hono } from 'hono';
import { requireScope } from '../middleware';
import type { McpVariables, AuthContext } from '../../types';
import { PrismaClient, BookingStatus } from '@agent/database';

type PrismaContext = PrismaClient | undefined;

function getPrisma(c: any): PrismaClient {
  const prisma = c.get('prisma') as PrismaContext;
  if (!prisma) {
    throw new Error('Database client not available');
  }
  return prisma;
}

function parseTimeString(time: string): number {
  const [hours, minutes] = time.split(':').map((value) => parseInt(value, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error('Invalid time format');
  }
  return hours * 60 + minutes;
}

function formatTime(minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (minutesFromMidnight % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function createDateFromParts(date: string, minutesFromMidnight: number): Date {
  const base = new Date(`${date}T00:00:00.000Z`);
  return new Date(base.getTime() + minutesFromMidnight * 60 * 1000);
}

function isAdmin(auth: AuthContext): boolean {
  const scopes = auth.scope || [];
  return (
    scopes.includes('*') ||
    scopes.includes('booking:*') ||
    scopes.includes('booking:admin')
  );
}

function ensureOwnership(auth: AuthContext, ownerId?: string | null): boolean {
  if (!ownerId) {
    return false;
  }
  return auth.userId === ownerId;
}

function normalizeBookingStatus(status?: string | null): BookingStatus | undefined {
  if (!status) {
    return undefined;
  }
  const normalized = status.toUpperCase();
  if (Object.values(BookingStatus).includes(normalized as BookingStatus)) {
    return normalized as BookingStatus;
  }
  return undefined;
}

const booking = new Hono<{ Variables: McpVariables }>();

// [PUBLIC] Get available booking slots
booking.get('/available-slots', async (c) => {
  const serviceId = c.req.query('serviceId');
  const date = c.req.query('date');

  if (!serviceId || !date) {
    return c.json({ error: 'serviceId and date are required' }, 400);
  }

  try {
    const prisma = getPrisma(c);

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    const config = (service.config as Record<string, any>) || {};
    const businessHours = config.businessHours || { start: '09:00', end: '17:00' };
    const slotDuration = Number(config.slotDuration) || 60;

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const existingBookings = await prisma.booking.findMany({
      where: {
        serviceId,
        startTime: {
          gte: dayStart,
          lt: dayEnd,
        },
        status: {
          notIn: ['CANCELLED'],
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const startMinutes = parseTimeString(businessHours.start);
    const endMinutes = parseTimeString(businessHours.end);

    const slots = [] as Array<{
      id: string;
      start: string;
      end: string;
      available: boolean;
    }>;

    let index = 0;
    for (let current = startMinutes; current + slotDuration <= endMinutes; current += slotDuration) {
      const slotStart = createDateFromParts(date, current);
      const slotEnd = createDateFromParts(date, current + slotDuration);
      const conflict = existingBookings.some((booking: any) => {
        return booking.startTime < slotEnd && booking.endTime > slotStart;
      });

      slots.push({
        id: `${serviceId}_${date}_${index}`,
        start: formatTime(current),
        end: formatTime(current + slotDuration),
        available: !conflict,
      });

      index += 1;
    }

    return c.json({
      success: true,
      data: {
        serviceId,
        date,
        availableSlots: slots,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to load available slots' }, 500);
  }
});

// [USER] Create a booking
booking.post('/create', requireScope('booking:create'), async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  const { serviceId, date, time, customerName, customerEmail, customerPhone, notes } = body;

  if (!serviceId || !date || !time) {
    return c.json({ error: 'serviceId, date, and time are required' }, 400);
  }

  try {
    const prisma = getPrisma(c);

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    const config = (service.config as Record<string, any>) || {};
    const slotDuration = Number(config.slotDuration) || 60;

    const [hours, minutes] = time.split(':').map((value: string) => parseInt(value, 10));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return c.json({ error: 'Invalid time format' }, 400);
    }

    const startTime = createDateFromParts(date, hours * 60 + minutes);
    const endTime = new Date(startTime.getTime() + slotDuration * 60 * 1000);

    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        serviceId,
        startTime: {
          lt: endTime,
        },
        endTime: {
          gt: startTime,
        },
        status: {
          not: 'CANCELLED',
        },
      },
    });

    if (conflictingBooking) {
      return c.json({ error: 'Selected time slot is no longer available' }, 409);
    }

    const bookingRecord = await prisma.booking.create({
      data: {
        title: `${customerName || auth.user.name || 'Reservation'} - ${service.name}`,
        description: notes || null,
        startTime,
        endTime,
        status: 'CONFIRMED',
        customerName: customerName || auth.user.name || null,
        customerEmail: customerEmail || auth.user.email || null,
        customerPhone: customerPhone || null,
        metadata: {
          userId: auth.userId,
          notes: notes || undefined,
        },
        serviceId,
      },
    });

    return c.json({
      success: true,
      data: {
        ...bookingRecord,
        date,
        time,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create booking' }, 500);
  }
});

// [USER] Get booking details
booking.get('/:id', requireScope('booking:read'), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth') as AuthContext;

  try {
    const prisma = getPrisma(c);
    const bookingRecord = await prisma.booking.findUnique({ where: { id } });

    if (!bookingRecord) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const metadata = (bookingRecord.metadata as Record<string, any>) || {};
    if (!isAdmin(auth) && metadata.userId && !ensureOwnership(auth, metadata.userId)) {
      return c.json({ error: 'You do not have access to this booking' }, 403);
    }

    return c.json({
      success: true,
      data: bookingRecord,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch booking' }, 500);
  }
});

// [USER] Cancel booking
booking.post('/:id/cancel', requireScope('booking:delete'), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth') as AuthContext;
  const body = await c.req.json().catch(() => ({}));

  try {
    const prisma = getPrisma(c);

    const bookingRecord = await prisma.booking.findUnique({ where: { id } });

    if (!bookingRecord) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    if (bookingRecord.status === 'CANCELLED') {
      return c.json({ error: 'Booking is already cancelled' }, 400);
    }

    const metadata = (bookingRecord.metadata as Record<string, any>) || {};
    if (!isAdmin(auth) && (!metadata.userId || !ensureOwnership(auth, metadata.userId))) {
      return c.json({ error: 'You do not have permission to cancel this booking' }, 403);
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        metadata: {
          ...metadata,
          cancelledBy: auth.userId,
          cancellationReason: body?.reason || null,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    return c.json({
      success: true,
      message: `Booking ${id} cancelled successfully`,
      data: updated,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to cancel booking' }, 500);
  }
});

// [ADMIN] Create booking service
booking.post('/service/create', requireScope('booking:admin'), async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  const { name, description, duration, price, availability } = body;

  if (!name || !duration) {
    return c.json({ error: 'name and duration are required' }, 400);
  }

  try {
    const prisma = getPrisma(c);

    const service = await prisma.service.create({
      data: {
        name,
        description: description || null,
        type: 'BOOKING',
        config: {
          slotDuration: duration,
          price: price || null,
          availability: availability || null,
        },
        userId: auth.userId,
      },
    });

    return c.json({
      success: true,
      data: service,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create booking service' }, 500);
  }
});

// [ADMIN] List all bookings
booking.get('/', requireScope('booking:admin'), async (c) => {
  const status = c.req.query('status');
  const date = c.req.query('date');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  try {
    const prisma = getPrisma(c);

    const where: any = {};

    const normalizedStatus = normalizeBookingStatus(status);
    if (normalizedStatus) {
      where.status = normalizedStatus;
    }

    if (date) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      where.startTime = { gte: dayStart, lt: dayEnd };
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { startTime: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return c.json({
      success: true,
      data: {
        bookings,
        pagination: {
          limit,
          offset,
          total,
        },
        filters: { status: normalizedStatus || null, date: date || null },
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch bookings' }, 500);
  }
});

export default booking;
