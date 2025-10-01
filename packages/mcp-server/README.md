# MCP Server

Independent MCP (Model Context Protocol) tool API server.

## Overview

The MCP Server provides business tools and APIs that can be accessed:
- By the AI Service via token-based authentication (for end users)
- By administrators via Google OAuth (for direct management)

## Features

- 🔐 **Dual Authentication**: AI Service tokens + Google OAuth
- 🛠️ **Business Tools**: Booking, Product, Order, Form management
- 🌐 **REST API**: Public API endpoints
- 🔒 **Scope-based Access Control**: Fine-grained permissions
- 📊 **Admin Dashboard**: Direct tool management

## Architecture

```
AI Service (localhost:8787)
  → Generates JWT Token
    → MCP Server (localhost:8788)
      → Verifies Token
        → Executes Tools
          → Database Operations
```

## Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials

# Start development server
npm run dev
# Server runs on http://localhost:8788
```

## API Endpoints

### Authentication
- `GET /auth/login/google` - Administrator login
- `GET /auth/callback/google` - OAuth callback
- `POST /auth/verify-token` - Verify AI Service token

### MCP Tools
- `GET /mcp` - API overview
- `GET /mcp/tools` - Available tools list

#### Booking
- `GET /mcp/tools/booking/available-slots` - Check available slots
- `POST /mcp/tools/booking/create` - Create booking
- `POST /mcp/tools/booking/service/create` - [Admin] Create service

#### Product
- `GET /mcp/tools/product/search` - Search products
- `GET /mcp/tools/product/:id` - Get product details
- `POST /mcp/tools/product/create` - [Admin] Create product

#### Order
- `POST /mcp/tools/order/create` - Create order
- `GET /mcp/tools/order/:id` - Get order details
- `GET /mcp/tools/order/list` - [Admin] List all orders

#### Form
- `GET /mcp/tools/form/:id` - Get form
- `POST /mcp/tools/form/:id/submit` - Submit form
- `POST /mcp/tools/form/create` - [Admin] Create form

## Deployment

```bash
# Set secrets
wrangler secret put MCP_GOOGLE_CLIENT_SECRET
wrangler secret put AI_SERVICE_PUBLIC_KEY
wrangler secret put DATABASE_URL

# Deploy to Cloudflare Workers
npm run deploy
```

## Environment Variables

See `.dev.vars.example` for required environment variables.

## Documentation

- [MCP Authentication Guide](../../docs/guides/MCP_AUTH.md)
- [Separation Architecture](../../docs/architecture/SEPARATION_ARCHITECTURE.md)
