// npx vitest run api/providers/__tests__/base-provider.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import type { ModelInfo } from "@roo-code/types"
import { BaseProvider } from "../base-provider"
import type { ApiHandlerCreateMessageMetadata } from "../../index"
import { ApiStream } from "../../transform/stream"

// Create a concrete test implementation of the abstract BaseProvider class
class TestProvider extends BaseProvider {
	createMessage(
		_systemPrompt: string,
		_messages: Anthropic.Messages.MessageParam[],
		_metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		throw new Error("Not implemented for tests")
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: "test-model",
			info: {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 0.5,
				outputPrice: 1.5,
			},
		}
	}

	// Expose protected method for testing
	public testConvertToolSchemaForOpenAI(schema: any): any {
		return this.convertToolSchemaForOpenAI(schema)
	}

	// Expose protected method for testing
	public testConvertToolsForOpenAI(tools: any[] | undefined): any[] | undefined {
		return this.convertToolsForOpenAI(tools)
	}
}

describe("BaseProvider", () => {
	let provider: TestProvider

	beforeEach(() => {
		provider = new TestProvider()
	})

	describe("convertToolSchemaForOpenAI", () => {
		describe("JSON Schema draft 2020-12 compliance", () => {
			it("should convert type array to anyOf for nullable string", () => {
				const input = {
					type: "object",
					properties: {
						field: {
							type: ["string", "null"],
							description: "Optional field",
						},
					},
				}

				const result = provider.testConvertToolSchemaForOpenAI(input)

				// Should have anyOf instead of type array
				expect(result.properties.field.anyOf).toEqual([{ type: "string" }, { type: "null" }])
				expect(result.properties.field.type).toBeUndefined()
				expect(result.properties.field.description).toBe("Optional field")
			})

			it("should convert type array to anyOf for nullable array with items inside array variant", () => {
				const input = {
					type: "object",
					properties: {
						files: {
							type: ["array", "null"],
							items: { type: "string" },
							description: "Optional array",
						},
					},
				}

				const result = provider.testConvertToolSchemaForOpenAI(input)

				// Array-specific properties (items) should be moved inside the array variant
				expect(result.properties.files.anyOf).toEqual([
					{ type: "array", items: { type: "string" } },
					{ type: "null" },
				])
				expect(result.properties.files.items).toBeUndefined()
				expect(result.properties.files.description).toBe("Optional array")
			})

			it("should preserve single type values", () => {
				const input = {
					type: "object",
					properties: {
						name: {
							type: "string",
							description: "Required field",
						},
					},
				}

				const result = provider.testConvertToolSchemaForOpenAI(input)

				expect(result.properties.name.type).toBe("string")
				expect(result.properties.name.description).toBe("Required field")
			})

			it("should handle deeply nested structures with type arrays", () => {
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
										items: { type: "integer" },
									},
								},
							},
						},
					},
				}

				const result = provider.testConvertToolSchemaForOpenAI(input)

				// The nested line_ranges should have anyOf format with items inside array variant
				const nestedProps = result.properties.files.items.properties
				expect(nestedProps.line_ranges.anyOf).toEqual([
					{ type: "array", items: { type: "integer" } },
					{ type: "null" },
				])
				expect(nestedProps.line_ranges.items).toBeUndefined()
			})
		})

		describe("OpenAI strict mode compatibility", () => {
			it("should set additionalProperties: false for object types", () => {
				const input = {
					type: "object",
					properties: {
						name: { type: "string" },
					},
				}

				const result = provider.testConvertToolSchemaForOpenAI(input)

				expect(result.additionalProperties).toBe(false)
			})

			it("should force additionalProperties to false even when set to true", () => {
				const input = {
					type: "object",
					properties: {
						name: { type: "string" },
					},
					additionalProperties: true,
				}

				const result = provider.testConvertToolSchemaForOpenAI(input)

				expect(result.additionalProperties).toBe(false)
			})

			it("should not add additionalProperties to primitive types", () => {
				const input = {
					type: "string",
					description: "A string field",
				}

				const result = provider.testConvertToolSchemaForOpenAI(input)

				expect(result.additionalProperties).toBeUndefined()
			})
		})

		describe("format field handling", () => {
			it("should preserve supported format values", () => {
				const input = {
					type: "object",
					properties: {
						timestamp: {
							type: "string",
							format: "date-time",
						},
					},
				}

				const result = provider.testConvertToolSchemaForOpenAI(input)

				expect(result.properties.timestamp.format).toBe("date-time")
			})

			it("should strip unsupported format values like uri", () => {
				const input = {
					type: "object",
					properties: {
						url: {
							type: "string",
							format: "uri",
							description: "A URL",
						},
					},
				}

				const result = provider.testConvertToolSchemaForOpenAI(input)

				expect(result.properties.url.format).toBeUndefined()
				expect(result.properties.url.type).toBe("string")
				expect(result.properties.url.description).toBe("A URL")
			})
		})

		describe("edge cases", () => {
			it("should handle null input", () => {
				const result = provider.testConvertToolSchemaForOpenAI(null)
				expect(result).toBeNull()
			})

			it("should handle non-object input", () => {
				const result = provider.testConvertToolSchemaForOpenAI("string")
				expect(result).toBe("string")
			})

			it("should handle read_file tool schema structure", () => {
				// This is similar to the actual read_file tool schema that caused issues
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

				const result = provider.testConvertToolSchemaForOpenAI(input)

				// Verify the line_ranges was transformed correctly
				const filesItems = result.properties.files.items
				const lineRanges = filesItems.properties.line_ranges

				// Should have anyOf with items inside array variant
				expect(lineRanges.anyOf).toBeDefined()
				expect(lineRanges.anyOf).toHaveLength(2)

				// Array variant should have items, minItems, maxItems
				const arrayVariant = lineRanges.anyOf.find((v: any) => v.type === "array")
				expect(arrayVariant).toBeDefined()
				expect(arrayVariant.items).toBeDefined()

				// items should NOT be at root level anymore
				expect(lineRanges.items).toBeUndefined()
			})
		})
	})

	describe("convertToolsForOpenAI", () => {
		it("should return undefined for undefined input", () => {
			const result = provider.testConvertToolsForOpenAI(undefined)
			expect(result).toBeUndefined()
		})

		it("should convert function tool schemas", () => {
			const tools = [
				{
					type: "function",
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: {
							type: "object",
							properties: {
								field: {
									type: ["string", "null"],
								},
							},
						},
					},
				},
			]

			const result = provider.testConvertToolsForOpenAI(tools)

			expect(result).toBeDefined()
			expect(result![0].function.strict).toBe(true)
			// Should have converted type array to anyOf
			expect(result![0].function.parameters.properties.field.anyOf).toBeDefined()
		})

		it("should disable strict mode for MCP tools", () => {
			const tools = [
				{
					type: "function",
					function: {
						name: "mcp--server--tool",
						description: "An MCP tool",
						parameters: {
							type: "object",
							properties: {
								field: { type: "string" },
							},
						},
					},
				},
			]

			const result = provider.testConvertToolsForOpenAI(tools)

			expect(result).toBeDefined()
			expect(result![0].function.strict).toBe(false)
			// MCP tool parameters should not be modified
			expect(result![0].function.parameters.type).toBe("object")
		})

		it("should pass through non-function tools unchanged", () => {
			const tools = [
				{
					type: "other",
					data: "some data",
				},
			]

			const result = provider.testConvertToolsForOpenAI(tools)

			expect(result).toEqual(tools)
		})
	})
})
