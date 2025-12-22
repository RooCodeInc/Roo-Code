import { NativeToolCallParser } from "../NativeToolCallParser"

describe("NativeToolCallParser", () => {
	beforeEach(() => {
		NativeToolCallParser.clearAllStreamingToolCalls()
		NativeToolCallParser.clearRawChunkState()
	})

	describe("parseToolCall", () => {
		describe("read_file tool", () => {
			it("should handle offset and mode parameters", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						files: [
							{
								path: "src/core/task/Task.ts",
								offset: 100,
								mode: "slice",
							},
						],
					}),
				}

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					expect(result.nativeArgs).toBeDefined()
					const nativeArgs = result.nativeArgs as {
						files: Array<{ path: string; offset?: number; mode?: string }>
					}
					expect(nativeArgs.files).toHaveLength(1)
					expect(nativeArgs.files[0].path).toBe("src/core/task/Task.ts")
					expect(nativeArgs.files[0].offset).toBe(100)
					expect(nativeArgs.files[0].mode).toBe("slice")
				}
			})

			it("should handle indentation mode with configuration", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						files: [
							{
								path: "src/core/task/Task.ts",
								offset: 50,
								mode: "indentation",
								indentation: {
									anchorLine: 55,
									maxLevels: 2,
									includeSiblings: true,
								},
							},
						],
					}),
				}

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					expect(result.nativeArgs).toBeDefined()
					const nativeArgs = result.nativeArgs as {
						files: Array<{
							path: string
							offset?: number
							mode?: string
							indentation?: { anchorLine?: number; maxLevels?: number; includeSiblings?: boolean }
						}>
					}
					expect(nativeArgs.files).toHaveLength(1)
					expect(nativeArgs.files[0].path).toBe("src/core/task/Task.ts")
					expect(nativeArgs.files[0].offset).toBe(50)
					expect(nativeArgs.files[0].mode).toBe("indentation")
					expect(nativeArgs.files[0].indentation?.anchorLine).toBe(55)
					expect(nativeArgs.files[0].indentation?.maxLevels).toBe(2)
					expect(nativeArgs.files[0].indentation?.includeSiblings).toBe(true)
				}
			})

			it("should handle files without offset or mode (defaults)", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						files: [
							{
								path: "src/utils.ts",
							},
						],
					}),
				}

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as {
						files: Array<{ path: string; offset?: number; mode?: string }>
					}
					expect(nativeArgs.files).toHaveLength(1)
					expect(nativeArgs.files[0].path).toBe("src/utils.ts")
					expect(nativeArgs.files[0].offset).toBeUndefined()
					expect(nativeArgs.files[0].mode).toBeUndefined()
				}
			})

			it("should handle multiple files with different offsets and modes", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						files: [
							{
								path: "file1.ts",
								offset: 1,
								mode: "slice",
							},
							{
								path: "file2.ts",
								offset: 100,
								mode: "indentation",
								indentation: { maxLevels: 1 },
							},
							{
								path: "file3.ts",
							},
						],
					}),
				}

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as {
						files: Array<{
							path: string
							offset?: number
							mode?: string
							indentation?: { maxLevels?: number }
						}>
					}
					expect(nativeArgs.files).toHaveLength(3)
					expect(nativeArgs.files[0].offset).toBe(1)
					expect(nativeArgs.files[0].mode).toBe("slice")
					expect(nativeArgs.files[1].offset).toBe(100)
					expect(nativeArgs.files[1].mode).toBe("indentation")
					expect(nativeArgs.files[1].indentation?.maxLevels).toBe(1)
					expect(nativeArgs.files[2].offset).toBeUndefined()
					expect(nativeArgs.files[2].mode).toBeUndefined()
				}
			})

			it("should ignore invalid offset and mode values", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						files: [
							{
								path: "file.ts",
								offset: -10, // Invalid - should be ignored
								mode: "invalid_mode", // Invalid - should be ignored
							},
						],
					}),
				}

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as {
						files: Array<{ path: string; offset?: number; mode?: string }>
					}
					// Invalid values should not be passed through
					expect(nativeArgs.files[0].offset).toBeUndefined()
					expect(nativeArgs.files[0].mode).toBeUndefined()
				}
			})
		})
	})

	describe("processStreamingChunk", () => {
		describe("read_file tool", () => {
			it("should parse offset and mode during streaming", () => {
				const id = "toolu_streaming_123"
				NativeToolCallParser.startStreamingToolCall(id, "read_file")

				// Simulate streaming chunks
				const fullArgs = JSON.stringify({
					files: [
						{
							path: "src/test.ts",
							offset: 50,
							mode: "slice",
						},
					],
				})

				// Process the complete args as a single chunk for simplicity
				const result = NativeToolCallParser.processStreamingChunk(id, fullArgs)

				expect(result).not.toBeNull()
				expect(result?.nativeArgs).toBeDefined()
				const nativeArgs = result?.nativeArgs as {
					files: Array<{ path: string; offset?: number; mode?: string }>
				}
				expect(nativeArgs.files).toHaveLength(1)
				expect(nativeArgs.files[0].offset).toBe(50)
				expect(nativeArgs.files[0].mode).toBe("slice")
			})
		})
	})

	describe("finalizeStreamingToolCall", () => {
		describe("read_file tool", () => {
			it("should parse offset and mode on finalize", () => {
				const id = "toolu_finalize_123"
				NativeToolCallParser.startStreamingToolCall(id, "read_file")

				// Add the complete arguments
				NativeToolCallParser.processStreamingChunk(
					id,
					JSON.stringify({
						files: [
							{
								path: "finalized.ts",
								offset: 500,
								mode: "indentation",
								indentation: { anchorLine: 520 },
							},
						],
					}),
				)

				const result = NativeToolCallParser.finalizeStreamingToolCall(id)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as {
						files: Array<{
							path: string
							offset?: number
							mode?: string
							indentation?: { anchorLine?: number }
						}>
					}
					expect(nativeArgs.files[0].path).toBe("finalized.ts")
					expect(nativeArgs.files[0].offset).toBe(500)
					expect(nativeArgs.files[0].mode).toBe("indentation")
					expect(nativeArgs.files[0].indentation?.anchorLine).toBe(520)
				}
			})
		})
	})
})
