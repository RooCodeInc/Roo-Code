import { z } from "zod"

/**
 * CommandExecutionStatus
 */

export const commandExecutionStatusSchema = z.discriminatedUnion("status", [
	z.object({
		executionId: z.string(),
		status: z.literal("started"),
		pid: z.number().optional(),
		command: z.string(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("output"),
		output: z.string(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("exited"),
		exitCode: z.number().optional(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("fallback"),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("timeout"),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("service_started"),
		serviceId: z.string(),
		pid: z.number().optional(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("service_ready"),
		serviceId: z.string(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("service_failed"),
		serviceId: z.string(),
		reason: z.string(),
	}),
])

export type CommandExecutionStatus = z.infer<typeof commandExecutionStatusSchema>
