import { z } from "zod"

/**
 * Basic checkpoint schema (original)
 */
export const checkpointSchema = z.object({
	from: z.string(),
	to: z.string(),
})

export type Checkpoint = z.infer<typeof checkpointSchema>

/**
 * Checkpoint category enum
 */
export const CheckpointCategoryEnum = z.enum(["auto", "manual", "milestone", "experiment", "backup", "recovery"])

export type CheckpointCategory = z.infer<typeof CheckpointCategoryEnum>

/**
 * Checkpoint stats schema
 */
export const checkpointStatsSchema = z.object({
	filesChanged: z.number(),
	additions: z.number(),
	deletions: z.number(),
})

export type CheckpointStats = z.infer<typeof checkpointStatsSchema>

/**
 * Enhanced checkpoint metadata schema for UI
 */
export const checkpointMetadataSchema = z.object({
	id: z.string(),
	commitHash: z.string(),
	taskId: z.string(),
	timestamp: z.string(), // ISO string
	name: z.string().optional(),
	description: z.string().optional(),
	tags: z.array(z.string()).default([]),
	category: CheckpointCategoryEnum.default("auto"),
	stats: checkpointStatsSchema,
	isStarred: z.boolean().default(false),
	isLocked: z.boolean().default(false),
})

export type CheckpointMetadataUI = z.infer<typeof checkpointMetadataSchema>

/**
 * Checkpoint timeline response schema
 */
export const checkpointTimelineSchema = z.object({
	checkpoints: z.array(checkpointMetadataSchema),
	currentCheckpointId: z.string().optional(),
	totalCount: z.number(),
})

export type CheckpointTimelineResponse = z.infer<typeof checkpointTimelineSchema>
