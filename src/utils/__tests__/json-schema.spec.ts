import { ToolInputSchema } from "../json-schema"

describe("ToolInputSchema", () => {
	it("should validate and default additionalProperties to false", () => {
		const schema = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
		}

		const result = ToolInputSchema.parse(schema)

		expect(result.type).toBe("object")
		expect(result.additionalProperties).toBe(false)
	})

	it("should recursively apply defaults to nested schemas", () => {
		const schema = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						name: { type: "string" },
					},
				},
			},
		}

		const result = ToolInputSchema.parse(schema)

		expect(result.additionalProperties).toBe(false)
		expect((result.properties as any).user.additionalProperties).toBe(false)
	})

	it("should apply defaults to object schemas in array items", () => {
		const schema = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "number" },
						},
					},
				},
			},
		}

		const result = ToolInputSchema.parse(schema)

		expect(result.additionalProperties).toBe(false)
		expect((result.properties as any).items.items.additionalProperties).toBe(false)
	})

	it("should throw on invalid schema", () => {
		const invalidSchema = { type: "invalid-type" }

		expect(() => ToolInputSchema.parse(invalidSchema)).toThrow()
	})

	it("should use safeParse for error handling", () => {
		const invalidSchema = { type: "invalid-type" }

		const result = ToolInputSchema.safeParse(invalidSchema)

		expect(result.success).toBe(false)
	})

	it("should apply defaults in anyOf schemas", () => {
		const schema = {
			anyOf: [{ type: "object", properties: { a: { type: "string" } } }, { type: "string" }],
		}

		const result = ToolInputSchema.parse(schema)

		expect((result.anyOf as any)[0].additionalProperties).toBe(false)
		expect((result.anyOf as any)[1].additionalProperties).toBe(false)
	})

	it("should apply defaults in oneOf schemas", () => {
		const schema = {
			oneOf: [{ type: "object", properties: { a: { type: "string" } } }, { type: "number" }],
		}

		const result = ToolInputSchema.parse(schema)

		expect((result.oneOf as any)[0].additionalProperties).toBe(false)
		expect((result.oneOf as any)[1].additionalProperties).toBe(false)
	})

	it("should apply defaults in allOf schemas", () => {
		const schema = {
			allOf: [
				{ type: "object", properties: { a: { type: "string" } } },
				{ type: "object", properties: { b: { type: "number" } } },
			],
		}

		const result = ToolInputSchema.parse(schema)

		expect((result.allOf as any)[0].additionalProperties).toBe(false)
		expect((result.allOf as any)[1].additionalProperties).toBe(false)
	})

	it("should apply defaults to tuple-style array items", () => {
		const schema = {
			type: "object",
			properties: {
				tuple: {
					type: "array",
					items: [
						{ type: "object", properties: { a: { type: "string" } } },
						{ type: "object", properties: { b: { type: "number" } } },
					],
				},
			},
		}

		const result = ToolInputSchema.parse(schema)

		const tupleItems = (result.properties as any).tuple.items
		expect(tupleItems[0].additionalProperties).toBe(false)
		expect(tupleItems[1].additionalProperties).toBe(false)
	})

	it("should preserve explicit additionalProperties: false", () => {
		const schema = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
			additionalProperties: false,
		}

		const result = ToolInputSchema.parse(schema)

		expect(result.additionalProperties).toBe(false)
	})

	it("should handle deeply nested complex schemas", () => {
		const schema = {
			type: "object",
			properties: {
				level1: {
					type: "object",
					properties: {
						level2: {
							type: "array",
							items: {
								type: "object",
								properties: {
									level3: {
										type: "object",
										properties: {
											value: { type: "string" },
										},
									},
								},
							},
						},
					},
				},
			},
		}

		const result = ToolInputSchema.parse(schema)

		expect(result.additionalProperties).toBe(false)
		expect((result.properties as any).level1.additionalProperties).toBe(false)
		expect((result.properties as any).level1.properties.level2.items.additionalProperties).toBe(false)
		expect((result.properties as any).level1.properties.level2.items.properties.level3.additionalProperties).toBe(
			false,
		)
	})

	it("should handle the real-world MCP memory create_entities schema", () => {
		// This is based on the actual schema that caused the OpenAI error
		const schema = {
			type: "object",
			properties: {
				entities: {
					type: "array",
					items: {
						type: "object",
						properties: {
							name: { type: "string", description: "The name of the entity" },
							entityType: { type: "string", description: "The type of the entity" },
							observations: {
								type: "array",
								items: { type: "string" },
								description: "An array of observation contents",
							},
						},
						required: ["name", "entityType", "observations"],
					},
					description: "An array of entities to create",
				},
			},
			required: ["entities"],
		}

		const result = ToolInputSchema.parse(schema)

		// Top-level object should have additionalProperties: false
		expect(result.additionalProperties).toBe(false)
		// Items in the entities array should have additionalProperties: false
		expect((result.properties as any).entities.items.additionalProperties).toBe(false)
	})
})
