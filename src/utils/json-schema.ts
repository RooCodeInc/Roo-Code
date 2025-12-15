/**
 * Recursively adds `additionalProperties: false` to all object schemas in a JSON Schema.
 * This is required by some API providers (e.g., OpenAI) for strict function calling.
 *
 * @param schema - The JSON Schema object to transform
 * @returns A new schema object with `additionalProperties: false` added to all object schemas
 */
export function addAdditionalPropertiesFalse(schema: Record<string, unknown>): Record<string, unknown> {
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
				newProperties[key] = addAdditionalPropertiesFalse(value as Record<string, unknown>)
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
					? addAdditionalPropertiesFalse(item as Record<string, unknown>)
					: item,
			)
		} else {
			result.items = addAdditionalPropertiesFalse(result.items as Record<string, unknown>)
		}
	}

	// Recursively process anyOf, oneOf, allOf
	for (const keyword of ["anyOf", "oneOf", "allOf"]) {
		if (Array.isArray(result[keyword])) {
			result[keyword] = (result[keyword] as unknown[]).map((subSchema) =>
				typeof subSchema === "object" && subSchema !== null
					? addAdditionalPropertiesFalse(subSchema as Record<string, unknown>)
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
		result.additionalProperties = addAdditionalPropertiesFalse(
			result.additionalProperties as Record<string, unknown>,
		)
	}

	return result
}
