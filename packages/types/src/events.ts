import { z } from "zod"

import { clineMessageSchema, queuedMessageSchema, tokenUsageSchema } from "./message.ts"
import { modelInfoSchema } from "./model.ts"
import { toolNamesSchema, toolUsageSchema } from "./tool.ts"

/**
 * JabberwockEventName
 */

export enum JabberwockEventName {
	// Task Provider Lifecycle
	TaskCreated = "taskCreated",

	// Task Lifecycle
	TaskStarted = "taskStarted",
	TaskCompleted = "taskCompleted",
	TaskAborted = "taskAborted",
	TaskFocused = "taskFocused",
	TaskUnfocused = "taskUnfocused",
	TaskActive = "taskActive",
	TaskInteractive = "taskInteractive",
	TaskResumable = "taskResumable",
	TaskIdle = "taskIdle",

	// Subtask Lifecycle
	TaskPaused = "taskPaused",
	TaskUnpaused = "taskUnpaused",
	TaskSpawned = "taskSpawned",
	TaskDelegated = "taskDelegated",
	TaskDelegationCompleted = "taskDelegationCompleted",
	TaskDelegationResumed = "taskDelegationResumed",

	// Task Execution
	Message = "message",
	TaskModeSwitched = "taskModeSwitched",
	TaskAskResponded = "taskAskResponded",
	TaskUserMessage = "taskUserMessage",
	QueuedMessagesUpdated = "queuedMessagesUpdated",

	// Task Analytics
	TaskTokenUsageUpdated = "taskTokenUsageUpdated",
	TaskToolFailed = "taskToolFailed",

	// Configuration Changes
	ModeChanged = "modeChanged",
	ProviderProfileChanged = "providerProfileChanged",

	// Query Responses
	CommandsResponse = "commandsResponse",
	ModesResponse = "modesResponse",
	ModelsResponse = "modelsResponse",

	// Evals
	EvalPass = "evalPass",
	EvalFail = "evalFail",
}

/**
 * JabberwockEvents
 */

export const jabberwockEventsSchema = z.object({
	[JabberwockEventName.TaskCreated]: z.tuple([z.string()]),

	[JabberwockEventName.TaskStarted]: z.tuple([z.string()]),
	[JabberwockEventName.TaskCompleted]: z.tuple([
		z.string(),
		tokenUsageSchema,
		toolUsageSchema,
		z.object({
			isSubtask: z.boolean(),
		}),
	]),
	[JabberwockEventName.TaskAborted]: z.tuple([z.string()]),
	[JabberwockEventName.TaskFocused]: z.tuple([z.string()]),
	[JabberwockEventName.TaskUnfocused]: z.tuple([z.string()]),
	[JabberwockEventName.TaskActive]: z.tuple([z.string()]),
	[JabberwockEventName.TaskInteractive]: z.tuple([z.string()]),
	[JabberwockEventName.TaskResumable]: z.tuple([z.string()]),
	[JabberwockEventName.TaskIdle]: z.tuple([z.string()]),

	[JabberwockEventName.TaskPaused]: z.tuple([z.string()]),
	[JabberwockEventName.TaskUnpaused]: z.tuple([z.string()]),
	[JabberwockEventName.TaskSpawned]: z.tuple([z.string(), z.string()]),
	[JabberwockEventName.TaskDelegated]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
	]),
	[JabberwockEventName.TaskDelegationCompleted]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
		z.string(), // completionResultSummary
	]),
	[JabberwockEventName.TaskDelegationResumed]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
	]),

	[JabberwockEventName.Message]: z.tuple([
		z.object({
			taskId: z.string(),
			action: z.union([z.literal("created"), z.literal("updated")]),
			message: clineMessageSchema,
		}),
	]),
	[JabberwockEventName.TaskModeSwitched]: z.tuple([z.string(), z.string()]),
	[JabberwockEventName.TaskAskResponded]: z.tuple([z.string()]),
	[JabberwockEventName.TaskUserMessage]: z.tuple([z.string()]),
	[JabberwockEventName.QueuedMessagesUpdated]: z.tuple([z.string(), z.array(queuedMessageSchema)]),

	[JabberwockEventName.TaskToolFailed]: z.tuple([z.string(), toolNamesSchema, z.string()]),
	[JabberwockEventName.TaskTokenUsageUpdated]: z.tuple([z.string(), tokenUsageSchema, toolUsageSchema]),

	[JabberwockEventName.ModeChanged]: z.tuple([z.string()]),
	[JabberwockEventName.ProviderProfileChanged]: z.tuple([z.object({ name: z.string(), provider: z.string() })]),

	[JabberwockEventName.CommandsResponse]: z.tuple([
		z.array(
			z.object({
				name: z.string(),
				source: z.enum(["global", "project", "built-in"]),
				filePath: z.string().optional(),
				description: z.string().optional(),
				argumentHint: z.string().optional(),
			}),
		),
	]),
	[JabberwockEventName.ModesResponse]: z.tuple([z.array(z.object({ slug: z.string(), name: z.string() }))]),
	[JabberwockEventName.ModelsResponse]: z.tuple([z.record(z.string(), modelInfoSchema)]),
})

export type JabberwockEvents = z.infer<typeof jabberwockEventsSchema>

/**
 * TaskEvent
 */

export const taskEventSchema = z.discriminatedUnion("eventName", [
	// Task Provider Lifecycle
	z.object({
		eventName: z.literal(JabberwockEventName.TaskCreated),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskCreated],
		taskId: z.number().optional(),
	}),

	// Task Lifecycle
	z.object({
		eventName: z.literal(JabberwockEventName.TaskStarted),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskStarted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskCompleted),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskCompleted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskAborted),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskAborted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskFocused),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskFocused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskUnfocused),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskUnfocused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskActive),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskActive],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskInteractive),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskInteractive],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskResumable),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskResumable],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskIdle),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskIdle],
		taskId: z.number().optional(),
	}),

	// Subtask Lifecycle
	z.object({
		eventName: z.literal(JabberwockEventName.TaskPaused),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskPaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskUnpaused),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskUnpaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskSpawned),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskSpawned],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskDelegated),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskDelegated],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskDelegationCompleted),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskDelegationCompleted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskDelegationResumed),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskDelegationResumed],
		taskId: z.number().optional(),
	}),

	// Task Execution
	z.object({
		eventName: z.literal(JabberwockEventName.Message),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.Message],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskModeSwitched),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskModeSwitched],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskAskResponded),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskAskResponded],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.QueuedMessagesUpdated),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.QueuedMessagesUpdated],
		taskId: z.number().optional(),
	}),

	// Task Analytics
	z.object({
		eventName: z.literal(JabberwockEventName.TaskToolFailed),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskToolFailed],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskTokenUsageUpdated),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskTokenUsageUpdated],
		taskId: z.number().optional(),
	}),

	// Query Responses
	z.object({
		eventName: z.literal(JabberwockEventName.CommandsResponse),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.CommandsResponse],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.ModesResponse),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.ModesResponse],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.ModelsResponse),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.ModelsResponse],
		taskId: z.number().optional(),
	}),

	// Evals
	z.object({
		eventName: z.literal(JabberwockEventName.EvalPass),
		payload: z.undefined(),
		taskId: z.number(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.EvalFail),
		payload: z.undefined(),
		taskId: z.number(),
	}),
])

export type TaskEvent = z.infer<typeof taskEventSchema>
