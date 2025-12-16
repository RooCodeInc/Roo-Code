import { z } from "zod/v4"

/**
 * Re-export Zod v4's JSONSchema type for convenience
 */
export type JsonSchema = z.core.JSONSchema.JSONSchema

/**
 * Zod schema for JSON Schema primitive types
 */
const JsonSchemaPrimitiveTypeSchema = z.enum(["string", "number", "integer", "boolean", "null"])

/**
 * Zod schema for JSON Schema enum values
 */
const JsonSchemaEnumValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

/**
 * Zod schema for validating JSON Schema structures (without transformation).
 * Uses z.lazy for recursive definition.
 *
 * @example
 * ```typescript
 * const result = JsonSchemaSchema.safeParse(schema)
 * if (result.success) {
 *   // schema is valid
 * }
 * ```
 */
export const JsonSchemaSchema: z.ZodType<JsonSchema> = z.lazy(() =>
	z.looseObject({
		type: z.union([JsonSchemaPrimitiveTypeSchema, z.literal("object"), z.literal("array")]).optional(),
		properties: z.record(z.string(), JsonSchemaSchema).optional(),
		items: z.union([JsonSchemaSchema, z.array(JsonSchemaSchema)]).optional(),
		required: z.array(z.string()).optional(),
		additionalProperties: z.union([z.boolean(), JsonSchemaSchema]).optional(),
		description: z.string().optional(),
		default: z.unknown().optional(),
		enum: z.array(JsonSchemaEnumValueSchema).optional(),
		const: JsonSchemaEnumValueSchema.optional(),
		anyOf: z.array(JsonSchemaSchema).optional(),
		oneOf: z.array(JsonSchemaSchema).optional(),
		allOf: z.array(JsonSchemaSchema).optional(),
		$ref: z.string().optional(),
		minimum: z.number().optional(),
		maximum: z.number().optional(),
		minLength: z.number().optional(),
		maxLength: z.number().optional(),
		pattern: z.string().optional(),
		minItems: z.number().optional(),
		maxItems: z.number().optional(),
		uniqueItems: z.boolean().optional(),
	}),
)

/**
 * Zod schema that validates JSON Schema and sets `additionalProperties: false` by default.
 * Uses recursive parsing so the default applies to all nested schemas automatically.
 *
 * This is required by some API providers (e.g., OpenAI) for strict function calling.
 *
 * @example
 * ```typescript
 * // Validates and applies defaults in one pass - throws on invalid
 * const strictSchema = StrictJsonSchemaSchema.parse(schema)
 *
 * // Or use safeParse for error handling
 * const result = StrictJsonSchemaSchema.safeParse(schema)
 * if (result.success) {
 *   // result.data has additionalProperties: false by default
 * }
 * ```
 */
export const StrictJsonSchemaSchema: z.ZodType<JsonSchema> = z.lazy(() =>
	z.looseObject({
		type: z.union([JsonSchemaPrimitiveTypeSchema, z.literal("object"), z.literal("array")]).optional(),
		properties: z.record(z.string(), StrictJsonSchemaSchema).optional(),
		items: z.union([StrictJsonSchemaSchema, z.array(StrictJsonSchemaSchema)]).optional(),
		required: z.array(z.string()).optional(),
		additionalProperties: z.union([z.boolean(), StrictJsonSchemaSchema]).default(false),
		description: z.string().optional(),
		default: z.unknown().optional(),
		enum: z.array(JsonSchemaEnumValueSchema).optional(),
		const: JsonSchemaEnumValueSchema.optional(),
		anyOf: z.array(StrictJsonSchemaSchema).optional(),
		oneOf: z.array(StrictJsonSchemaSchema).optional(),
		allOf: z.array(StrictJsonSchemaSchema).optional(),
		$ref: z.string().optional(),
		minimum: z.number().optional(),
		maximum: z.number().optional(),
		minLength: z.number().optional(),
		maxLength: z.number().optional(),
		pattern: z.string().optional(),
		minItems: z.number().optional(),
		maxItems: z.number().optional(),
		uniqueItems: z.boolean().optional(),
	}),
)
