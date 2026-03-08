import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import { zodToJsonSchema } from "zod-to-json-schema"
import { z } from "zod"

import { toolGroups, deprecatedToolGroups } from "../tool.js"
import { groupOptionsSchema, modeConfigSchema } from "../mode.js"

/**
 * This test verifies that the checked-in schemas/roomodes.json matches what
 * would be generated from the current Zod schemas. If this test fails, run:
 *
 *   pnpm --filter @roo-code/types generate:schema
 *
 * to regenerate the schema file.
 */
describe("roomodes schema sync", () => {
	it("should match the dynamically generated schema from Zod types", () => {
		const __dirname = path.dirname(fileURLToPath(import.meta.url))
		const schemaPath = path.resolve(__dirname, "../../../../schemas/roomodes.json")
		const checkedIn = JSON.parse(fs.readFileSync(schemaPath, "utf-8"))

		// Reproduce the same generation logic as scripts/generate-roomodes-schema.ts
		const allToolGroups = [...toolGroups, ...deprecatedToolGroups] as [string, ...string[]]
		const allToolGroupsSchema = z.enum(allToolGroups)
		const groupEntrySchema = z.union([allToolGroupsSchema, z.tuple([allToolGroupsSchema, groupOptionsSchema])])
		const ruleFileSchema = z.object({
			relativePath: z.string(),
			content: z.string().optional(),
		})
		const exportedModeConfigSchema = modeConfigSchema.omit({ groups: true }).extend({
			groups: z.array(groupEntrySchema),
			rulesFiles: z.array(ruleFileSchema).optional(),
		})
		const roomodesSchema = z
			.object({
				customModes: z.array(exportedModeConfigSchema),
			})
			.strict()

		const generated = zodToJsonSchema(roomodesSchema, {
			$refStrategy: "none",
			target: "jsonSchema7",
		}) as Record<string, unknown>

		generated["$id"] = "https://github.com/RooCodeInc/Roo-Code/blob/main/schemas/roomodes.json"
		generated["title"] = "Roo Code Custom Modes"
		generated["description"] = "Schema for .roomodes configuration files used by Roo Code to define custom modes."

		expect(checkedIn).toEqual(generated)
	})
})
