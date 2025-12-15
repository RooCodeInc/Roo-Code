import { addAdditionalPropertiesFalse, JsonSchemaUtils, JsonSchemaSchema, JsonSchema } from "../json-schema"

describe("JsonSchemaUtils", () => {
	describe("validate", () => {
		it("should validate a simple object schema", () => {
			const schema = {
				type: "object",
				properties: {
					name: { type: "string" },
				},
			}

			const result = JsonSchemaUtils.validate(schema)

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.type).toBe("object")
			}
		})

		it("should validate a nested schema", () => {
			const schema = {
				type: "object",
				properties: {
					user: {
						type: "object",
						properties: {
							name: { type: "string" },
							age: { type: "integer" },
						},
					},
				},
			}

			const result = JsonSchemaUtils.validate(schema)

			expect(result.success).toBe(true)
		})

		it("should validate array schemas", () => {
			const schema = {
				type: "array",
				items: {
					type: "object",
					properties: {
						id: { type: "number" },
					},
				},
			}

			const result = JsonSchemaUtils.validate(schema)

			expect(result.success).toBe(true)
		})

		it("should validate schemas with anyOf/oneOf/allOf", () => {
			const schema = {
				anyOf: [{ type: "string" }, { type: "number" }],
			}

			const result = JsonSchemaUtils.validate(schema)

			expect(result.success).toBe(true)
		})

		it("should pass through unknown properties", () => {
			const schema = {
				type: "object",
				customProperty: "custom value",
				properties: {
					name: { type: "string" },
				},
			}

			const result = JsonSchemaUtils.validate(schema)

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.customProperty).toBe("custom value")
			}
		})
	})

	describe("validateOrThrow", () => {
		it("should return validated schema for valid input", () => {
			const schema = { type: "object" }

			const result = JsonSchemaUtils.validateOrThrow(schema)

			expect(result.type).toBe("object")
		})

		it("should throw for invalid input", () => {
			const invalidSchema = { type: "invalid-type" }

			expect(() => JsonSchemaUtils.validateOrThrow(invalidSchema)).toThrow()
		})
	})

	describe("isValid", () => {
		it("should return true for valid schemas", () => {
			expect(JsonSchemaUtils.isValid({ type: "string" })).toBe(true)
			expect(JsonSchemaUtils.isValid({ type: "object", properties: {} })).toBe(true)
			expect(JsonSchemaUtils.isValid({ anyOf: [{ type: "string" }] })).toBe(true)
		})

		it("should return false for invalid type values", () => {
			expect(JsonSchemaUtils.isValid({ type: "invalid" })).toBe(false)
		})

		it("should return true for empty object (valid JSON Schema)", () => {
			expect(JsonSchemaUtils.isValid({})).toBe(true)
		})
	})

	describe("addAdditionalPropertiesFalse", () => {
		it("should add additionalProperties: false to a simple object schema", () => {
			const schema = {
				type: "object",
				properties: {
					name: { type: "string" },
				},
			}

			const result = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

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

			const result = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

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

			const result = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

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

			const result = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

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

			const result = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

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

			const result = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

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

			const result = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

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

			const result = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

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
			JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

			expect(schema).toEqual(original)
		})

		it("should return non-object values as-is", () => {
			expect(JsonSchemaUtils.addAdditionalPropertiesFalse(null as any)).toBeNull()
			expect(JsonSchemaUtils.addAdditionalPropertiesFalse("string" as any)).toBe("string")
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

			const result = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

			expect(result.additionalProperties).toBe(false)
			expect((result.properties as any).level1.additionalProperties).toBe(false)
			expect((result.properties as any).level1.properties.level2.items.additionalProperties).toBe(false)
			expect(
				(result.properties as any).level1.properties.level2.items.properties.level3.additionalProperties,
			).toBe(false)
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

			const result = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

			// Top-level object should have additionalProperties: false
			expect(result.additionalProperties).toBe(false)
			// Items in the entities array should have additionalProperties: false
			expect((result.properties as any).entities.items.additionalProperties).toBe(false)
		})
	})

	describe("validateAndAddAdditionalPropertiesFalse", () => {
		it("should validate and transform valid schema", () => {
			const schema = {
				type: "object",
				properties: {
					name: { type: "string" },
				},
			}

			const result = JsonSchemaUtils.validateAndAddAdditionalPropertiesFalse(schema)

			expect(result.additionalProperties).toBe(false)
		})

		it("should throw for invalid schema", () => {
			const invalidSchema = { type: "invalid-type" }

			expect(() => JsonSchemaUtils.validateAndAddAdditionalPropertiesFalse(invalidSchema)).toThrow()
		})
	})

	describe("stripUnknownFields", () => {
		it("should return schema for valid input", () => {
			const schema = {
				type: "object",
				properties: { name: { type: "string" } },
			}

			const result = JsonSchemaUtils.stripUnknownFields(schema)

			expect(result).not.toBeNull()
			expect(result?.type).toBe("object")
		})

		it("should return null for invalid input", () => {
			const invalidSchema = { type: "invalid" }

			const result = JsonSchemaUtils.stripUnknownFields(invalidSchema)

			expect(result).toBeNull()
		})
	})
})

describe("addAdditionalPropertiesFalse (standalone function)", () => {
	it("should work the same as the class method", () => {
		const schema = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
		}

		const standaloneResult = addAdditionalPropertiesFalse(schema)
		const classResult = JsonSchemaUtils.addAdditionalPropertiesFalse(schema)

		expect(standaloneResult).toEqual(classResult)
	})
})

describe("JsonSchemaSchema (Zod schema)", () => {
	it("should be exported and usable directly", () => {
		const schema = { type: "object" }

		const result = JsonSchemaSchema.safeParse(schema)

		expect(result.success).toBe(true)
	})

	it("should reject invalid types", () => {
		const schema = { type: "invalid-type" }

		const result = JsonSchemaSchema.safeParse(schema)

		expect(result.success).toBe(false)
	})
})
