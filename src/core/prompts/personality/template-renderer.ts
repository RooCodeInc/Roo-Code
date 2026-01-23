import { type Personality, type PersonalityMessages, type InstructionsTemplate, PERSONALITIES } from "@roo-code/types"

import { loadPersonalityContent } from "./load-personalities"

/**
 * Validates that a partial personality messages object has content for all personalities.
 *
 * @param messages - Partial record that may be missing some personality keys
 * @returns The messages as a complete PersonalityMessages if valid, undefined otherwise
 */
function validatePersonalityMessages(
	messages: Partial<Record<Personality, string>> | undefined,
): PersonalityMessages | undefined {
	if (!messages) {
		return undefined
	}

	// Check that all personalities have content
	for (const personality of PERSONALITIES) {
		if (!messages[personality]) {
			return undefined
		}
	}

	return messages as PersonalityMessages
}

/**
 * The placeholder pattern used in templates for personality-specific content.
 * Templates should include this exact string where personality content should be injected.
 */
export const PERSONALITY_PLACEHOLDER = "{{ personality_message }}"

/**
 * Checks if a template string contains the personality placeholder.
 *
 * @param template - The template string to check
 * @returns True if the template contains the personality placeholder
 *
 * @example
 * ```typescript
 * hasPersonalityPlaceholder("Hello {{ personality_message }}") // true
 * hasPersonalityPlaceholder("Hello world") // false
 * ```
 */
export function hasPersonalityPlaceholder(template: string): boolean {
	return template.includes(PERSONALITY_PLACEHOLDER)
}

/**
 * Renders a template by replacing the personality placeholder with
 * the appropriate personality-specific content.
 *
 * @param template - The template string containing the placeholder
 * @param personality - The personality to use for content lookup
 * @param personalityMessages - Map of personality types to their message content
 * @returns The rendered template with personality content substituted
 *
 * @example
 * ```typescript
 * const template = "You are an assistant.\n\n{{ personality_message }}\n\nBe helpful."
 * const messages: PersonalityMessages = {
 *   friendly: "Be warm and encouraging!",
 *   pragmatic: "Be direct and efficient."
 * }
 * renderPersonalityTemplate(template, Personality.Friendly, messages)
 * // "You are an assistant.\n\nBe warm and encouraging!\n\nBe helpful."
 * ```
 */
export function renderPersonalityTemplate(
	template: string,
	personality: Personality,
	personalityMessages: PersonalityMessages,
): string {
	const personalityContent = personalityMessages[personality] ?? ""
	return template.replace(PERSONALITY_PLACEHOLDER, personalityContent)
}

/**
 * Agent information structure containing base instructions and optional template.
 */
export interface AgentInfo {
	/** Base instructions that apply regardless of personality */
	base_instructions: string
	/** Optional template for personality-aware instructions */
	instructions_template?: InstructionsTemplate
}

/**
 * Options for getAgentInstructions function.
 */
export interface GetAgentInstructionsOptions {
	/** Optional logger for warnings */
	logger?: { warn: (message: string) => void }
}

/**
 * Gets the final agent instructions, applying personality templating when available.
 *
 * This function handles the logic for determining which instructions to return:
 * 1. If no personality is specified, returns base_instructions
 * 2. If personality is specified but no template exists, returns base_instructions
 * 3. If template exists but has no placeholder, logs warning and returns base_instructions
 * 4. If template exists with placeholder, renders and returns personality-aware instructions
 *
 * When `personality_messages` is not provided in the template, it will attempt
 * to load content from the default personality markdown files.
 *
 * @param agentInfo - Object containing base_instructions and optional instructions_template
 * @param personality - Optional personality to apply
 * @param options - Optional configuration (e.g., custom logger)
 * @returns The appropriate instructions string for the agent
 *
 * @example
 * ```typescript
 * // With personality template
 * const agentInfo: AgentInfo = {
 *   base_instructions: "Default instructions",
 *   instructions_template: {
 *     template: "Custom {{ personality_message }} instructions",
 *     personality_messages: {
 *       friendly: "friendly and warm",
 *       pragmatic: "direct and efficient"
 *     }
 *   }
 * }
 * getAgentInstructions(agentInfo, Personality.Friendly)
 * // "Custom friendly and warm instructions"
 *
 * // Without template - falls back to base instructions
 * getAgentInstructions({ base_instructions: "Default" }, Personality.Friendly)
 * // "Default"
 * ```
 */
export function getAgentInstructions(
	agentInfo: AgentInfo,
	personality?: Personality,
	options?: GetAgentInstructionsOptions,
): string {
	const { base_instructions, instructions_template } = agentInfo
	const logger = options?.logger ?? console

	// If no personality requested, return base instructions
	if (!personality) {
		return base_instructions
	}

	// If no template available, return base instructions
	if (!instructions_template) {
		return base_instructions
	}

	const { template, personality_messages } = instructions_template

	// If template doesn't have the placeholder, warn and return base instructions
	if (!hasPersonalityPlaceholder(template)) {
		logger.warn(
			`[personality] Template does not contain placeholder "${PERSONALITY_PLACEHOLDER}". ` +
				`Falling back to base_instructions.`,
		)
		return base_instructions
	}

	// Get personality messages - either from template or load from files
	let messages: PersonalityMessages | undefined = validatePersonalityMessages(personality_messages)

	// If no inline messages provided, load from markdown files
	if (!messages) {
		messages = loadPersonalityContent()

		// If still no messages, warn and return base instructions
		if (!messages) {
			logger.warn(
				`[personality] Failed to load personality content for "${personality}". ` +
					`Falling back to base_instructions.`,
			)
			return base_instructions
		}
	}

	// Ensure the requested personality has content
	if (!messages[personality]) {
		logger.warn(
			`[personality] No content found for personality "${personality}". ` + `Falling back to base_instructions.`,
		)
		return base_instructions
	}

	return renderPersonalityTemplate(template, personality, messages)
}

/**
 * Creates an InstructionsTemplate from base instructions by wrapping them
 * with the personality placeholder.
 *
 * This is useful for modes that want to prepend or append personality content
 * to their existing instructions.
 *
 * @param baseInstructions - The original instructions to wrap
 * @param position - Where to place the personality content ("before" or "after")
 * @returns An InstructionsTemplate with the placeholder positioned appropriately
 *
 * @example
 * ```typescript
 * const template = createTemplateFromInstructions("Be helpful.", "before")
 * // template.template = "{{ personality_message }}\n\nBe helpful."
 * ```
 */
export function createTemplateFromInstructions(
	baseInstructions: string,
	position: "before" | "after" = "before",
): InstructionsTemplate {
	const template =
		position === "before"
			? `${PERSONALITY_PLACEHOLDER}\n\n${baseInstructions}`
			: `${baseInstructions}\n\n${PERSONALITY_PLACEHOLDER}`

	return { template }
}
