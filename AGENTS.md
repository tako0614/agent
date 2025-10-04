# Repository Guidelines

## Project Structure & Module Organization
This npm workspace monorepo keeps all runnable code under `packages/`. `packages/agent` contains the SolidJS UI plus the Cloudflare Worker entry in `worker/`. `packages/mcp-server` exposes the MCP Worker, with HTTP handlers in `worker/routes/` and utilities in `worker/utils/`. `packages/database` provides Prisma models; edit `prisma/schema.prisma`, run generators, and treat `dist/` as build output. Reference material lives in `docs/`. Anything under `dist/` or `node_modules/` is generated and should never be edited by hand.

## Build, Test, and Development Commands
Run `npm install` once to hydrate every workspace. `npm run dev:agent` builds the UI and starts Wrangler in watch mode, while `npm run dev:mcp` boots the MCP Worker on port 8788. `npm run build` aggregates each package’s build (`vite build` for the agent, `tsc` for Workers). Database work stays scoped to its package: `npm run db:generate` regenerates the Prisma client, and `npm run db:migrate --workspace=packages/database` applies migrations. Use `npm run deploy --workspace=packages/agent` or the MCP equivalent after configuring environment secrets.

## Coding Style & Naming Conventions
TypeScript is standard and compiled with `strict` options, so keep types explicit and address warnings instead of suppressing them. Use two-space indentation for TypeScript, JSX, JSON, and Worker config files; Prisma schema files currently use tabs, so preserve that format. Components and classes follow PascalCase, utilities and hooks use camelCase, and file names stick to kebab-case (`agent-session.ts`). There is no shared formatter, so align imports, trailing commas, and spacing with the surrounding code before opening a PR.

## Testing Guidelines
Automated tests are not yet committed. When adding coverage, colocate integration-focused specs near the feature (for example in `packages/agent/tests/` or as `*.test.ts` siblings) and prefer end-to-end exercises against the Worker interfaces. Document required environment variables for test runs and target a disposable Postgres instance by using the Prisma CLI (`prisma db push` or `prisma migrate dev`) so runs stay reproducible.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits (`docs:`, `refactor:`, etc.), so write imperative, 72-character summaries such as `feat(mcp): expose healthz route`. Keep related work in a single commit and separate formatting-only changes. Pull requests should include a short narrative, linked issues or specs, manual verification steps, and screenshots or response samples for UI or API changes. Call out schema or configuration updates so reviewers can refresh their local env.
