export * from '@prisma/client';

// Enum-like value sets for fields stored as strings in D1/SQLite
export const McpStatus = {
	ACTIVE: 'ACTIVE',
	DISABLED: 'DISABLED',
	PENDING: 'PENDING',
} as const;

export type McpStatus = typeof McpStatus[keyof typeof McpStatus];

export const MCP_STATUS_VALUES = Object.values(McpStatus) as McpStatus[];

export const McpAuthType = {
	NONE: 'NONE',
	OAUTH2: 'OAUTH2',
	API_KEY: 'API_KEY',
} as const;

export type McpAuthType = typeof McpAuthType[keyof typeof McpAuthType];

export const MCP_AUTH_TYPE_VALUES = Object.values(McpAuthType) as McpAuthType[];
