/**
 * Personality section for system prompt.
 * Uses the sandwich technique: personality at the TOP and reinforced at the BOTTOM.
 */
import { buildPersonalityPrompt, buildPersonalityPromptParts } from "../../../shared/personality-traits"

export { mergeTraitPrompts, buildPersonalityPromptParts } from "../../../shared/personality-traits"

export const getPersonalitySection = buildPersonalityPrompt
