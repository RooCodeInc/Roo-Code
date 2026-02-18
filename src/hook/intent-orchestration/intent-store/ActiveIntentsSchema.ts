/**
 * ActiveIntentsSchema - Zod-like schema validation for active_intents.yaml
 */

import type { IntentDefinition, ActiveIntentsSpec, IntentConstraint } from "../types/IntentTypes"

export class ActiveIntentsSchema {
	/**
	 * Validate the parsed YAML structure
	 */
	static validate(data: unknown): ActiveIntentsSpec {
		if (!data || typeof data !== "object") {
			throw new Error("Invalid active_intents.yaml: must be an object")
		}

		const spec = data as Record<string, unknown>

		if (!spec.version || typeof spec.version !== "string") {
			throw new Error("Invalid active_intents.yaml: missing or invalid version")
		}

		if (!Array.isArray(spec.active_intents)) {
			throw new Error("Invalid active_intents.yaml: active_intents must be an array")
		}

		const validatedIntents: IntentDefinition[] = spec.active_intents.map((intent, index) =>
			this.validateIntent(intent, index),
		)

		return {
			version: spec.version,
			active_intents: validatedIntents,
		}
	}

	/**
	 * Validate a single intent definition
	 */
	private static validateIntent(intent: unknown, index: number): IntentDefinition {
		if (!intent || typeof intent !== "object") {
			throw new Error(`Invalid intent at index ${index}: must be an object`)
		}

		const def = intent as Record<string, unknown>

		// Required fields
		const requiredFields = ["id", "title", "description", "status", "scope", "constraints", "acceptance_criteria"]
		for (const field of requiredFields) {
			if (!(field in def)) {
				throw new Error(`Invalid intent at index ${index}: missing required field '${field}'`)
			}
		}

		// Validate status
		const validStatuses = ["active", "completed", "pending"]
		if (!validStatuses.includes(def.status as string)) {
			throw new Error(`Invalid intent at index ${index}: status must be one of ${validStatuses.join(", ")}`)
		}

		// Validate arrays
		const arrayFields = ["constraints", "acceptance_criteria"]
		for (const field of arrayFields) {
			if (!Array.isArray(def[field])) {
				throw new Error(`Invalid intent at index ${index}: ${field} must be an array`)
			}
		}

		// Validate scope
		if (!def.scope || typeof def.scope !== "object") {
			throw new Error(`Invalid intent at index ${index}: scope must be an object`)
		}

		const scope = def.scope as Record<string, unknown>
		if (!Array.isArray(scope.include)) {
			throw new Error(`Invalid intent at index ${index}: scope.include must be an array`)
		}
		if (!Array.isArray(scope.exclude)) {
			throw new Error(`Invalid intent at index ${index}: scope.exclude must be an array`)
		}

		return {
			id: String(def.id),
			title: String(def.title),
			description: String(def.description),
			status: def.status as "active" | "completed" | "pending",
			scope: {
				include: scope.include.map(String),
				exclude: scope.exclude.map(String),
			},
			constraints: this.validateConstraints(def.constraints, index),
			acceptance_criteria: (def.acceptance_criteria as unknown[]).map(String),
			created_at: def.created_at ? String(def.created_at) : new Date().toISOString(),
			updated_at: def.updated_at ? String(def.updated_at) : new Date().toISOString(),
		}
	}

	/**
	 * Validate constraints array
	 */
	private static validateConstraints(constraints: unknown, index: number): IntentConstraint[] {
		if (!Array.isArray(constraints)) {
			throw new Error(`Invalid intent at index ${index}: constraints must be an array`)
		}

		const validTypes = ["forbid", "require", "allow"]

		return constraints.map((c, cIndex) => {
			if (!c || typeof c !== "object") {
				throw new Error(`Invalid constraint at intent ${index}, constraint ${cIndex}: must be an object`)
			}

			const constraint = c as Record<string, unknown>

			if (!constraint.type || !validTypes.includes(constraint.type as string)) {
				throw new Error(
					`Invalid constraint at intent ${index}, constraint ${cIndex}: type must be one of ${validTypes.join(", ")}`,
				)
			}

			if (!constraint.pattern || typeof constraint.pattern !== "string") {
				throw new Error(`Invalid constraint at intent ${index}, constraint ${cIndex}: pattern must be a string`)
			}

			return {
				type: constraint.type as "forbid" | "require" | "allow",
				pattern: String(constraint.pattern),
				description: constraint.description ? String(constraint.description) : undefined,
			}
		})
	}
}
