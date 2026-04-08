/**
 * Builds the Zod schema for .roomodes configuration files and converts it
 * to JSON Schema (draft-07). This module is the single source of truth for
 * both the generator script (scripts/generate-roomodes-schema.ts) and the
 * drift-detection test.
 */

import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

import { toolGroups, deprecatedToolGroups } from "./tool.js"
import { groupOptionsSchema, modeConfigSchema } from "./mode.js"

// Build a ToolGroup enum that includes deprecated groups so existing configs
// still validate.
const allToolGroups = [...toolGroups, ...deprecatedToolGroups] as [string, ...string[]]
const allToolGroupsSchema = z.enum(allToolGroups)

// Build a GroupEntry schema that uses the extended tool group list.
const groupEntrySchema = z.union([allToolGroupsSchema, z.tuple([allToolGroupsSchema, groupOptionsSchema])])

// Build the RuleFile schema (used during import/export but not part of the
// core Zod types).
const ruleFileSchema = z.object({
	relativePath: z.string(),
	content: z.string().optional(),
})

// Build an extended ModeConfig schema that includes rulesFiles and uses the
// extended groups (with deprecated entries).
const exportedModeConfigSchema = modeConfigSchema.omit({ groups: true }).extend({
	groups: z.array(groupEntrySchema),
	rulesFiles: z.array(ruleFileSchema).optional(),
})

// Build the top-level .roomodes schema.
const roomodesZodSchema = z
	.object({
		customModes: z.array(exportedModeConfigSchema),
	})
	.strict()

/**
 * Generates the JSON Schema object for .roomodes configuration files.
 * Includes metadata fields ($id, title, description).
 */
export function generateRoomodesJsonSchema(): Record<string, unknown> {
	const jsonSchema = zodToJsonSchema(roomodesZodSchema, {
		$refStrategy: "none",
		target: "jsonSchema7",
	}) as Record<string, unknown>

	jsonSchema["$id"] = "https://github.com/RooCodeInc/Roo-Code/blob/main/schemas/roomodes.json"
	jsonSchema["title"] = "Roo Code Custom Modes"
	jsonSchema["description"] = "Schema for .roomodes configuration files used by Roo Code to define custom modes."

	return jsonSchema
}
