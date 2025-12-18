import { describe, it, expect } from "vitest"
import { normalizeToolSchema } from "../json-schema"

describe("normalizeToolSchema", () => {
	it("should convert type array to anyOf for nullable string", () => {
		const input = {
			type: ["string", "null"],
			description: "Optional field",
		}

		const result = normalizeToolSchema(input)

		expect(result).toEqual({
			anyOf: [{ type: "string" }, { type: "null" }],
			description: "Optional field",
			additionalProperties: false,
		})
	})

	it("should convert type array to anyOf for nullable array", () => {
		const input = {
			type: ["array", "null"],
			items: { type: "string" },
			description: "Optional array",
		}

		const result = normalizeToolSchema(input)

		expect(result).toEqual({
			anyOf: [{ type: "array" }, { type: "null" }],
			items: { type: "string", additionalProperties: false },
			description: "Optional array",
			additionalProperties: false,
		})
	})

	it("should preserve single type values", () => {
		const input = {
			type: "string",
			description: "Required field",
		}

		const result = normalizeToolSchema(input)

		expect(result).toEqual({
			type: "string",
			description: "Required field",
			additionalProperties: false,
		})
	})

	it("should recursively transform nested properties", () => {
		const input = {
			type: "object",
			properties: {
				name: { type: "string" },
				optional: {
					type: ["string", "null"],
					description: "Optional nested field",
				},
			},
			required: ["name"],
		}

		const result = normalizeToolSchema(input)

		expect(result).toEqual({
			type: "object",
			properties: {
				name: { type: "string", additionalProperties: false },
				optional: {
					anyOf: [{ type: "string" }, { type: "null" }],
					description: "Optional nested field",
					additionalProperties: false,
				},
			},
			required: ["name"],
			additionalProperties: false,
		})
	})

	it("should recursively transform items in arrays", () => {
		const input = {
			type: "array",
			items: {
				type: "object",
				properties: {
					path: { type: "string" },
					line_ranges: {
						type: ["array", "null"],
						items: { type: "integer" },
					},
				},
			},
		}

		const result = normalizeToolSchema(input)

		expect(result).toEqual({
			type: "array",
			items: {
				type: "object",
				properties: {
					path: { type: "string", additionalProperties: false },
					line_ranges: {
						anyOf: [{ type: "array" }, { type: "null" }],
						items: { type: "integer", additionalProperties: false },
						additionalProperties: false,
					},
				},
				additionalProperties: false,
			},
			additionalProperties: false,
		})
	})

	it("should handle deeply nested structures", () => {
		const input = {
			type: "object",
			properties: {
				files: {
					type: "array",
					items: {
						type: "object",
						properties: {
							path: { type: "string" },
							line_ranges: {
								type: ["array", "null"],
								items: {
									type: "array",
									items: { type: "integer" },
								},
							},
						},
						required: ["path", "line_ranges"],
					},
				},
			},
		}

		const result = normalizeToolSchema(input)

		expect(result.properties).toBeDefined()
		const properties = result.properties as Record<string, Record<string, unknown>>
		const filesItems = properties.files.items as Record<string, unknown>
		const filesItemsProps = filesItems.properties as Record<string, Record<string, unknown>>
		expect(filesItemsProps.line_ranges.anyOf).toEqual([{ type: "array" }, { type: "null" }])
	})

	it("should recursively transform anyOf arrays", () => {
		const input = {
			anyOf: [
				{
					type: "object",
					properties: {
						optional: { type: ["string", "null"] },
					},
				},
				{ type: "null" },
			],
		}

		const result = normalizeToolSchema(input)

		expect(result).toEqual({
			anyOf: [
				{
					type: "object",
					properties: {
						optional: { anyOf: [{ type: "string" }, { type: "null" }], additionalProperties: false },
					},
					additionalProperties: false,
				},
				{ type: "null", additionalProperties: false },
			],
			additionalProperties: false,
		})
	})

	it("should handle null or non-object input", () => {
		expect(normalizeToolSchema(null as any)).toBeNull()
		expect(normalizeToolSchema("string" as any)).toBe("string")
		expect(normalizeToolSchema(123 as any)).toBe(123)
	})

	it("should transform additionalProperties when it is a schema object", () => {
		const input = {
			type: "object",
			additionalProperties: {
				type: ["string", "null"],
			},
		}

		const result = normalizeToolSchema(input)

		expect(result).toEqual({
			type: "object",
			properties: {},
			additionalProperties: {
				anyOf: [{ type: "string" }, { type: "null" }],
				additionalProperties: false,
			},
		})
	})

	it("should preserve additionalProperties when it is a boolean", () => {
		const input = {
			type: "object",
			additionalProperties: false,
		}

		const result = normalizeToolSchema(input)

		expect(result).toEqual({
			type: "object",
			properties: {},
			additionalProperties: false,
		})
	})

	it("should handle the read_file tool schema structure", () => {
		// This is the actual structure used in read_file tool
		const input = {
			type: "object",
			properties: {
				files: {
					type: "array",
					description: "List of files to read",
					items: {
						type: "object",
						properties: {
							path: {
								type: "string",
								description: "Path to the file",
							},
							line_ranges: {
								type: ["array", "null"],
								description: "Optional line ranges",
								items: {
									type: "array",
									items: { type: "integer" },
									minItems: 2,
									maxItems: 2,
								},
							},
						},
						required: ["path", "line_ranges"],
						additionalProperties: false,
					},
					minItems: 1,
				},
			},
			required: ["files"],
			additionalProperties: false,
		}

		const result = normalizeToolSchema(input)

		// Verify the line_ranges was transformed
		const files = (result.properties as Record<string, unknown>).files as Record<string, unknown>
		const items = files.items as Record<string, unknown>
		const props = items.properties as Record<string, Record<string, unknown>>
		expect(props.line_ranges.anyOf).toEqual([{ type: "array" }, { type: "null" }])
		// Verify other properties are preserved
		expect(props.line_ranges.items).toBeDefined()
		expect(props.line_ranges.description).toBe("Optional line ranges")
	})
})
