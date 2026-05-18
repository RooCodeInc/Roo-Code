// npx vitest run src/api/transform/__tests__/gemini-schema.spec.ts

import { sanitizeSchemaForGemini } from "../gemini-schema"

describe("sanitizeSchemaForGemini", () => {
	it("converts type array with null to single type + nullable", () => {
		const schema = {
			type: "object",
			properties: {
				cwd: {
					type: ["string", "null"],
					description: "Working directory",
				},
			},
			required: ["cwd"],
		}

		const result = sanitizeSchemaForGemini(schema)

		expect(result).toEqual({
			type: "object",
			properties: {
				cwd: {
					type: "string",
					nullable: true,
					description: "Working directory",
				},
			},
			required: ["cwd"],
		})
	})

	it("converts type array with number and null", () => {
		const schema = {
			type: "object",
			properties: {
				timeout: {
					type: ["number", "null"],
					description: "Timeout in seconds",
				},
			},
		}

		const result = sanitizeSchemaForGemini(schema)

		expect(result.properties).toEqual({
			timeout: {
				type: "number",
				nullable: true,
				description: "Timeout in seconds",
			},
		})
	})

	it("removes additionalProperties", () => {
		const schema = {
			type: "object",
			properties: {
				command: { type: "string" },
			},
			required: ["command"],
			additionalProperties: false,
		}

		const result = sanitizeSchemaForGemini(schema)

		expect(result).toEqual({
			type: "object",
			properties: {
				command: { type: "string" },
			},
			required: ["command"],
		})
		expect(result).not.toHaveProperty("additionalProperties")
	})

	it("removes nested additionalProperties", () => {
		const schema = {
			type: "object",
			properties: {
				indentation: {
					type: "object",
					properties: {
						anchor_line: { type: "integer" },
					},
					required: [],
					additionalProperties: false,
				},
			},
			additionalProperties: false,
		}

		const result = sanitizeSchemaForGemini(schema)

		expect(result).toEqual({
			type: "object",
			properties: {
				indentation: {
					type: "object",
					properties: {
						anchor_line: { type: "integer" },
					},
					required: [],
				},
			},
		})
	})

	it("leaves already-valid schemas unchanged (except additionalProperties)", () => {
		const schema = {
			type: "object",
			properties: {
				path: { type: "string", description: "File path" },
				mode: { type: "string", enum: ["slice", "indentation"] },
			},
			required: ["path"],
		}

		const result = sanitizeSchemaForGemini(schema)

		expect(result).toEqual(schema)
	})

	it("handles the full execute_command schema", () => {
		const schema = {
			type: "object",
			properties: {
				command: {
					type: "string",
					description: "Shell command",
				},
				cwd: {
					type: ["string", "null"],
					description: "Working directory",
				},
				timeout: {
					type: ["number", "null"],
					description: "Timeout",
				},
			},
			required: ["command", "cwd", "timeout"],
			additionalProperties: false,
		}

		const result = sanitizeSchemaForGemini(schema)

		expect(result).toEqual({
			type: "object",
			properties: {
				command: {
					type: "string",
					description: "Shell command",
				},
				cwd: {
					type: "string",
					nullable: true,
					description: "Working directory",
				},
				timeout: {
					type: "number",
					nullable: true,
					description: "Timeout",
				},
			},
			required: ["command", "cwd", "timeout"],
		})
	})

	it("handles type array without null", () => {
		const schema = {
			type: "object",
			properties: {
				value: {
					type: ["string", "number"],
					description: "Mixed type",
				},
			},
		}

		const result = sanitizeSchemaForGemini(schema)

		// Should pick the first non-null type
		expect((result.properties as Record<string, Record<string, unknown>>).value.type).toBe("string")
		expect((result.properties as Record<string, Record<string, unknown>>).value).not.toHaveProperty("nullable")
	})

	it("handles empty or null input", () => {
		expect(sanitizeSchemaForGemini(null as unknown as Record<string, unknown>)).toBeNull()
		expect(sanitizeSchemaForGemini(undefined as unknown as Record<string, unknown>)).toBeUndefined()
	})

	it("handles single string type (no conversion needed)", () => {
		const schema = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
		}

		const result = sanitizeSchemaForGemini(schema)

		expect(result).toEqual(schema)
	})

	it("sanitizes items in array type schemas", () => {
		const schema = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: {
						type: "object",
						properties: {
							text: { type: ["string", "null"] },
						},
						additionalProperties: false,
					},
				},
			},
		}

		const result = sanitizeSchemaForGemini(schema)

		expect(result).toEqual({
			type: "object",
			properties: {
				items: {
					type: "array",
					items: {
						type: "object",
						properties: {
							text: { type: "string", nullable: true },
						},
					},
				},
			},
		})
	})

	it("sanitizes anyOf/oneOf/allOf entries", () => {
		const schema = {
			type: "object",
			properties: {
				value: {
					anyOf: [{ type: "string", additionalProperties: false }, { type: ["number", "null"] }],
				},
			},
		}

		const result = sanitizeSchemaForGemini(schema)

		expect((result.properties as Record<string, Record<string, unknown>>).value).toEqual({
			anyOf: [{ type: "string" }, { type: "number", nullable: true }],
		})
	})

	it("handles the ask_followup_question schema with nested objects", () => {
		const schema = {
			type: "object",
			properties: {
				question: { type: "string" },
				follow_up: {
					type: "array",
					items: {
						type: "object",
						properties: {
							text: { type: "string" },
							mode: {
								type: ["string", "null"],
								description: "Optional mode",
							},
						},
						required: ["text", "mode"],
						additionalProperties: false,
					},
				},
			},
			required: ["question", "follow_up"],
			additionalProperties: false,
		}

		const result = sanitizeSchemaForGemini(schema)

		expect(result).toEqual({
			type: "object",
			properties: {
				question: { type: "string" },
				follow_up: {
					type: "array",
					items: {
						type: "object",
						properties: {
							text: { type: "string" },
							mode: {
								type: "string",
								nullable: true,
								description: "Optional mode",
							},
						},
						required: ["text", "mode"],
					},
				},
			},
			required: ["question", "follow_up"],
		})
	})
})
