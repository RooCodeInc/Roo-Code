const { z } = require("zod")
const BaseConfigSchema = z
	.object({
		disabled: z.boolean().optional(),
		timeout: z.number().min(1).max(3600).optional().default(60),
		alwaysAllow: z.array(z.string()).default([]),
		disabledTools: z.array(z.string()).default([]),
	})
	.passthrough()
const ServerConfigSchema = z.union([
	BaseConfigSchema.extend({
		type: z.string().optional(),
		command: z.string().min(1, "Command cannot be empty"),
		args: z.array(z.string()).optional(),
		cwd: z.string().optional(),
		env: z.record(z.string()).optional(),
		url: z.undefined().optional(),
		headers: z.undefined().optional(),
	}).transform((d) => ({ ...d, mcpTransport: "stdio" })),
])
const res = z.object({ mcpServers: z.record(ServerConfigSchema) }).safeParse({
	mcpServers: {
		"md-todo-mcp": {
			command: "node",
			args: ["/index.js"],
			type: "interactiveApp",
			requiresUserInteraction: true,
			autoApproveExcluded: true,
			allowedContext: ["agents"],
			isGloballyVisible: false,
		},
	},
})
console.log(JSON.stringify(res, null, 2))
