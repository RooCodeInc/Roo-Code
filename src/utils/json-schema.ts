import type { z as z4 } from "zod/v4"
import { z } from "zod"

/**
 * Re-export Zod v4's JSONSchema type for convenience
 */
export type JsonSchema = z4.core.JSONSchema.JSONSchema

/**
 * Zod schema for JSON Schema primitive types
 */
const JsonSchemaPrimitiveTypeSchema = z.enum(["string", "number", "integer", "boolean", "null"])

/**
 * Zod schema for JSON Schema enum values
 */
const JsonSchemaEnumValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

/**
 * Zod schema that validates tool input JSON Schema and sets `additionalProperties: false` by default.
 * Uses recursive parsing so the default applies to all nested schemas automatically.
 *
 * This is required by some API providers (e.g., OpenAI) for strict function calling.
 *
 * @example
 * ```typescript
 * // Validates and applies defaults in one pass - throws on invalid
 * const validatedSchema = ToolInputSchema.parse(schema)
 *
 * // Or use safeParse for error handling
 * const result = ToolInputSchema.safeParse(schema)
 * if (result.success) {
 *   // result.data has additionalProperties: false by default
 * }
 * ```
 */
export const ToolInputSchema: z.ZodType<JsonSchema> = z.lazy(() =>
	z
		.object({
			type: z.union([JsonSchemaPrimitiveTypeSchema, z.literal("object"), z.literal("array")]).optional(),
			properties: z.record(z.string(), ToolInputSchema).optional(),
			items: z.union([ToolInputSchema, z.array(ToolInputSchema)]).optional(),
			required: z.array(z.string()).optional(),
			additionalProperties: z.union([z.boolean(), ToolInputSchema]).default(false),
			description: z.string().optional(),
			default: z.unknown().optional(),
			enum: z.array(JsonSchemaEnumValueSchema).optional(),
			const: JsonSchemaEnumValueSchema.optional(),
			anyOf: z.array(ToolInputSchema).optional(),
			oneOf: z.array(ToolInputSchema).optional(),
			allOf: z.array(ToolInputSchema).optional(),
			$ref: z.string().optional(),
			minimum: z.number().optional(),
			maximum: z.number().optional(),
			minLength: z.number().optional(),
			maxLength: z.number().optional(),
			pattern: z.string().optional(),
			minItems: z.number().optional(),
			maxItems: z.number().optional(),
			uniqueItems: z.boolean().optional(),
		})
		.passthrough(),
)
