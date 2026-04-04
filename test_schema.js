const { z } = require("zod")

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
		BaseConfigSchema.extend({
			type: z.string().optional(),
			command: z.string().min(1, "Command cannot be empty"),
			args: z.array(z.string()).optional(),
			cwd: z.string().default("/"),
			env: z.record(z.string()).optional(),
			url: z.undefined().optional(),
			headers: z.undefined().optional(),
		}).transform((data) => ({ ...data, mcpTransport: "stdio" })),
		BaseConfigSchema.extend({
			type: z.string().optional(),
			url: z.string().url("URL must be a valid URL format"),
			headers: z.record(z.string()).optional(),
			command: z.undefined().optional(),
			args: z.undefined().optional(),
			env: z.undefined().optional(),
		}).transform((data) => ({ ...data, mcpTransport: "sse" })),
		BaseConfigSchema.extend({
			type: z.string().optional(),
			url: z.string().url("URL must be a valid URL format"),
			headers: z.record(z.string()).optional(),
			command: z.undefined().optional(),
			args: z.undefined().optional(),
			env: z.undefined().optional(),
		}).transform((data) => ({ ...data, mcpTransport: "streamable-http" })),
	])
}

const ServerConfigSchema = createServerTypeSchema()
const McpSettingsSchema = z.object({
	mcpServers: z.record(ServerConfigSchema),
})

const config = {
	mcpServers: {
		md_todo_mcp: {
			command: "node",
			args: ["/Users/m.dusmikeev/Documents/Work/cool/md-roo-roo/md-todo-mcp/build/index.js"],
			type: "interactiveApp",
			uiType: "todo-widget",
			requiresUserInteraction: true,
			autoApproveExcluded: true,
			allowedContext: ["agents"],
			isGloballyVisible: true,
		},
	},
}

const result = McpSettingsSchema.safeParse(config)
console.log(JSON.stringify(result, null, 2))
