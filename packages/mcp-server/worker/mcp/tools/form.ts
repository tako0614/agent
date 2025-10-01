import { Hono } from 'hono';
import { requireScope } from '../middleware';
import type { McpVariables, AuthContext } from '../../types';
import { PrismaClient, Prisma } from '@agent/database';

type PrismaContext = PrismaClient | undefined;

function getPrisma(c: any): PrismaClient {
  const prisma = c.get('prisma') as PrismaContext;
  if (!prisma) {
    throw new Error('Database client not available');
  }
  return prisma;
}

const form = new Hono<{ Variables: McpVariables }>();

// [PUBLIC] Get form structure
form.get('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const prisma = getPrisma(c);
    const formRecord = await prisma.form.findUnique({ where: { id } });

    if (!formRecord || !formRecord.isActive) {
      return c.json({ error: 'Form not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...formRecord,
        fields: formRecord.fields,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch form' }, 500);
  }
});

// [USER] Submit form
form.post('/:id/submit', requireScope('form:submit'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  const responses = body.responses ?? body.data;

  if (!responses) {
    return c.json({ error: 'responses object is required' }, 400);
  }

  try {
    const prisma = getPrisma(c);

    const formRecord = await prisma.form.findUnique({ where: { id } });
    if (!formRecord || !formRecord.isActive) {
      return c.json({ error: 'Form not found' }, 404);
    }

    const submission = await prisma.formSubmission.create({
      data: {
        formId: id,
        data: {
          responses,
          userId: auth.userId,
          userEmail: auth.user.email,
        },
      },
    });

    return c.json({
      success: true,
      message: 'Form submitted successfully',
      data: submission,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to submit form' }, 500);
  }
});

// [ADMIN] Create form
form.post('/create', requireScope('form:admin'), async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  const { title, description, fields, settings, serviceId } = body;

  if (!title || !fields || !Array.isArray(fields)) {
    return c.json({ error: 'title and fields array are required' }, 400);
  }

  if (!serviceId) {
    return c.json({ error: 'serviceId is required' }, 400);
  }

  try {
    const prisma = getPrisma(c);

    const formRecord = await prisma.form.create({
      data: {
        name: title,
        description: description || null,
        fields: {
          fields,
          settings: settings || null,
        },
        isActive: true,
        serviceId,
      },
    });

    return c.json({
      success: true,
      data: formRecord,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create form' }, 500);
  }
});

// [ADMIN] Update form
form.put('/:id', requireScope('form:admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  try {
    const prisma = getPrisma(c);

    const formRecord = await prisma.form.update({
      where: { id },
      data: {
        name: body.title ?? undefined,
        description: body.description ?? undefined,
        fields:
          body.fields || body.settings
            ? {
                ...(body.fields ? { fields: body.fields } : {}),
                ...(body.settings ? { settings: body.settings } : {}),
              }
            : undefined,
        isActive: body.status ? body.status === 'active' : undefined,
      },
    });

    return c.json({
      success: true,
      message: `Form ${id} updated successfully`,
      data: formRecord,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update form' }, 500);
  }
});

// [ADMIN] List form submissions
form.get('/:id/submissions', requireScope('form:admin'), async (c) => {
  const id = c.req.param('id');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = Math.max(page - 1, 0) * limit;

  try {
    const prisma = getPrisma(c);

    const [submissions, total] = await Promise.all([
      prisma.formSubmission.findMany({
        where: { formId: id },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.formSubmission.count({ where: { formId: id } }),
    ]);

    return c.json({
      success: true,
      data: {
        formId: id,
        submissions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch submissions' }, 500);
  }
});

// [ADMIN] List all forms
form.get('/', requireScope('form:admin'), async (c) => {
  const status = c.req.query('status');
  const serviceId = c.req.query('serviceId');

  try {
    const prisma = getPrisma(c);
    const where: Prisma.FormWhereInput = {};

    if (status) {
      where.isActive = status === 'active';
    }

    if (serviceId) {
      where.serviceId = serviceId;
    }

    const forms = await prisma.form.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        submissions: true,
      },
    });

    return c.json({
      success: true,
      data: {
        forms: forms.map(({ submissions, ...formRecord }) => ({
          ...formRecord,
          submissionCount: submissions.length,
        })),
        filters: { status: status || null, serviceId: serviceId || null },
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to list forms' }, 500);
  }
});

// [ADMIN] Delete form
form.delete('/:id', requireScope('form:admin'), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth') as AuthContext;

  try {
    const prisma = getPrisma(c);

    const existing = await prisma.form.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: 'Form not found' }, 404);
    }

    const fields = {
      ...(existing.fields as Record<string, any> | null | undefined),
      archivedAt: new Date().toISOString(),
    };

    const formRecord = await prisma.form.update({
      where: { id },
      data: {
        isActive: false,
        fields,
      },
    });

    return c.json({
      success: true,
      message: `Form ${id} deleted successfully`,
      data: {
        ...formRecord,
        deletedBy: auth.userId,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to delete form' }, 500);
  }
});

export default form;
