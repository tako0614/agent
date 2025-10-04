# AI Agent Monorepo - Developer Instructions

## Project Architecture

This is a **monorepo for an AI agent product** using npm workspaces with three packages:

- `packages/agent` - SolidJS frontend + Cloudflare Workers (Hono) BFF/API
- `packages/database` - Shared Prisma database client exported as `@agent/database` (uses Cloudflare D1)
- `packages/mcp-server` - OAuth 2.1 compliant Model Context Protocol server on Cloudflare Workers

### Database: Cloudflare D1

This project uses **Cloudflare D1** (SQLite-based) for all data persistence:

- **Database name**: `agent-db`
- **Binding**: `DB` (configured in `wrangler.toml`)
- **Adapter**: `@prisma/adapter-d1` (not PostgreSQL)
- **Migrations**: Manually created SQL files in `packages/database/migrations/`
- **Local development**: Uses Wrangler's local D1 emulation

See `D1_MIGRATION.md` for complete setup and migration guides.

### Key Architectural Patterns

**Dual-environment setup**: Each package with a `worker/` directory runs on Cloudflare Workers, while frontend code in `packages/agent/src/` is client-side SolidJS.

**Development workflow**:
- Frontend dev server (Vite): `http://localhost:3000` 
- Worker dev server (Wrangler): `http://localhost:8787`
- Vite proxies `/api` requests to the Worker (see `packages/agent/vite.config.ts`)

**Worker-first routing**: In `wrangler.toml`, `run_worker_first = ["/api/*", "/mcp/*", "/auth/*"]` ensures these paths hit the Worker before static assets.

## Development Commands

From **workspace root**:
```powershell
npm install                 # Install all workspace dependencies
npm run dev:agent          # Start agent package (runs: vite build && wrangler dev)
npm run dev:mcp            # Start MCP server (port 8788)
npm run build              # Build all packages
npm run db:generate        # Generate Prisma client in packages/database
```

**D1 Database Commands** (from `packages/agent` or `packages/mcp-server`):
```powershell
# Initialize local D1 database (first time only)
npx wrangler d1 execute agent-db --local --file=../database/migrations/0001_init.sql
npx wrangler d1 execute agent-db --local --file=../database/migrations/0002_add_oauth_state.sql

# Apply migration to production
npx wrangler d1 execute agent-db --remote --file=../database/migrations/XXXX_name.sql

# Query database
npx wrangler d1 execute agent-db --local --command="SELECT * FROM User;"
```

**Important**: Run `npm run db:generate` after any Prisma schema changes to update types across all packages.

## Package-Specific Conventions

### packages/agent
- **Tech stack**: SolidJS, Vite, Hono, Cloudflare Workers, Tailwind v4
- **Entry points**: 
  - Frontend: `src/main.tsx` → `index.html`
  - Worker: `worker/index.ts` (Hono app)
- **Dev command**: `npm run dev` (builds Vite then starts Wrangler)
- **TypeScript**: Uses `jsx: "preserve"` with `jsxImportSource: "solid-js"`
- **Styling**: Tailwind v4 via `@tailwindcss/vite` plugin

### packages/database
- **Purpose**: Shared Prisma client exportable as `@agent/database`
- **Database**: Cloudflare D1 (SQLite) via `@prisma/adapter-d1`
- **Build**: `npm run build` compiles TypeScript to `dist/`
- **Prisma workflows**:
  - `npm run db:generate` - Generate Prisma client (run after schema changes)
  - `npm run db:studio` - Open Prisma Studio GUI
- **Migrations**: Create SQL files manually in `migrations/` directory, then apply via Wrangler
- **Export pattern**: `src/index.ts` re-exports `@prisma/client`
- **Usage in other packages**: Import via `@agent/database` (local file dependency)

### packages/mcp-server
- **Purpose**: OAuth 2.1 + Model Context Protocol implementation
- **Port**: `8788` (to avoid conflict with agent on 8787)
- **Dependencies**: Uses `@agent/database` for persistence
- **Environment secrets** (set in `.dev.vars` or `wrangler secret put`):
  - `MCP_ISSUER`, `JWT_SECRET`
  - `MCP_GOOGLE_CLIENT_ID`, `MCP_GOOGLE_CLIENT_SECRET`, `MCP_GOOGLE_REDIRECT_URI`
  - `ALLOWED_ORIGINS`

## Cloudflare Workers Specifics

- All workers use `compatibility_flags = ["nodejs_compat"]` for Node.js APIs (crypto, etc.)
- **D1 Database**: Both workers bind to the same D1 database (`agent-db`) via the `DB` binding
- **CORS**: Both workers enable CORS via Hono middleware with `origin: '*'` (change in production)
- **Secrets**: Never commit secrets to `wrangler.toml`. Use `.dev.vars` locally or `wrangler secret put` for production
- **SPA routing**: `packages/agent` uses `not_found_handling = "single-page-application"` to serve `index.html` for client-side routes

## TypeScript Configuration

- Packages use **separate tsconfig.json** files (no shared base config)
- Worker code includes `@cloudflare/workers-types` for Cloudflare Workers API types
- `moduleResolution: "bundler"` is standard across packages (modern Vite/Workers setup)

## Dependencies & Integrations

### Shared dependencies (agent + mcp-server)
- **Hono**: Web framework for Workers
- **Arctic**: OAuth 2.1 provider library
- **jose**: JWT signing/verification
- **@prisma/adapter-d1** + **@prisma/client**: D1 database access via Prisma

### Agent-specific
- **LangChain**: `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`
- **OpenAI SDK**: `openai` package
- **Stripe**: Payment integration
- **SolidJS ecosystem**: `solid-js`, `solid-markdown`, `lucide-solid`

## Common Tasks

**Adding a new API route in packages/agent/worker/index.ts**:
```typescript
app.get('/api/new-endpoint', async (c) => {
  // Can import from '@agent/database' if needed
  return c.json({ message: 'Hello' });
});
```

**Using Prisma in Worker code**:
```typescript
import { PrismaClient } from '@agent/database';
import { getPrisma } from './utils/prisma';

// In Hono handler
app.get('/api/users', async (c) => {
  const prisma = getPrisma(c.env.DB); // D1 binding
  const users = await prisma.user.findMany();
  return c.json(users);
});
// Remember: Run `npm run db:generate` after schema changes
```

**Updating Prisma schema**:
1. Edit `packages/database/prisma/schema.prisma`
2. Run `npm run db:generate` from root (updates all consuming packages)
3. Create a migration SQL file in `packages/database/migrations/`
4. Apply via `npx wrangler d1 execute agent-db --local --file=../database/migrations/XXXX.sql`

## Documentation References

- Root README: Project overview and workspace structure
- `packages/agent/README.md`: Development setup for agent package
- `docs/planning/PLAN.md`: Project planning (currently empty, check for future updates)
- OAuth setup guides referenced in root README (check if they exist when needed)
