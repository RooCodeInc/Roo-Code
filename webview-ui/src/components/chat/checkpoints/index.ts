/**
 * Checkpoint Components Index
 * Re-exports all checkpoint components and types
 */

// Existing components
export { CheckpointMenu } from "./CheckpointMenu"
export { CheckpointSaved } from "./CheckpointSaved"

// New enhanced components
export { CheckpointTimeline } from "./CheckpointTimeline"
export type { CheckpointMetadataUI, TimelineViewMode } from "./CheckpointTimeline"
export { CheckpointNode } from "./CheckpointNode"
export { CheckpointView } from "./CheckpointView"

// Schema and types
export {
	checkpointSchema,
	checkpointMetadataSchema,
	checkpointStatsSchema,
	checkpointTimelineSchema,
	CheckpointCategoryEnum,
} from "./schema"
export type {
	Checkpoint,
	CheckpointMetadataUI as CheckpointMetadata,
	CheckpointStats,
	CheckpointCategory,
	CheckpointTimelineResponse,
} from "./schema"

// Styles
import "./styles/timeline.css"
import "./styles/animations.css"
