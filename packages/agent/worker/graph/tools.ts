/**
 * Built-in Agent Tools
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { PrismaClient } from '@agent/database';

export function createBuiltInTools(prisma: PrismaClient, userId: string, mcpBaseUrl: string, serviceToken: string | null) {
  const searchMcpServers = tool(
    async ({ query, tags, limit }) => {
      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (tags && tags.length > 0) params.set('tags', tags.join(','));
        if (limit) params.set('limit', limit.toString());

        const url = `${mcpBaseUrl}/mcp/discovery/search?${params.toString()}`;
        const headers: Record<string, string> = {};
        if (serviceToken) {
          headers['Authorization'] = `Bearer ${serviceToken}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
          return { error: `Failed to search MCP servers: ${response.statusText}` };
        }

        const data = await response.json() as { items?: unknown[] };
        return { items: data.items || [] };
      } catch (error) {
        return { error: (error as Error).message };
      }
    },
    {
      name: 'search_mcp_servers',
      description: 'Search for available MCP servers by query and tags. Returns a list of MCP server candidates.',
      schema: z.object({
        query: z.string().optional().describe('Search query text'),
        tags: z.array(z.string()).optional().describe('Tags to filter by'),
        limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results'),
      }),
    }
  );

  const addMcpServer = tool(
    async ({ mcpServerId, config }) => {
      try {
        const server = await prisma.mcpServer.findUnique({ where: { id: mcpServerId } });
        if (!server) {
          return { error: 'MCP server not found' };
        }

        const existing = await prisma.agentMcpLink.findUnique({
          where: { userId_mcpServerId: { userId, mcpServerId } },
        });

        if (existing) {
          if (existing.enabled) {
            return { linkId: existing.id, message: 'MCP server already linked' };
          }
          const updated = await prisma.agentMcpLink.update({
            where: { id: existing.id },
            data: {
              enabled: true,
              configJson: config ? JSON.stringify(config) : existing.configJson,
            },
          });
          return { linkId: updated.id, message: 'MCP server re-enabled' };
        }

        const created = await prisma.agentMcpLink.create({
          data: {
            userId,
            mcpServerId,
            enabled: true,
            configJson: config ? JSON.stringify(config) : null,
          },
        });

        return { linkId: created.id, message: 'MCP server successfully added' };
      } catch (error) {
        return { error: (error as Error).message };
      }
    },
    {
      name: 'add_mcp_server',
      description: 'Add an MCP server to the user\'s agent. Returns the link ID.',
      schema: z.object({
        mcpServerId: z.string().describe('The ID of the MCP server to add'),
        config: z.record(z.unknown()).optional().describe('Optional configuration for the MCP server'),
      }),
    }
  );

  const listMyMcpServers = tool(
    async ({ includeDisabled }) => {
      try {
        const links = await prisma.agentMcpLink.findMany({
          where: {
            userId,
            ...(includeDisabled ? {} : { enabled: true }),
          },
          include: {
            server: {
              select: {
                id: true,
                name: true,
                url: true,
                description: true,
                status: true,
                authType: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        return {
          items: links.map((link) => ({
            linkId: link.id,
            mcpServerId: link.mcpServerId,
            enabled: link.enabled,
            server: link.server,
          })),
        };
      } catch (error) {
        return { error: (error as Error).message };
      }
    },
    {
      name: 'list_my_mcp_servers',
      description: 'List all MCP servers linked to the user\'s agent. Returns a list of linked MCP servers.',
      schema: z.object({
        includeDisabled: z.boolean().optional().describe('Include disabled MCP servers in the list'),
      }),
    }
  );

  const removeMcpServer = tool(
    async ({ linkId, hardDelete }) => {
      try {
        const link = await prisma.agentMcpLink.findUnique({ where: { id: linkId } });
        if (!link || link.userId !== userId) {
          return { error: 'MCP link not found' };
        }

        if (hardDelete) {
          await prisma.agentMcpLink.delete({ where: { id: linkId } });
          return { ok: true, message: 'MCP server permanently removed' };
        } else {
          await prisma.agentMcpLink.update({
            where: { id: linkId },
            data: { enabled: false },
          });
          return { ok: true, message: 'MCP server disabled' };
        }
      } catch (error) {
        return { error: (error as Error).message };
      }
    },
    {
      name: 'remove_mcp_server',
      description: 'Remove or disable an MCP server from the user\'s agent.',
      schema: z.object({
        linkId: z.string().describe('The ID of the MCP link to remove'),
        hardDelete: z.boolean().optional().describe('Permanently delete the link (true) or just disable it (false)'),
      }),
    }
  );

  return [searchMcpServers, addMcpServer, listMyMcpServers, removeMcpServer];
}
