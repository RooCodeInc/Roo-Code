import { addAdditionalPropertiesFalse } from "../json-schema"

describe("addAdditionalPropertiesFalse", () => {
	it("should add additionalProperties: false to a simple object schema", () => {
		const schema = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
		}

		const result = addAdditionalPropertiesFalse(schema)

		expect(result).toEqual({
			type: "object",
			properties: {
				name: { type: "string" },
			},
			additionalProperties: false,
		})
	})

	it("should add additionalProperties: false to nested object schemas", () => {
		const schema = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						name: { type: "string" },
						address: {
							type: "object",
							properties: {
								street: { type: "string" },
							},
						},
					},
				},
			},
		}

		const result = addAdditionalPropertiesFalse(schema)

		expect(result).toEqual({
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						name: { type: "string" },
						address: {
							type: "object",
							properties: {
								street: { type: "string" },
							},
							additionalProperties: false,
						},
					},
					additionalProperties: false,
				},
			},
			additionalProperties: false,
		})
	})

	it("should add additionalProperties: false to array items that are objects", () => {
		const schema = {
			type: "object",
			properties: {
				entities: {
					type: "array",
					items: {
						type: "object",
						properties: {
							name: { type: "string" },
							entityType: { type: "string" },
						},
					},
				},
			},
		}

		const result = addAdditionalPropertiesFalse(schema)

		expect(result).toEqual({
			type: "object",
			properties: {
				entities: {
					type: "array",
					items: {
						type: "object",
						properties: {
							name: { type: "string" },
							entityType: { type: "string" },
						},
						additionalProperties: false,
					},
				},
			},
			additionalProperties: false,
		})
	})

	it("should handle tuple-style array items", () => {
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

		const result = addAdditionalPropertiesFalse(schema)

		expect(result).toEqual({
			type: "object",
			properties: {
				tuple: {
					type: "array",
					items: [
						{ type: "object", properties: { a: { type: "string" } }, additionalProperties: false },
						{ type: "object", properties: { b: { type: "number" } }, additionalProperties: false },
					],
				},
			},
			additionalProperties: false,
		})
	})

	it("should preserve existing additionalProperties: false", () => {
		const schema = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
			additionalProperties: false,
		}

		const result = addAdditionalPropertiesFalse(schema)

		expect(result).toEqual({
			type: "object",
			properties: {
				name: { type: "string" },
			},
			additionalProperties: false,
		})
	})

	it("should handle anyOf schemas", () => {
		const schema = {
			anyOf: [{ type: "object", properties: { a: { type: "string" } } }, { type: "string" }],
		}

		const result = addAdditionalPropertiesFalse(schema)

		expect(result).toEqual({
			anyOf: [
				{ type: "object", properties: { a: { type: "string" } }, additionalProperties: false },
				{ type: "string" },
			],
		})
	})

	it("should handle oneOf schemas", () => {
		const schema = {
			oneOf: [{ type: "object", properties: { a: { type: "string" } } }, { type: "number" }],
		}

		const result = addAdditionalPropertiesFalse(schema)

		expect(result).toEqual({
			oneOf: [
				{ type: "object", properties: { a: { type: "string" } }, additionalProperties: false },
				{ type: "number" },
			],
		})
	})

	it("should handle allOf schemas", () => {
		const schema = {
			allOf: [
				{ type: "object", properties: { a: { type: "string" } } },
				{ type: "object", properties: { b: { type: "number" } } },
			],
		}

		const result = addAdditionalPropertiesFalse(schema)

		expect(result).toEqual({
			allOf: [
				{ type: "object", properties: { a: { type: "string" } }, additionalProperties: false },
				{ type: "object", properties: { b: { type: "number" } }, additionalProperties: false },
			],
		})
	})

	it("should not mutate the original schema", () => {
		const schema = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
		}

		const original = JSON.parse(JSON.stringify(schema))
		addAdditionalPropertiesFalse(schema)

		expect(schema).toEqual(original)
	})

	it("should return non-object values as-is", () => {
		expect(addAdditionalPropertiesFalse(null as any)).toBeNull()
		expect(addAdditionalPropertiesFalse("string" as any)).toBe("string")
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

		const result = addAdditionalPropertiesFalse(schema)

		expect(result.additionalProperties).toBe(false)
		expect((result.properties as any).level1.additionalProperties).toBe(false)
		expect((result.properties as any).level1.properties.level2.items.additionalProperties).toBe(false)
		expect((result.properties as any).level1.properties.level2.items.properties.level3.additionalProperties).toBe(
			false,
		)
	})

	it("should handle the real-world MCP memory create_entities schema", () => {
		// This is based on the actual schema that caused the error
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

		const result = addAdditionalPropertiesFalse(schema)

		// Top-level object should have additionalProperties: false
		expect(result.additionalProperties).toBe(false)
		// Items in the entities array should have additionalProperties: false
		expect((result.properties as any).entities.items.additionalProperties).toBe(false)
	})
})
