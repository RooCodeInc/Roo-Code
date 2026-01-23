/**
 * Utilities for building mid-session personality update messages.
 *
 * This module provides functions to create messages that can be injected
 * into a conversation to change the agent's communication style without
 * regenerating the entire system prompt.
 *
 * @module
 */

import { Personality, PersonalityMessages, PersonalityUpdateMessage } from "@roo-code/types"

/**
 * XML tag used to wrap personality update instructions.
 * This tag helps the model identify and parse personality directives.
 */
export const PERSONALITY_SPEC_TAG = "personality_spec"

/**
 * Options for building a personality update message.
 */
export interface BuildPersonalityUpdateMessageOptions {
	/**
	 * The role to use for the message.
	 * - "system": For APIs that support system messages (OpenAI, most providers)
	 * - "developer": For APIs that use developer messages (some contexts)
	 * @default "system"
	 */
	role?: "system" | "developer"
}

/**
 * Builds a personality update message that can be injected into a conversation
 * to change the agent's communication style mid-session.
 *
 * The message is wrapped in `<personality_spec>` tags to clearly delineate
 * the personality instructions from other content.
 *
 * @param newPersonality - The personality to switch to
 * @param personalityMessages - A mapping of personalities to their instruction content
 * @param options - Optional configuration for the message
 * @returns A PersonalityUpdateMessage ready to be injected into the conversation
 *
 * @example
 * ```typescript
 * const message = buildPersonalityUpdateMessage(
 *   Personality.Pragmatic,
 *   {
 *     [Personality.Friendly]: "Be warm and encouraging...",
 *     [Personality.Pragmatic]: "Be direct and efficient..."
 *   }
 * )
 * // Result:
 * // {
 * //   role: "system",
 * //   content: "<personality_spec>\nThe user has requested a new communication style.\n\nBe direct and efficient...\n</personality_spec>"
 * // }
 * ```
 */
export function buildPersonalityUpdateMessage(
	newPersonality: Personality,
	personalityMessages: PersonalityMessages,
	options: BuildPersonalityUpdateMessageOptions = {},
): PersonalityUpdateMessage {
	const { role = "system" } = options

	const personalityInstructions = personalityMessages[newPersonality]

	const content = `<${PERSONALITY_SPEC_TAG}>
The user has requested a new communication style.

${personalityInstructions}
</${PERSONALITY_SPEC_TAG}>`

	return {
		role,
		content,
	}
}

/**
 * Formats a personality name for display in messages.
 * Capitalizes the first letter of the personality identifier.
 *
 * @param personality - The personality to format
 * @returns A formatted, human-readable personality name
 *
 * @example
 * ```typescript
 * formatPersonalityName(Personality.Friendly) // "Friendly"
 * formatPersonalityName(Personality.Pragmatic) // "Pragmatic"
 * ```
 */
export function formatPersonalityName(personality: Personality): string {
	return personality.charAt(0).toUpperCase() + personality.slice(1)
}

/**
 * Builds a personality update message with additional context about the transition.
 * This variant includes information about both the previous and new personality
 * for smoother transitions.
 *
 * @param previousPersonality - The personality the agent was using
 * @param newPersonality - The personality to switch to
 * @param personalityMessages - A mapping of personalities to their instruction content
 * @param options - Optional configuration for the message
 * @returns A PersonalityUpdateMessage with transition context
 *
 * @example
 * ```typescript
 * const message = buildPersonalityTransitionMessage(
 *   Personality.Friendly,
 *   Personality.Pragmatic,
 *   personalityMessages
 * )
 * ```
 */
export function buildPersonalityTransitionMessage(
	previousPersonality: Personality,
	newPersonality: Personality,
	personalityMessages: PersonalityMessages,
	options: BuildPersonalityUpdateMessageOptions = {},
): PersonalityUpdateMessage {
	const { role = "system" } = options

	const personalityInstructions = personalityMessages[newPersonality]
	const previousName = formatPersonalityName(previousPersonality)
	const newName = formatPersonalityName(newPersonality)

	const content = `<${PERSONALITY_SPEC_TAG}>
The user has requested a change in communication style from "${previousName}" to "${newName}".

Please adopt the following communication approach going forward:

${personalityInstructions}
</${PERSONALITY_SPEC_TAG}>`

	return {
		role,
		content,
	}
}
