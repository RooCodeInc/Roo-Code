/**
 * Generates the JSON Schema for .roomodes configuration files from the Zod
 * schemas defined in packages/types/src/mode.ts.
 *
 * This ensures the schema stays in sync with the TypeScript types. Run via:
 *   pnpm --filter @roo-code/types generate:schema
 *
 * The output is written to schemas/roomodes.json at the repository root.
 */

import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import { zodToJsonSchema } from "zod-to-json-schema"
import { z } from "zod"

import { toolGroups, deprecatedToolGroups } from "../src/tool.js"
import { groupOptionsSchema, modeConfigSchema } from "../src/mode.js"

// ---------------------------------------------------------------------------
// 1. Build a ToolGroup enum that includes deprecated groups so existing
//    configs still validate.
// ---------------------------------------------------------------------------
const allToolGroups = [...toolGroups, ...deprecatedToolGroups] as [string, ...string[]]
const allToolGroupsSchema = z.enum(allToolGroups)

// ---------------------------------------------------------------------------
// 2. Build a GroupEntry schema that uses the extended tool group list.
// ---------------------------------------------------------------------------
const groupEntrySchema = z.union([allToolGroupsSchema, z.tuple([allToolGroupsSchema, groupOptionsSchema])])

// ---------------------------------------------------------------------------
// 3. Build the RuleFile schema (used during import/export but not part of
//    the core Zod types).
// ---------------------------------------------------------------------------
const ruleFileSchema = z.object({
	relativePath: z.string(),
	content: z.string().optional(),
})

// ---------------------------------------------------------------------------
// 4. Build an extended ModeConfig schema that includes rulesFiles and uses
//    the extended groups (with deprecated entries).
// ---------------------------------------------------------------------------
const exportedModeConfigSchema = modeConfigSchema.omit({ groups: true }).extend({
	groups: z.array(groupEntrySchema),
	rulesFiles: z.array(ruleFileSchema).optional(),
})

// ---------------------------------------------------------------------------
// 5. Build the top-level .roomodes schema.
// ---------------------------------------------------------------------------
const roomodesSchema = z
	.object({
		customModes: z.array(exportedModeConfigSchema),
	})
	.strict()

// ---------------------------------------------------------------------------
// 6. Convert to JSON Schema (draft-07).
// ---------------------------------------------------------------------------
const jsonSchema = zodToJsonSchema(roomodesSchema, {
	$refStrategy: "none",
	target: "jsonSchema7",
}) as Record<string, unknown>

// ---------------------------------------------------------------------------
// 7. Add metadata.
// ---------------------------------------------------------------------------
jsonSchema["$id"] = "https://github.com/RooCodeInc/Roo-Code/blob/main/schemas/roomodes.json"
jsonSchema["title"] = "Roo Code Custom Modes"
jsonSchema["description"] = "Schema for .roomodes configuration files used by Roo Code to define custom modes."

// ---------------------------------------------------------------------------
// 8. Write to disk.
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../../..")
const outPath = path.join(repoRoot, "schemas", "roomodes.json")
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(jsonSchema, null, "\t") + "\n", "utf-8")

console.log(`Generated ${path.relative(repoRoot, outPath)}`)
