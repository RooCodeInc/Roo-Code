import { z } from "zod"
import traverse from "json-schema-traverse"

/**
 * Type representing a JSON Schema structure
 */
export interface JsonSchema {
	type?: "string" | "number" | "integer" | "boolean" | "null" | "object" | "array"
	properties?: Record<string, JsonSchema>
	items?: JsonSchema | JsonSchema[]
	required?: string[]
	additionalProperties?: boolean | JsonSchema
	description?: string
	default?: unknown
	enum?: unknown[]
	const?: unknown
	anyOf?: JsonSchema[]
	oneOf?: JsonSchema[]
	allOf?: JsonSchema[]
	$ref?: string
	minimum?: number
	maximum?: number
	minLength?: number
	maxLength?: number
	pattern?: string
	minItems?: number
	maxItems?: number
	uniqueItems?: boolean
	[key: string]: unknown // Allow additional properties
}

/**
 * Zod schema for JSON Schema primitive types
 */
const JsonSchemaPrimitiveTypeSchema = z.enum(["string", "number", "integer", "boolean", "null"])

/**
 * Zod schema for validating JSON Schema structures.
 * Uses z.lazy for recursive definition with explicit type annotation.
 */
export const JsonSchemaSchema: z.ZodType<JsonSchema> = z.lazy(() =>
	z
		.object({
			type: z.union([JsonSchemaPrimitiveTypeSchema, z.literal("object"), z.literal("array")]).optional(),
			properties: z.record(z.string(), JsonSchemaSchema).optional(),
			items: z.union([JsonSchemaSchema, z.array(JsonSchemaSchema)]).optional(),
			required: z.array(z.string()).optional(),
			additionalProperties: z.union([z.boolean(), JsonSchemaSchema]).optional(),
			description: z.string().optional(),
			default: z.unknown().optional(),
			enum: z.array(z.unknown()).optional(),
			const: z.unknown().optional(),
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
		})
		.passthrough(),
)

/**
 * Callback function for schema transformation
 */
export type SchemaTransformCallback = (subSchema: Record<string, unknown>) => void

/**
 * Validates that an object is a valid JSON Schema.
 *
 * @param schema - The object to validate
 * @returns The validated schema if valid, null otherwise
 *
 * @example
 * ```typescript
 * const schema = { type: "object", properties: { name: { type: "string" } } }
 * const validated = validateJsonSchema(schema)
 * if (validated) {
 *   // schema is valid, use it
 * }
 * ```
 */
export function validateJsonSchema(schema: unknown): JsonSchema | null {
	const result = JsonSchemaSchema.safeParse(schema)
	return result.success ? result.data : null
}

/**
 * Type guard to check if a value is a valid JSON Schema.
 *
 * @param schema - The value to check
 * @returns true if the value is a valid JSON Schema
 */
export function isJsonSchema(schema: unknown): schema is JsonSchema {
	return JsonSchemaSchema.safeParse(schema).success
}

/**
 * Transforms a JSON Schema by visiting all sub-schemas and applying a callback.
 * Uses `json-schema-traverse` for robust traversal of all JSON Schema constructs.
 *
 * @param schema - The JSON Schema to transform
 * @param callback - Function to call on each sub-schema (can mutate the sub-schema)
 * @returns A new transformed schema (original is not mutated)
 *
 * @example
 * ```typescript
 * // Add a custom property to all object schemas
 * const result = transformJsonSchema(schema, (subSchema) => {
 *   if (subSchema.type === "object") {
 *     subSchema.myCustomProp = true
 *   }
 * })
 * ```
 */
export function transformJsonSchema(
	schema: Record<string, unknown>,
	callback: SchemaTransformCallback,
): Record<string, unknown> {
	if (typeof schema !== "object" || schema === null) {
		return schema
	}

	// Deep clone to avoid mutating the original
	const cloned = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>

	// Use json-schema-traverse to visit all sub-schemas
	traverse(cloned, {
		allKeys: true,
		cb: callback,
	})

	return cloned
}

/**
 * Recursively adds `additionalProperties: false` to all object schemas.
 * This is required by some API providers (e.g., OpenAI) for strict function calling.
 *
 * @param schema - The JSON Schema to transform
 * @returns A new schema with `additionalProperties: false` on all object schemas
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: "object",
 *   properties: {
 *     users: {
 *       type: "array",
 *       items: { type: "object", properties: { name: { type: "string" } } }
 *     }
 *   }
 * }
 *
 * const result = addAdditionalPropertiesFalse(schema)
 * // All nested object schemas now have additionalProperties: false
 * ```
 */
export function addAdditionalPropertiesFalse(schema: Record<string, unknown>): Record<string, unknown> {
	return transformJsonSchema(schema, (subSchema) => {
		if (subSchema.type === "object") {
			subSchema.additionalProperties = false
		}
	})
}

/**
 * Validates a schema and then transforms it to add `additionalProperties: false`.
 * Throws if the schema is invalid.
 *
 * @param schema - The schema to validate and transform
 * @returns The validated and transformed schema
 * @throws ZodError if the schema is invalid
 *
 * @example
 * ```typescript
 * try {
 *   const result = validateAndAddAdditionalPropertiesFalse(schema)
 *   // Use the validated and transformed schema
 * } catch (error) {
 *   // Handle invalid schema
 * }
 * ```
 */
export function validateAndAddAdditionalPropertiesFalse(schema: unknown): Record<string, unknown> {
	JsonSchemaSchema.parse(schema) // Throws if invalid
	return addAdditionalPropertiesFalse(schema as Record<string, unknown>)
}
