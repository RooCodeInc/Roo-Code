/**
 * Sanitizes JSON Schema objects for compatibility with the Gemini API's
 * `parametersJsonSchema` field.
 *
 * The Gemini API does not support certain standard JSON Schema features:
 * - `type` as an array (e.g. `["string", "null"]`) for nullable types
 * - `additionalProperties` in function parameter schemas
 *
 * This function recursively converts these constructs into Gemini-compatible
 * equivalents:
 * - `type: ["string", "null"]` becomes `type: "string", nullable: true`
 * - `additionalProperties` is removed
 *
 * @see https://github.com/RooCodeInc/Roo-Code/issues/12202
 */
export function sanitizeSchemaForGemini(schema: Record<string, unknown>): Record<string, unknown> {
	if (!schema || typeof schema !== "object") {
		return schema
	}

	const result: Record<string, unknown> = {}

	for (const [key, value] of Object.entries(schema)) {
		// Remove additionalProperties — Gemini does not support it in
		// function declaration schemas.
		if (key === "additionalProperties") {
			continue
		}

		// Convert array-type `type` fields to single type + nullable.
		// e.g. `type: ["string", "null"]` -> `type: "string", nullable: true`
		if (key === "type" && Array.isArray(value)) {
			const types = value.filter((t) => t !== "null")
			const hasNull = value.includes("null")

			if (types.length === 1) {
				result.type = types[0]
			} else if (types.length > 1) {
				// Multiple non-null types — keep the first as a best-effort
				// fallback. This shouldn't happen in our tool schemas but
				// handles the edge case defensively.
				result.type = types[0]
			} else {
				// All entries were "null" — unusual, default to string.
				result.type = "string"
			}

			if (hasNull) {
				result.nullable = true
			}
			continue
		}

		// Recursively sanitize nested `properties` objects.
		if (key === "properties" && typeof value === "object" && value !== null) {
			const sanitizedProps: Record<string, unknown> = {}
			for (const [propName, propSchema] of Object.entries(value as Record<string, unknown>)) {
				if (typeof propSchema === "object" && propSchema !== null) {
					sanitizedProps[propName] = sanitizeSchemaForGemini(propSchema as Record<string, unknown>)
				} else {
					sanitizedProps[propName] = propSchema
				}
			}
			result[key] = sanitizedProps
			continue
		}

		// Recursively sanitize `items` for array types.
		if (key === "items" && typeof value === "object" && value !== null) {
			result[key] = sanitizeSchemaForGemini(value as Record<string, unknown>)
			continue
		}

		// Recursively sanitize `anyOf`, `oneOf`, `allOf` entries.
		if ((key === "anyOf" || key === "oneOf" || key === "allOf") && Array.isArray(value)) {
			result[key] = value.map((item) =>
				typeof item === "object" && item !== null
					? sanitizeSchemaForGemini(item as Record<string, unknown>)
					: item,
			)
			continue
		}

		result[key] = value
	}

	return result
}
