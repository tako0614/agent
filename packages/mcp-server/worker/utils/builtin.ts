import { z } from 'zod';
import type { SafeParseSuccess } from 'zod';
import { McpAuthType, McpStatus } from '@agent/database';
import type { Bindings } from '../types';
import type { SerializedMcpServer } from './serialization';

const isoDateString = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime().transform((value) => `${value}Z`))
  .optional();

const builtinSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional(),
  ownerUserId: z.string().optional(),
  status: z.enum(Object.values(McpStatus) as [string, ...string[]]).default(McpStatus.ACTIVE),
  authType: z.enum(Object.values(McpAuthType) as [string, ...string[]]).default(McpAuthType.NONE),
  tags: z.array(z.string().min(1).max(64)).max(64).default([]),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

type BuiltinServer = z.infer<typeof builtinSchema>;

type BuiltinCache = {
  raw: string | undefined;
  parsed: SerializedMcpServer[];
};

const FALLBACK_TIMESTAMP = '1970-01-01T00:00:00.000Z';

let cache: BuiltinCache | null = null;

const normalizeBuiltin = (record: BuiltinServer): SerializedMcpServer => ({
  id: record.id,
  name: record.name,
  url: record.url,
  description: record.description,
  ownerUserId: record.ownerUserId,
  status: record.status,
  authType: record.authType,
  tags: record.tags,
  createdAt: record.createdAt ?? FALLBACK_TIMESTAMP,
  updatedAt: record.updatedAt ?? record.createdAt ?? FALLBACK_TIMESTAMP,
});

const parseBuiltinServers = (raw: string | undefined): SerializedMcpServer[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => builtinSchema.safeParse(item))
      .filter((result): result is SafeParseSuccess<BuiltinServer> => result.success)
      .map((result) => normalizeBuiltin(result.data));
  } catch {
    return [];
  }
};

export const getBuiltinServers = (env: Bindings): SerializedMcpServer[] => {
  const raw = env.BUILTIN_MCP_SERVERS;

  if (cache && cache.raw === raw) {
    return cache.parsed;
  }

  const parsed = parseBuiltinServers(raw);
  cache = { raw, parsed };

  return parsed;
};

export const filterBuiltinServers = (
  env: Bindings,
  filters: { q?: string; tags?: string[] }
): SerializedMcpServer[] => {
  const servers = getBuiltinServers(env);
  const normalizedQuery = filters.q?.trim().toLowerCase();
  const normalizedTags = (filters.tags ?? []).map((tag) => tag.toLowerCase());

  return servers
    .filter((server) => server.status === McpStatus.ACTIVE)
    .filter((server) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [server.name, server.description, ...server.tags]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());

      return haystack.some((value) => value.includes(normalizedQuery));
    })
    .filter((server) => {
      if (normalizedTags.length === 0) {
        return true;
      }

      const lowerTags = server.tags.map((tag) => tag.toLowerCase());

      return normalizedTags.some((tag) => lowerTags.includes(tag));
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};
