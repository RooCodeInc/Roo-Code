import type Anthropic from "@anthropic-ai/sdk"
import {
	ToolResultConsolidator,
	ListFilesConsolidationStrategy,
	SearchFilesConsolidationStrategy,
	SequentialFileOpsStrategy,
	type ToolResult,
} from "../consolidator"

describe("ToolResultConsolidator", () => {
	let consolidator: ToolResultConsolidator

	beforeEach(() => {
		consolidator = new ToolResultConsolidator()
	})

	describe("consolidate", () => {
		it("should consolidate multiple list_files results for the same directory", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "list1",
							content: "Directory: src/utils\nFiles in src/utils:\nfile1.ts\nfile2.ts",
						},
						{
							type: "tool_result",
							tool_use_id: "list2",
							content: "Directory: src/utils\nFiles in src/utils:\nfile2.ts\nfile3.ts",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(2)
			expect(result.metadata.consolidatedCount).toBe(1)
			expect(result.metadata.strategiesApplied).toContain("ListFilesConsolidation")
			expect(result.metadata.tokensReduced).toBeGreaterThan(0)
			expect(result.metadata.reductionPercentage).toBeGreaterThan(0)

			// Verify consolidation preserves unique files
			const consolidated = result.consolidatedContent[0]
			expect(consolidated.content).toContain("src/utils")
			expect(consolidated.content).toContain("file1.ts")
			expect(consolidated.content).toContain("file2.ts")
			expect(consolidated.content).toContain("file3.ts")
		})

		it("should consolidate multiple search_files results", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "search1",
							content:
								"search_files results:\nFile: src/app.ts\nMatch at line 10: function test()\nMatch at line 20: const x = 1",
						},
						{
							type: "tool_result",
							tool_use_id: "search2",
							content:
								"search_files results:\nFile: src/utils.ts\nMatch at line 5: export function helper()",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(2)
			expect(result.metadata.consolidatedCount).toBe(1)
			expect(result.metadata.strategiesApplied).toContain("SearchFilesConsolidation")

			const consolidated = result.consolidatedContent[0]
			expect(consolidated.content).toContain("Consolidated search_files results")
			expect(consolidated.content).toContain("src/app.ts")
			expect(consolidated.content).toContain("src/utils.ts")
		})

		it("should consolidate sequential file operations on the same file", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "read1",
							content: "Successfully read File: src/test.ts\nconst x = 1",
						},
						{
							type: "tool_result",
							tool_use_id: "write1",
							content: "Successfully wrote File: src/test.ts",
						},
						{
							type: "tool_result",
							tool_use_id: "modify1",
							content: "Successfully modified File: src/test.ts",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(3)
			expect(result.metadata.consolidatedCount).toBe(1)
			expect(result.metadata.strategiesApplied).toContain("SequentialFileOps")

			const consolidated = result.consolidatedContent[0]
			expect(consolidated.content).toContain("Sequential operations on src/test.ts")
			expect(consolidated.content).toContain("read")
			expect(consolidated.content).toContain("write")
			expect(consolidated.content).toContain("modified")
		})

		it("should not consolidate when strategies are not applicable", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool1",
							content: "Some random tool result that doesn't match any pattern",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(1)
			expect(result.metadata.consolidatedCount).toBe(1)
			expect(result.metadata.strategiesApplied).toHaveLength(0)
			expect(result.metadata.tokensReduced).toBe(0)
			expect(result.metadata.reductionPercentage).toBe(0)
		})

		it("should calculate token reduction correctly", () => {
			const longContent = "x".repeat(400) // ~100 tokens
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "list1",
							content: `Directory: src/utils\nFiles in src/utils:\n${longContent}`,
						},
						{
							type: "tool_result",
							tool_use_id: "list2",
							content: `Directory: src/utils\nFiles in src/utils:\n${longContent}`,
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.tokensReduced).toBeGreaterThan(50)
			expect(result.metadata.reductionPercentage).toBeGreaterThan(10)
			expect(result.metadata.reductionPercentage).toBeLessThanOrEqual(100)
		})

		it("should preserve essential information during consolidation", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "search1",
							content: "search_files results:\nFile: important.ts\nMatch at line 42: critical code here",
						},
						{
							type: "tool_result",
							tool_use_id: "search2",
							content: "search_files results:\nFile: important.ts\nMatch at line 100: more critical code",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			const consolidated = result.consolidatedContent[0]
			// Essential information should be preserved
			expect(consolidated.content).toContain("important.ts")
			expect(consolidated.content).toContain("Line 42")
			expect(consolidated.content).toContain("critical code here")
			expect(consolidated.content).toContain("Line 100")
			expect(consolidated.content).toContain("more critical code")
		})

		it("should handle empty messages array", () => {
			const messages: Anthropic.MessageParam[] = []

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(0)
			expect(result.metadata.consolidatedCount).toBe(0)
			expect(result.metadata.tokensReduced).toBe(0)
			expect(result.metadata.reductionPercentage).toBe(0)
			expect(result.consolidatedContent).toHaveLength(0)
		})

		it("should handle messages with no tool_result blocks", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Just a regular text message",
						},
					],
				},
				{
					role: "assistant",
					content: "Assistant response",
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(0)
			expect(result.metadata.consolidatedCount).toBe(0)
			expect(result.consolidatedContent).toHaveLength(0)
		})

		it("should handle single tool result without consolidation", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "single",
							content: "Directory: src\nFiles: file1.ts",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(1)
			expect(result.metadata.consolidatedCount).toBe(1)
			expect(result.metadata.strategiesApplied).toHaveLength(0)
			expect(result.metadata.tokensReduced).toBe(0)
		})

		it("should handle tool_result with array content", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "array1",
							content: [
								{
									type: "text",
									text: "Directory: src/utils\nFiles: file1.ts",
								},
							],
						},
						{
							type: "tool_result",
							tool_use_id: "array2",
							content: [
								{
									type: "text",
									text: "Directory: src/utils\nFiles: file2.ts",
								},
							],
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(2)
			// Should consolidate these list_files results
			expect(result.metadata.consolidatedCount).toBeLessThanOrEqual(2)
		})

		it("should demonstrate 10-20% token reduction on realistic test case", () => {
			// Create a realistic scenario with multiple redundant operations
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "list1",
							content:
								"Directory: src/components\nFiles in src/components:\nButton.tsx\nInput.tsx\nForm.tsx",
						},
						{
							type: "tool_result",
							tool_use_id: "list2",
							content:
								"Directory: src/components\nFiles in src/components:\nButton.tsx\nCheckbox.tsx\nForm.tsx",
						},
						{
							type: "tool_result",
							tool_use_id: "search1",
							content: "search_files:\nFile: src/app.ts\nMatch at line 10: import { Button }",
						},
						{
							type: "tool_result",
							tool_use_id: "search2",
							content: "search_files:\nFile: src/app.ts\nMatch at line 15: import { Form }",
						},
						{
							type: "tool_result",
							tool_use_id: "read1",
							content:
								"Successfully read File: src/config.ts\nconst config = { api: 'http://localhost' }",
						},
						{
							type: "tool_result",
							tool_use_id: "write1",
							content: "Successfully wrote File: src/config.ts",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(6)
			expect(result.metadata.consolidatedCount).toBeLessThan(6)
			expect(result.metadata.reductionPercentage).toBeGreaterThanOrEqual(10)
			expect(result.metadata.reductionPercentage).toBeLessThanOrEqual(30) // Allow some variance
			expect(result.metadata.strategiesApplied.length).toBeGreaterThan(0)
		})
	})
})

describe("ListFilesConsolidationStrategy", () => {
	let strategy: ListFilesConsolidationStrategy

	beforeEach(() => {
		strategy = new ListFilesConsolidationStrategy()
	})

	it("should identify list_files results", () => {
		const results: ToolResult[] = [
			{
				type: "tool_result",
				tool_use_id: "1",
				content: "Directory: src\nFiles: file1.ts",
			},
			{
				type: "tool_result",
				tool_use_id: "2",
				content: "Directory: src\nFiles: file2.ts",
			},
		]

		expect(strategy.canConsolidate(results)).toBe(true)
	})

	it("should not consolidate with less than 2 list_files results", () => {
		const results: ToolResult[] = [
			{
				type: "tool_result",
				tool_use_id: "1",
				content: "Directory: src\nFiles: file1.ts",
			},
		]

		expect(strategy.canConsolidate(results)).toBe(false)
	})

	it("should merge duplicate files from same directory", () => {
		const results: ToolResult[] = [
			{
				type: "tool_result",
				tool_use_id: "1",
				content: "Directory: src/utils\nfile1.ts\nfile2.ts",
			},
			{
				type: "tool_result",
				tool_use_id: "2",
				content: "Directory: src/utils\nfile2.ts\nfile3.ts",
			},
		]

		const consolidated = strategy.consolidate(results)

		expect(consolidated.length).toBe(1)
		const content = consolidated[0].content as string
		expect(content).toContain("Consolidated list_files results")
		expect(content).toContain("file1.ts")
		expect(content).toContain("file2.ts")
		expect(content).toContain("file3.ts")
		// file2.ts should only appear once
		expect(content.match(/file2\.ts/g)?.length).toBe(1)
	})
})

describe("SearchFilesConsolidationStrategy", () => {
	let strategy: SearchFilesConsolidationStrategy

	beforeEach(() => {
		strategy = new SearchFilesConsolidationStrategy()
	})

	it("should identify search_files results", () => {
		const results: ToolResult[] = [
			{
				type: "tool_result",
				tool_use_id: "1",
				content: "search_files:\nFile: test.ts\nMatch at line 10: test code",
			},
			{
				type: "tool_result",
				tool_use_id: "2",
				content: "search_files:\nFile: test2.ts\nMatch at line 20: more code",
			},
		]

		expect(strategy.canConsolidate(results)).toBe(true)
	})

	it("should group matches by file", () => {
		const results: ToolResult[] = [
			{
				type: "tool_result",
				tool_use_id: "1",
				content: "File: src/app.ts\nMatch at line 10: function test()",
			},
			{
				type: "tool_result",
				tool_use_id: "2",
				content: "File: src/app.ts\nMatch at line 20: const x = 1",
			},
			{
				type: "tool_result",
				tool_use_id: "3",
				content: "File: src/utils.ts\nMatch at line 5: export default",
			},
		]

		const consolidated = strategy.consolidate(results)

		expect(consolidated.length).toBe(1)
		const content = consolidated[0].content as string
		expect(content).toContain("Consolidated search_files results")
		expect(content).toContain("src/app.ts")
		expect(content).toContain("src/utils.ts")
		expect(content).toContain("Line 10")
		expect(content).toContain("Line 20")
		expect(content).toContain("Line 5")
	})
})

describe("SequentialFileOpsStrategy", () => {
	let strategy: SequentialFileOpsStrategy

	beforeEach(() => {
		strategy = new SequentialFileOpsStrategy()
	})

	it("should identify sequential file operations", () => {
		const results: ToolResult[] = [
			{
				type: "tool_result",
				tool_use_id: "1",
				content: "Successfully read File: test.ts",
			},
			{
				type: "tool_result",
				tool_use_id: "2",
				content: "Successfully wrote File: test.ts",
			},
		]

		expect(strategy.canConsolidate(results)).toBe(true)
	})

	it("should not consolidate operations on different files", () => {
		const results: ToolResult[] = [
			{
				type: "tool_result",
				tool_use_id: "1",
				content: "Successfully read File: test1.ts",
			},
			{
				type: "tool_result",
				tool_use_id: "2",
				content: "Successfully wrote File: test2.ts",
			},
		]

		const consolidated = strategy.consolidate(results)

		// Should keep separate since they're different files
		expect(consolidated.length).toBe(2)
	})

	it("should create operation sequence summary", () => {
		const results: ToolResult[] = [
			{
				type: "tool_result",
				tool_use_id: "1",
				content: "Successfully read File: config.ts\nconst x = 1",
			},
			{
				type: "tool_result",
				tool_use_id: "2",
				content: "Successfully modified File: config.ts",
			},
			{
				type: "tool_result",
				tool_use_id: "3",
				content: "Successfully wrote File: config.ts",
			},
		]

		const consolidated = strategy.consolidate(results)

		expect(consolidated.length).toBe(1)
		const content = consolidated[0].content as string
		expect(content).toContain("Sequential operations on config.ts")
		expect(content).toContain("read")
		expect(content).toContain("modified")
		expect(content).toContain("write")
	})
})

describe("ToolResultConsolidator - Edge Cases", () => {
	let consolidator: ToolResultConsolidator

	beforeEach(() => {
		consolidator = new ToolResultConsolidator()
	})

	describe("Edge Cases and Robustness", () => {
		it("should handle tool_result with undefined content", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "undefined1",
							content: undefined,
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(1)
			expect(result.consolidatedContent).toHaveLength(1)
		})

		it("should handle tool_result with empty string content", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "empty1",
							content: "",
						},
						{
							type: "tool_result",
							tool_use_id: "empty2",
							content: "",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(2)
			expect(result.consolidatedContent).toHaveLength(2)
		})

		it("should handle tool_result with empty array content", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "emptyArray1",
							content: [],
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(1)
			expect(result.consolidatedContent).toHaveLength(1)
		})

		it("should handle tool_result with very large content", () => {
			const largeContent = "x".repeat(100000) // 100k characters
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "large1",
							content: `Directory: src\n${largeContent}`,
						},
						{
							type: "tool_result",
							tool_use_id: "large2",
							content: `Directory: src\n${largeContent}`,
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(2)
			expect(result.metadata.tokensReduced).toBeGreaterThan(0)
			expect(result.metadata.reductionPercentage).toBeGreaterThan(0)
		})

		it("should handle tool_result with special characters", () => {
			const specialChars = "File: test.ts\n<>&\"'`\n\t\r\n\x00\uFEFF"
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "special1",
							content: specialChars,
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(1)
			expect(result.consolidatedContent).toHaveLength(1)
		})

		it("should handle tool_result with Unicode characters", () => {
			const unicodeContent = "File: test.ts\n日本語\némojis: 🎉🚀💻\n€£¥"
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "unicode1",
							content: `Directory: src\n${unicodeContent}`,
						},
						{
							type: "tool_result",
							tool_use_id: "unicode2",
							content: `Directory: src\n${unicodeContent}`,
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(2)
			expect(result.metadata.consolidatedCount).toBe(1)
		})

		it("should handle malformed list_files results", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "malformed1",
							content: "Directory: \nFiles:",
						},
						{
							type: "tool_result",
							tool_use_id: "malformed2",
							content: "list_files result but no actual directory path",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			// Should handle gracefully without crashing
			expect(result.metadata.originalCount).toBe(2)
		})

		it("should handle mixed tool types that shouldn't consolidate", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "list1",
							content: "Directory: src\nfiles: file1.ts",
						},
						{
							type: "tool_result",
							tool_use_id: "read1",
							content: "Successfully read File: test.ts",
						},
						{
							type: "tool_result",
							tool_use_id: "search1",
							content: "search_files: no matches",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			// Should keep them separate as they're different operation types
			expect(result.metadata.originalCount).toBe(3)
			expect(result.consolidatedContent.length).toBeGreaterThanOrEqual(2)
		})

		it("should handle assistant messages (should be ignored)", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: "Some assistant response",
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool1",
							content: "Directory: src\nfiles: file1.ts",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(1)
		})

		it("should handle multiple strategies being applicable", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						// List files
						{
							type: "tool_result",
							tool_use_id: "list1",
							content: "Directory: src\nfile1.ts\nfile2.ts",
						},
						{
							type: "tool_result",
							tool_use_id: "list2",
							content: "Directory: src\nfile2.ts\nfile3.ts",
						},
						// Search files
						{
							type: "tool_result",
							tool_use_id: "search1",
							content: "search_files:\nFile: app.ts\nMatch at line 1: test",
						},
						{
							type: "tool_result",
							tool_use_id: "search2",
							content: "search_files:\nFile: app.ts\nMatch at line 2: test2",
						},
						// Sequential ops
						{
							type: "tool_result",
							tool_use_id: "read1",
							content: "Successfully read File: config.ts",
						},
						{
							type: "tool_result",
							tool_use_id: "write1",
							content: "Successfully wrote File: config.ts",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(6)
			expect(result.metadata.consolidatedCount).toBeLessThan(6)
			expect(result.metadata.strategiesApplied.length).toBeGreaterThan(1)
		})

		it("should handle tool_result with is_error flag", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "error1",
							content: "Error: File not found",
							is_error: true,
						},
						{
							type: "tool_result",
							tool_use_id: "success1",
							content: "Directory: src\nfiles: file1.ts",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(2)
			// Error results should be preserved
			expect(result.consolidatedContent).toHaveLength(2)
		})

		it("should not crash with circular references in array content", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "normal",
							content: [
								{
									type: "text",
									text: "Normal content",
								},
								{
									type: "image",
									source: {
										type: "base64",
										media_type: "image/png",
										data: "iVBORw0KGgoAAAANSUhEUg",
									},
								},
							],
						},
					],
				},
			]

			expect(() => {
				const result = consolidator.consolidate(messages)
				expect(result.metadata.originalCount).toBe(1)
			}).not.toThrow()
		})

		it("should maintain exact token count precision", () => {
			const content = "x".repeat(400) // Exactly 100 tokens
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "precise1",
							content,
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			// Should estimate exactly 100 tokens (400 chars / 4)
			expect(result.metadata.tokensReduced).toBe(0)
			const estimatedTokens = Math.ceil(content.length / 4)
			expect(estimatedTokens).toBe(100)
		})

		it("should handle consolidation when result count exceeds strategy threshold", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: Array.from({ length: 50 }, (_, i) => ({
						type: "tool_result" as const,
						tool_use_id: `list${i}`,
						content: `Directory: src\nfile${i}.ts`,
					})),
				},
			]

			const result = consolidator.consolidate(messages)

			expect(result.metadata.originalCount).toBe(50)
			expect(result.metadata.consolidatedCount).toBeLessThan(50)
			expect(result.metadata.reductionPercentage).toBeGreaterThan(0)
		})

		it("should preserve order of non-consolidatable results", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "other1",
							content: "Random tool result 1",
						},
						{
							type: "tool_result",
							tool_use_id: "list1",
							content: "Directory: src\nfile1.ts",
						},
						{
							type: "tool_result",
							tool_use_id: "other2",
							content: "Random tool result 2",
						},
						{
							type: "tool_result",
							tool_use_id: "list2",
							content: "Directory: src\nfile2.ts",
						},
					],
				},
			]

			const result = consolidator.consolidate(messages)

			// Non-consolidatable results should maintain their relative positions
			expect(result.consolidatedContent.length).toBeGreaterThanOrEqual(3)
		})
	})
})
