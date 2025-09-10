
# Monorepo: agent + database

This repository is organized as a monorepo with three packages:

- `packages/agent` — Vite + SolidJS + Cloudflare Workers + Hono
- `packages/database` — Unified database layer with Prisma

## Features

### Frontend (Vite + SolidJS)
- ⚡ Vite for fast development
- 🎯 SolidJS for reactive UI
- 🎨 Modern CSS with dark/light mode support

### Backend (Cloudflare Workers + Hono)
- 🚀 High-performance edge computing
- 🔒 Type-safe API with Hono
- 🌐 CORS configured for cross-origin requests
- 📊 Comprehensive logging system

### Database (Prisma)
- 📦 Type-safe database access
- 🔄 Automatic migrations
- 🌱 Seeding support
- 🏗️ PostgreSQL with optional SQLite for development

## Quick Start

### 1. Install dependencies
```powershell
npm install
```

### 2. Setup database
```powershell
# Configure environment variables
cp packages/database/.env.example packages/database/.env
# Edit packages/database/.env with your database URL

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed database with sample data (optional)
npm run db:seed
```

### 3. Start development servers
```powershell
npm run dev
```

This will start:
- Database build watch mode
- Cloudflare Workers development server (http://localhost:8787)
- Frontend development server (http://localhost:3000)

### 4. Build for production
```powershell
npm run build
```

## API Endpoints

### Core Endpoints
- `GET /api/hello` - Hello world message
- `GET /api/status` - Application status

### User Management
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user

### Agent Management
- `GET /api/agents?userId=:id` - Get agents for user
- `POST /api/agents` - Create new agent

### Task Management
- `GET /api/tasks?userId=:id` - Get tasks for user
- `GET /api/tasks?agentId=:id` - Get tasks for agent
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task

### Logging
- `GET /api/logs?limit=50&level=INFO` - Get system logs

## Project Structure

```
packages/
├── agent/                 # Frontend + Workers
│   ├── src/
│   │   ├── App.tsx       # Main SolidJS component
│   │   ├── main.tsx      # Frontend entry point
│   │   └── worker.ts     # Cloudflare Workers API
│   ├── index.html        # HTML template
│   ├── vite.config.ts    # Vite configuration
│   └── wrangler.toml     # Workers configuration
└── database/             # Database layer
    ├── src/
    │   ├── client.ts     # Prisma client
    │   ├── services.ts   # Database services
    │   └── seed.ts       # Seed data
    ├── prisma/
    │   └── schema.prisma # Database schema
    └── .env              # Database configuration
```

## Development Workflow

1. **Database Changes**: Update `packages/database/prisma/schema.prisma`
2. **Generate Client**: Run `npm run db:generate`
3. **Apply Changes**: Run `npm run db:push` (dev) or `npm run db:migrate` (prod)
4. **Update Services**: Modify `packages/database/src/services.ts` if needed
5. **Use in Workers**: Import services in `packages/agent/src/worker.ts`

## Deployment

### Database
1. Set up PostgreSQL database
2. Configure `DATABASE_URL` environment variable
3. Run migrations: `npm run db:migrate`

### Cloudflare Workers
1. Configure Wrangler authentication
2. Deploy: `npm run build:agent && wrangler deploy`

### Frontend
1. Build: `npm run build:agent`
2. Deploy static files to your preferred hosting (Cloudflare Pages, Vercel, etc.)

## Technology Stack

- **Frontend**: Vite + SolidJS + TypeScript
- **Backend**: Cloudflare Workers + Hono + TypeScript  
- **Database**: Prisma + PostgreSQL/SQLite
- **Development**: npm workspaces + concurrently
npm run build

# 4) Run built worker locally (Miniflare)
npm run start
```

Notes

- Each package also has its own `package.json` so you can work inside a package folder and run `npm run dev` or `npm run build` there directly.
- To publish the worker to Cloudflare, add a `wrangler.toml` inside `packages/agent` and follow Cloudflare Wrangler docs.
