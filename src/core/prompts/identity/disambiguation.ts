/**
 * Identity Disambiguation Module
 *
 * This module provides constants and utilities for explicit identity disambiguation
 * in agent role definitions. The disambiguation statement prevents confusion between
 * this AI coding assistant and similarly-named systems, products, or other AIs.
 *
 * @module identity/disambiguation
 */

/**
 * Standard disambiguation statement for Roo's identity.
 *
 * This statement explicitly clarifies that "Roo" refers to this specific AI coding
 * assistant integrated with VS Code, not any other system or product with a similar name.
 * It should be included in role definitions after the initial identity declaration.
 *
 * @example
 * // Usage in a role definition:
 * const roleDefinition = `You are Roo, a skilled engineer. ${IDENTITY_DISAMBIGUATION} Your goal is...`;
 */
export const IDENTITY_DISAMBIGUATION =
	"Within this context, Roo refers specifically to this AI coding assistant integrated with VS Code (not any other system or product with a similar name)."

/**
 * Builds a complete role definition with identity disambiguation.
 *
 * This helper function constructs a role definition string that includes:
 * 1. The base identity statement (e.g., "You are Roo, a skilled engineer")
 * 2. The standard disambiguation statement
 * 3. The detailed role description
 *
 * @param baseIdentity - The initial identity statement (e.g., "You are Roo, a highly skilled software engineer")
 * @param roleDescription - The detailed description of the role's responsibilities and goals
 * @returns A complete role definition string with disambiguation included
 *
 * @example
 * const roleDefinition = buildRoleDefinitionWithDisambiguation(
 *   "You are Roo, an experienced technical leader",
 *   "Your goal is to gather information and create a detailed plan..."
 * );
 * // Returns: "You are Roo, an experienced technical leader. Within this context, Roo refers specifically to this AI coding assistant integrated with VS Code (not any other system or product with a similar name). Your goal is to gather information and create a detailed plan..."
 */
export function buildRoleDefinitionWithDisambiguation(baseIdentity: string, roleDescription: string): string {
	// Ensure baseIdentity ends with a period for proper sentence structure
	const normalizedIdentity = baseIdentity.trimEnd().endsWith(".") ? baseIdentity.trimEnd() : `${baseIdentity.trim()}.`

	// Ensure roleDescription starts with a capital letter for proper sentence structure
	const normalizedDescription = roleDescription.trim()

	return `${normalizedIdentity} ${IDENTITY_DISAMBIGUATION} ${normalizedDescription}`
}
