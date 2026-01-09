import { z } from "zod"

/**
 * MCP Server Use Types
 */
export interface McpServerUse {
	type: string
	serverName: string
	toolName?: string
	uri?: string
}

/**
 * Mode to Profile Mapping
 * Maps mode slugs to arrays of MCP server names
 * Example: { "debug": ["serverA"], "research": ["serverB", "serverC"] }
 */
export type ModeToProfileMapping = Record<string, string[]>

/**
 * McpExecutionStatus
 */

export const mcpExecutionStatusSchema = z.discriminatedUnion("status", [
	z.object({
		executionId: z.string(),
		status: z.literal("started"),
		serverName: z.string(),
		toolName: z.string(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("output"),
		response: z.string(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("completed"),
		response: z.string().optional(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("error"),
		error: z.string().optional(),
	}),
])

export type McpExecutionStatus = z.infer<typeof mcpExecutionStatusSchema>
