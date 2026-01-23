import { z } from "zod"

/**
 * Personality enum defines the available communication styles for the agent.
 * Each personality represents a distinct approach to interacting with users,
 * allowing for customizable agent behavior while maintaining consistent capabilities.
 *
 * @remarks
 * Personalities affect only the communication style and tone, not the agent's
 * technical abilities or available tools. A friendly agent and a pragmatic agent
 * have the same capabilities, but differ in how they present information.
 *
 * @example
 * ```typescript
 * import { Personality } from "@roo-code/types"
 *
 * const userPreference: Personality = Personality.Friendly
 * ```
 */
export enum Personality {
	/**
	 * Warm, supportive, and team-oriented communication style.
	 * Uses encouraging language, acknowledges user efforts, and creates
	 * a collaborative atmosphere.
	 */
	Friendly = "friendly",

	/**
	 * Direct, efficient, and results-focused communication style.
	 * Minimizes pleasantries in favor of clear, actionable information
	 * and concise responses.
	 */
	Pragmatic = "pragmatic",
}

/**
 * Zod schema for validating Personality enum values.
 * Use this for runtime validation of personality settings.
 *
 * @example
 * ```typescript
 * const result = personalitySchema.safeParse("friendly")
 * if (result.success) {
 *   // result.data is Personality.Friendly
 * }
 * ```
 */
export const personalitySchema = z.nativeEnum(Personality)

/**
 * Type representing a mapping from each personality to its associated message content.
 * Used for storing personality-specific prompts, greetings, or other text content.
 *
 * @remarks
 * This type ensures that all defined personalities have corresponding message content,
 * preventing incomplete personality configurations.
 *
 * @example
 * ```typescript
 * const greetings: PersonalityMessages = {
 *   [Personality.Friendly]: "Hey there! I'm excited to help you today!",
 *   [Personality.Pragmatic]: "Ready. What do you need?"
 * }
 * ```
 */
export type PersonalityMessages = Record<Personality, string>

/**
 * Array of all available personality values.
 * Useful for iteration, validation, and UI components that need to display all options.
 *
 * @example
 * ```typescript
 * PERSONALITIES.forEach(personality => {
 *   console.log(`Available: ${personality}`)
 * })
 * ```
 */
export const PERSONALITIES = Object.values(Personality) as Personality[]

/**
 * Default personality used when no user preference is set.
 */
export const DEFAULT_PERSONALITY = Personality.Friendly

/**
 * Zod schema for validating PersonalityMessages.
 * Ensures all personality keys are present.
 */
export const personalityMessagesSchema = z.record(personalitySchema, z.string())

/**
 * Zod schema for validating InstructionsTemplate.
 */
export const instructionsTemplateSchema = z.object({
	/** Template string containing {{ personality_message }} placeholder */
	template: z.string(),
	/** Optional map of personality identifiers to personality-specific instruction fragments */
	personality_messages: personalityMessagesSchema.optional(),
})

/**
 * Interface representing a template for rendering personality-aware instructions.
 * Templates can contain `{{ personality_message }}` placeholders that will be
 * substituted with personality-specific content at runtime.
 *
 * @remarks
 * When `personality_messages` is not provided, the system will attempt to load
 * personality content from the default markdown files in the personalities directory.
 *
 * @example
 * ```typescript
 * const template: InstructionsTemplate = {
 *   template: "You are an assistant.\n\n{{ personality_message }}\n\nBe helpful.",
 *   personality_messages: {
 *     [Personality.Friendly]: "Be warm and encouraging!",
 *     [Personality.Pragmatic]: "Be direct and efficient."
 *   }
 * }
 * ```
 */
export type InstructionsTemplate = z.infer<typeof instructionsTemplateSchema>

/**
 * Zod schema for validating PersonalityUpdateMessage role.
 * Restricts to "system" or "developer" roles.
 */
export const personalityUpdateMessageRoleSchema = z.enum(["system", "developer"])

/**
 * Zod schema for validating PersonalityUpdateMessage.
 */
export const personalityUpdateMessageSchema = z.object({
	/**
	 * The role for the message. Use "system" for most APIs,
	 * "developer" for APIs that support developer messages.
	 */
	role: personalityUpdateMessageRoleSchema,
	/**
	 * The content containing the personality update instructions,
	 * wrapped in `<personality_spec>` tags.
	 */
	content: z.string(),
})

/**
 * Message structure for mid-session personality updates.
 *
 * This message type is injected into the conversation when the user
 * changes their personality preference mid-session, allowing the agent
 * to adopt a new communication style without regenerating the entire
 * system prompt.
 *
 * The role should be "system" or "developer" depending on the API being used:
 * - "system": For APIs that support system messages (OpenAI, most providers)
 * - "developer": For APIs that use developer messages (some Anthropic contexts)
 *
 * @remarks
 * This is a lightweight approach to personality changes that avoids
 * regenerating the entire system prompt. The message is injected into
 * the conversation history to guide the model's communication style.
 *
 * @example
 * ```typescript
 * const updateMessage: PersonalityUpdateMessage = {
 *   role: "system",
 *   content: `<personality_spec>
 * The user has requested a new communication style.
 *
 * Be warm and encouraging...
 * </personality_spec>`
 * }
 * ```
 */
export type PersonalityUpdateMessage = z.infer<typeof personalityUpdateMessageSchema>
