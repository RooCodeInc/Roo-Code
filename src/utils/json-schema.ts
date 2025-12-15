import { z } from "zod"

/**
 * Type representing a JSON Schema structure
 * Defined first so we can reference it in the Zod schema
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
 * Zod schema for validating JSON Schema structures
 * Uses z.lazy for recursive definition with explicit type casting
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
 * Result of schema validation
 */
export type ValidationResult<T> = { success: true; data: T } | { success: false; error: z.ZodError }

/**
 * JSON Schema utility class for validation and transformation
 *
 * @example
 * ```typescript
 * const schema = { type: "object", properties: { name: { type: "string" } } }
 *
 * // Validate schema
 * const result = JsonSchemaUtils.validate(schema)
 * if (result.success) {
 *   // Use validated schema
 *   const transformed = JsonSchemaUtils.addAdditionalPropertiesFalse(result.data)
 * }
 *
 * // Or transform directly (throws on invalid schema)
 * const transformed = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)
 * ```
 */
export class JsonSchemaUtils {
	/**
	 * Validates that an object conforms to JSON Schema structure
	 *
	 * @param schema - The object to validate
	 * @returns Validation result with typed data or error
	 */
	static validate(schema: unknown): ValidationResult<JsonSchema> {
		const result = JsonSchemaSchema.safeParse(schema)
		if (result.success) {
			return { success: true, data: result.data }
		}
		return { success: false, error: result.error }
	}

	/**
	 * Validates and throws if invalid
	 *
	 * @param schema - The object to validate
	 * @returns Validated JSON Schema
	 * @throws ZodError if validation fails
	 */
	static validateOrThrow(schema: unknown): JsonSchema {
		return JsonSchemaSchema.parse(schema)
	}

	/**
	 * Recursively adds `additionalProperties: false` to all object schemas.
	 * This is required by some API providers (e.g., OpenAI) for strict function calling.
	 *
	 * @param schema - The JSON Schema to transform (can be unvalidated, will be coerced)
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
	 * const result = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)
	 * // Result: all object schemas now have additionalProperties: false
	 * ```
	 */
	static addAdditionalPropertiesFalse(schema: Record<string, unknown>): Record<string, unknown> {
		if (typeof schema !== "object" || schema === null) {
			return schema
		}

		// Create a shallow copy to avoid mutating the original
		const result: Record<string, unknown> = { ...schema }

		// If this is an object schema, add additionalProperties: false
		if (result.type === "object") {
			result.additionalProperties = false
		}

		// Recursively process properties
		if (result.properties && typeof result.properties === "object") {
			const properties = result.properties as Record<string, unknown>
			const newProperties: Record<string, unknown> = {}
			for (const key of Object.keys(properties)) {
				const value = properties[key]
				if (typeof value === "object" && value !== null) {
					newProperties[key] = this.addAdditionalPropertiesFalse(value as Record<string, unknown>)
				} else {
					newProperties[key] = value
				}
			}
			result.properties = newProperties
		}

		// Recursively process items (for arrays)
		if (result.items && typeof result.items === "object") {
			if (Array.isArray(result.items)) {
				result.items = result.items.map((item) =>
					typeof item === "object" && item !== null
						? this.addAdditionalPropertiesFalse(item as Record<string, unknown>)
						: item,
				)
			} else {
				result.items = this.addAdditionalPropertiesFalse(result.items as Record<string, unknown>)
			}
		}

		// Recursively process anyOf, oneOf, allOf
		for (const keyword of ["anyOf", "oneOf", "allOf"] as const) {
			if (Array.isArray(result[keyword])) {
				result[keyword] = (result[keyword] as unknown[]).map((subSchema) =>
					typeof subSchema === "object" && subSchema !== null
						? this.addAdditionalPropertiesFalse(subSchema as Record<string, unknown>)
						: subSchema,
				)
			}
		}

		// Recursively process additionalProperties if it's a schema (not just true/false)
		if (
			result.additionalProperties &&
			typeof result.additionalProperties === "object" &&
			result.additionalProperties !== null
		) {
			result.additionalProperties = this.addAdditionalPropertiesFalse(
				result.additionalProperties as Record<string, unknown>,
			)
		}

		return result
	}

	/**
	 * Validates schema and then adds `additionalProperties: false` to all object schemas.
	 * Throws if schema is invalid.
	 *
	 * @param schema - The JSON Schema to validate and transform
	 * @returns A validated and transformed schema
	 * @throws ZodError if validation fails
	 */
	static validateAndAddAdditionalPropertiesFalse(schema: unknown): Record<string, unknown> {
		this.validateOrThrow(schema)
		return this.addAdditionalPropertiesFalse(schema as Record<string, unknown>)
	}

	/**
	 * Strips unknown/unsupported properties from a schema, keeping only known JSON Schema fields
	 *
	 * @param schema - The JSON Schema to clean
	 * @returns A new schema with only known JSON Schema fields
	 */
	static stripUnknownFields(schema: unknown): JsonSchema | null {
		const result = JsonSchemaSchema.safeParse(schema)
		if (!result.success) {
			return null
		}
		return result.data
	}

	/**
	 * Checks if a schema is valid JSON Schema
	 *
	 * @param schema - The object to check
	 * @returns true if valid JSON Schema, false otherwise
	 */
	static isValid(schema: unknown): schema is JsonSchema {
		return JsonSchemaSchema.safeParse(schema).success
	}
}

/**
 * Standalone function for adding additionalProperties: false
 * (for backwards compatibility and simpler imports)
 *
 * @param schema - The JSON Schema object to transform
 * @returns A new schema object with `additionalProperties: false` added to all object schemas
 */
export function addAdditionalPropertiesFalse(schema: Record<string, unknown>): Record<string, unknown> {
	return JsonSchemaUtils.addAdditionalPropertiesFalse(schema)
}
