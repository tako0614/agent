import { Hono } from 'hono';
import { requireScope } from '../middleware';
import type { McpVariables, AuthContext } from '../../types';

const form = new Hono<{ Variables: McpVariables }>();

// [PUBLIC] Get form structure
form.get('/:id', async (c) => {
  const id = c.req.param('id');

  // TODO: Query database for form
  return c.json({
    success: true,
    data: {
      id,
      title: 'Sample Contact Form',
      description: 'Please fill out this form to contact us',
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Your Name',
          required: true,
          placeholder: 'John Doe'
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email Address',
          required: true,
          placeholder: 'john@example.com'
        },
        {
          id: 'message',
          type: 'textarea',
          label: 'Message',
          required: true,
          placeholder: 'Your message here...'
        },
        {
          id: 'subscribe',
          type: 'checkbox',
          label: 'Subscribe to newsletter',
          required: false
        }
      ],
      submitButtonText: 'Submit',
      successMessage: 'Thank you for your submission!',
      status: 'active'
    }
  });
});

// [USER] Submit form
form.post('/:id/submit', requireScope('form:submit'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  const { responses } = body;

  if (!responses) {
    return c.json({ error: 'responses object is required' }, 400);
  }

  // TODO: Validate form and save submission to database
  const submissionId = `sub_${Date.now()}`;

  return c.json({
    success: true,
    message: 'Form submitted successfully',
    data: {
      id: submissionId,
      formId: id,
      responses,
      userId: auth.userId,
      userEmail: auth.user.email,
      submittedAt: new Date().toISOString()
    }
  });
});

// [ADMIN] Create form
form.post('/create', requireScope('form:admin'), async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  const { title, description, fields, settings } = body;

  if (!title || !fields || !Array.isArray(fields)) {
    return c.json({ error: 'title and fields array are required' }, 400);
  }

  // TODO: Create form in database
  const formId = `frm_${Date.now()}`;

  return c.json({
    success: true,
    data: {
      id: formId,
      title,
      description,
      fields,
      settings: settings || {
        submitButtonText: 'Submit',
        successMessage: 'Thank you for your submission!',
        allowMultipleSubmissions: false
      },
      status: 'active',
      createdBy: auth.userId,
      createdAt: new Date().toISOString()
    }
  });
});

// [ADMIN] Update form
form.put('/:id', requireScope('form:admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const auth = c.get('auth') as AuthContext;

  // TODO: Update form in database
  return c.json({
    success: true,
    message: `Form ${id} updated successfully`,
    data: {
      id,
      ...body,
      updatedBy: auth.userId,
      updatedAt: new Date().toISOString()
    }
  });
});

// [ADMIN] List form submissions
form.get('/:id/submissions', requireScope('form:admin'), async (c) => {
  const id = c.req.param('id');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');

  // TODO: Query database for submissions
  return c.json({
    success: true,
    data: {
      formId: id,
      submissions: [
        {
          id: 'sub_001',
          responses: {
            name: 'John Doe',
            email: 'john@example.com',
            message: 'Hello, I have a question...'
          },
          userEmail: 'john@example.com',
          submittedAt: '2025-10-01T10:00:00Z'
        },
        {
          id: 'sub_002',
          responses: {
            name: 'Jane Smith',
            email: 'jane@example.com',
            message: 'I would like more information...'
          },
          userEmail: 'jane@example.com',
          submittedAt: '2025-10-02T14:00:00Z'
        }
      ],
      pagination: {
        page,
        limit,
        total: 2,
        totalPages: 1
      }
    }
  });
});

// [ADMIN] List all forms
form.get('/', requireScope('form:admin'), async (c) => {
  const status = c.req.query('status');

  // TODO: Query database for forms
  return c.json({
    success: true,
    data: {
      forms: [
        {
          id: 'frm_001',
          title: 'Contact Form',
          status: 'active',
          submissionCount: 15,
          createdAt: '2025-09-01T10:00:00Z'
        },
        {
          id: 'frm_002',
          title: 'Feedback Form',
          status: 'active',
          submissionCount: 8,
          createdAt: '2025-09-15T10:00:00Z'
        }
      ],
      filters: { status }
    }
  });
});

// [ADMIN] Delete form
form.delete('/:id', requireScope('form:admin'), async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth') as AuthContext;

  // TODO: Delete form from database
  return c.json({
    success: true,
    message: `Form ${id} deleted successfully`,
    data: {
      id,
      deletedBy: auth.userId,
      deletedAt: new Date().toISOString()
    }
  });
});

export default form;
