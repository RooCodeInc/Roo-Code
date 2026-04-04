import { readFileSync } from "fs"
import { z } from "zod"
import * as path from "path"

// Exact schema from Jabberwock
const BaseConfigSchema = z
	.object({
		disabled: z.boolean().optional(),
		timeout: z.number().min(1).max(3600).optional().default(60),
		alwaysAllow: z.array(z.string()).default([]),
		watchPaths: z.array(z.string()).optional(),
		disabledTools: z.array(z.string()).default([]),
	})
	.passthrough()

const createServerTypeSchema = () => {
	return z.union([
		// Stdio config (has command field)
		BaseConfigSchema.extend({
			type: z.string().optional(),
			command: z.string().min(1, "Command cannot be empty"),
			args: z.array(z.string()).optional(),
			cwd: z.string().optional(),
			env: z.record(z.string()).optional(),
			// Ensure no SSE fields are present
			url: z.undefined().optional(),
			headers: z.undefined().optional(),
		}).transform((data) => ({
			...data,
			mcpTransport: "stdio" as const,
		})),
		// SSE config (has url field)
		BaseConfigSchema.extend({
			type: z.string().optional(),
			url: z.string().url("URL must be a valid URL format"),
			headers: z.record(z.string()).optional(),
			// Ensure no stdio fields are present
			command: z.undefined().optional(),
			args: z.undefined().optional(),
			env: z.undefined().optional(),
		}).transform((data) => ({
			...data,
			mcpTransport: "sse" as const,
		})),
		// StreamableHTTP config (has url field)
		BaseConfigSchema.extend({
			type: z.string().optional(),
			url: z.string().url("URL must be a valid URL format"),
			headers: z.record(z.string()).optional(),
			// Ensure no stdio fields are present
			command: z.undefined().optional(),
			args: z.undefined().optional(),
			env: z.undefined().optional(),
		}).transform((data) => ({
			...data,
			mcpTransport: "streamable-http" as const,
		})),
	])
}

const ServerConfigSchema = createServerTypeSchema()

const McpSettingsSchema = z.object({
	mcpServers: z.record(ServerConfigSchema),
})

const file = readFileSync(
	"/Users/m.dusmikeev/Library/Application Support/Code/User/globalStorage/jabberwockinc.jabberwock/settings/mcp_settings.json",
	"utf-8",
)
const config = JSON.parse(file)

const result = McpSettingsSchema.safeParse(config)
if (!result.success) {
	console.log("Failed:", JSON.stringify(result.error, null, 2))
} else {
	console.log("Success. Parsed servers:", Object.keys(result.data.mcpServers))
	console.log("md-todo-mcp config:", result.data.mcpServers["md-todo-mcp"])
}
