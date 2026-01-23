/**
 * Personality module for rendering personality-aware instructions.
 *
 * This module provides utilities for:
 * - Loading personality content from markdown files
 * - Rendering templates with personality-specific placeholders
 * - Getting the appropriate instructions based on personality
 *
 * @example
 * ```typescript
 * import {
 *   getAgentInstructions,
 *   hasPersonalityPlaceholder,
 *   PERSONALITY_PLACEHOLDER
 * } from "./personality"
 *
 * // Check if a template supports personality
 * if (hasPersonalityPlaceholder(template)) {
 *   const instructions = getAgentInstructions(agentInfo, Personality.Friendly)
 * }
 * ```
 */

export {
	PERSONALITY_PLACEHOLDER,
	hasPersonalityPlaceholder,
	renderPersonalityTemplate,
	getAgentInstructions,
	createTemplateFromInstructions,
	type AgentInfo,
	type GetAgentInstructionsOptions,
} from "./template-renderer"

export {
	loadPersonalityContent,
	loadSinglePersonalityContent,
	clearPersonalityCache,
	getPersonalitiesDirectory,
} from "./load-personalities"

export {
	PERSONALITY_SPEC_TAG,
	buildPersonalityUpdateMessage,
	buildPersonalityTransitionMessage,
	formatPersonalityName,
	type BuildPersonalityUpdateMessageOptions,
} from "./update-message"
