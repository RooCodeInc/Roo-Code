import { addAdditionalPropertiesToSchema, getMcpServerTools } from "../mcp_server"
import { McpHub } from "../../../../../services/mcp/McpHub"

describe("addAdditionalPropertiesToSchema", () => {
	it("should return non-object values unchanged", () => {
		expect(addAdditionalPropertiesToSchema(null as any)).toBeNull()
		expect(addAdditionalPropertiesToSchema(undefined as any)).toBeUndefined()
		expect(addAdditionalPropertiesToSchema("string" as any)).toBe("string")
	})

	it("should add additionalProperties: false to object types with properties", () => {
		const schema = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
		}

		const result = addAdditionalPropertiesToSchema(schema)

		expect(result.additionalProperties).toBe(false)
		expect(result.properties.name).toEqual({ type: "string" })
	})

	it("should not modify object types without properties", () => {
		const schema = {
			type: "object",
		}

		const result = addAdditionalPropertiesToSchema(schema)

		expect(result.additionalProperties).toBeUndefined()
	})

	it("should recursively process nested object properties", () => {
		const schema = {
			type: "object",
			properties: {
				nested: {
					type: "object",
					properties: {
						value: { type: "string" },
					},
				},
			},
		}

		const result = addAdditionalPropertiesToSchema(schema)

		expect(result.additionalProperties).toBe(false)
		expect(result.properties.nested.additionalProperties).toBe(false)
	})

	it("should process object types inside array items", () => {
		const schema = {
			type: "array",
			items: {
				type: "object",
				properties: {
					name: { type: "string" },
				},
			},
		}

		const result = addAdditionalPropertiesToSchema(schema)

		expect(result.items.additionalProperties).toBe(false)
	})

	it("should process array items when items is an array (tuple validation)", () => {
		const schema = {
			type: "array",
			items: [
				{
					type: "object",
					properties: {
						first: { type: "string" },
					},
				},
				{
					type: "object",
					properties: {
						second: { type: "number" },
					},
				},
			],
		}

		const result = addAdditionalPropertiesToSchema(schema)

		expect(result.items[0].additionalProperties).toBe(false)
		expect(result.items[1].additionalProperties).toBe(false)
	})

	it("should process anyOf, allOf, and oneOf combinators", () => {
		const schema = {
			anyOf: [{ type: "object", properties: { a: { type: "string" } } }],
			allOf: [{ type: "object", properties: { b: { type: "string" } } }],
			oneOf: [{ type: "object", properties: { c: { type: "string" } } }],
		}

		const result = addAdditionalPropertiesToSchema(schema)

		expect(result.anyOf[0].additionalProperties).toBe(false)
		expect(result.allOf[0].additionalProperties).toBe(false)
		expect(result.oneOf[0].additionalProperties).toBe(false)
	})

	it("should process conditional schemas (if/then/else)", () => {
		const schema = {
			if: { type: "object", properties: { condition: { type: "boolean" } } },
			then: { type: "object", properties: { thenValue: { type: "string" } } },
			else: { type: "object", properties: { elseValue: { type: "string" } } },
		}

		const result = addAdditionalPropertiesToSchema(schema)

		expect(result.if.additionalProperties).toBe(false)
		expect(result.then.additionalProperties).toBe(false)
		expect(result.else.additionalProperties).toBe(false)
	})

	it("should process definitions and $defs", () => {
		const schema = {
			definitions: {
				Entity: { type: "object", properties: { id: { type: "string" } } },
			},
			$defs: {
				Item: { type: "object", properties: { name: { type: "string" } } },
			},
		}

		const result = addAdditionalPropertiesToSchema(schema)

		expect(result.definitions.Entity.additionalProperties).toBe(false)
		expect(result.$defs.Item.additionalProperties).toBe(false)
	})

	it("should handle complex nested schema like MCP memory create_entities", () => {
		// This is a schema similar to what caused the original error
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
							observations: {
								type: "array",
								items: { type: "string" },
							},
						},
						required: ["name", "entityType", "observations"],
					},
				},
			},
			required: ["entities"],
		}

		const result = addAdditionalPropertiesToSchema(schema)

		// Top level should have additionalProperties: false
		expect(result.additionalProperties).toBe(false)
		// The object inside the array items should also have additionalProperties: false
		expect(result.properties.entities.items.additionalProperties).toBe(false)
		// Required arrays should be preserved
		expect(result.required).toEqual(["entities"])
		expect(result.properties.entities.items.required).toEqual(["name", "entityType", "observations"])
	})

	it("should not mutate the original schema", () => {
		const original = {
			type: "object",
			properties: {
				nested: {
					type: "object",
					properties: {
						value: { type: "string" },
					},
				},
			},
		}
		const originalJson = JSON.stringify(original)

		addAdditionalPropertiesToSchema(original)

		expect(JSON.stringify(original)).toBe(originalJson)
	})
})

describe("getMcpServerTools", () => {
	it("should return empty array when mcpHub is undefined", () => {
		const result = getMcpServerTools(undefined)
		expect(result).toEqual([])
	})

	it("should process MCP tools and add additionalProperties to nested schemas", () => {
		// Create a mock McpHub with a tool that has nested object schemas
		const mockMcpHub = {
			getServers: () => [
				{
					name: "memory",
					tools: [
						{
							name: "create_entities",
							description: "Create entities in memory",
							enabledForPrompt: true,
							inputSchema: {
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
								required: ["entities"],
							},
						},
					],
				},
			],
		} as unknown as McpHub

		const result = getMcpServerTools(mockMcpHub)

		expect(result).toHaveLength(1)
		const tool = result[0] as { type: "function"; function: { name: string; parameters: Record<string, any> } }
		expect(tool.function.name).toBe("mcp--memory--create_entities")

		// Verify the nested object has additionalProperties: false
		const params = tool.function.parameters
		expect(params.additionalProperties).toBe(false)
		expect(params.properties.entities.items.additionalProperties).toBe(false)
	})

	it("should skip tools with enabledForPrompt set to false", () => {
		const mockMcpHub = {
			getServers: () => [
				{
					name: "test",
					tools: [
						{
							name: "enabled_tool",
							description: "Enabled tool",
							enabledForPrompt: true,
							inputSchema: {
								type: "object",
								properties: {},
							},
						},
						{
							name: "disabled_tool",
							description: "Disabled tool",
							enabledForPrompt: false,
							inputSchema: {
								type: "object",
								properties: {},
							},
						},
					],
				},
			],
		} as unknown as McpHub

		const result = getMcpServerTools(mockMcpHub)

		expect(result).toHaveLength(1)
		const tool = result[0] as { type: "function"; function: { name: string } }
		expect(tool.function.name).toBe("mcp--test--enabled_tool")
	})
})
