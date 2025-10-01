# Manual Verification: MCP Prisma CRUD

These manual checks exercise the booking, product, order, and form MCP tools end-to-end against a real PostgreSQL database through Prisma.

## 1. Prepare the database

```bash
cd packages/database
npm install
export DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/agent"
npx prisma db push
npm run db:seed
```

## 2. Start the MCP server locally

```bash
cd ../mcp-server
npm install
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/agent" \
  npx wrangler dev --port 8788
```

Keep the process running. All subsequent `curl` commands target `http://127.0.0.1:8788`.

## 3. Booking tool

```bash
# Create a booking service (requires admin token header)
curl -X POST http://127.0.0.1:8788/mcp/tools/booking/service/create \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"ヘアカット","duration":60}'

# Reserve a slot using the AI token
default_token="<USER_TOKEN>"
curl -X POST http://127.0.0.1:8788/mcp/tools/booking/create \
  -H "Authorization: Bearer $default_token" \
  -H "Content-Type: application/json" \
  -d '{"serviceId":"<SERVICE_ID>","date":"2025-10-05","time":"10:00"}'

# Confirm persistence
psql $DATABASE_URL -c "SELECT id, status FROM bookings ORDER BY created_at DESC LIMIT 1;"
```

## 4. Product tool

```bash
curl -X POST http://127.0.0.1:8788/mcp/tools/product/create \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"serviceId":"<ECOM_SERVICE_ID>","name":"テスト商品","price":1200,"stock":5,"category":"衣料"}'

curl "http://127.0.0.1:8788/mcp/tools/product/search?q=テスト"
psql $DATABASE_URL -c "SELECT name, price FROM products WHERE name='テスト商品';"
```

## 5. Order tool

```bash
curl -X POST http://127.0.0.1:8788/mcp/tools/order/create \
  -H "Authorization: Bearer $default_token" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"<PRODUCT_ID>","quantity":2}],"shippingAddress":{"name":"山田太郎"}}'

psql $DATABASE_URL -c "SELECT order_number, status, total_amount FROM orders ORDER BY created_at DESC LIMIT 1;"
```

## 6. Form tool

```bash
curl -X POST http://127.0.0.1:8788/mcp/tools/form/create \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"serviceId":"<FORM_SERVICE_ID>","title":"お問い合わせ","fields":[{"id":"message","type":"textarea"}]}'

curl -X POST http://127.0.0.1:8788/mcp/tools/form/<FORM_ID>/submit \
  -H "Authorization: Bearer $default_token" \
  -H "Content-Type: application/json" \
  -d '{"data":{"message":"テスト"}}'

psql $DATABASE_URL -c "SELECT id, form_id FROM form_submissions ORDER BY created_at DESC LIMIT 1;"
```

These commands demonstrate that each MCP tool reads and writes through Prisma into PostgreSQL and can be repeated after modifying records to confirm updates and deletions persist.
