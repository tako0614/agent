-- Migration: Add Enums for McpServer
-- Description: Convert status and authType columns to use proper enum values

-- Note: SQLite doesn't have native ENUM types, so we use CHECK constraints
-- The Prisma schema will handle the TypeScript enum types

-- This migration is informational only - the existing data already has the correct values
-- We're just adding the enum definitions to the Prisma schema for type safety
