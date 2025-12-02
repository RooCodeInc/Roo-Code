import { NativeToolCallParser } from "../NativeToolCallParser"

describe("NativeToolCallParser", () => {
	beforeEach(() => {
		NativeToolCallParser.clearAllStreamingToolCalls()
		NativeToolCallParser.clearRawChunkState()
	})

	describe("parseToolCall", () => {
		describe("read_file tool", () => {
			it("should handle line_ranges as tuples (new format)", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						files: [
							{
								path: "src/core/task/Task.ts",
								line_ranges: [
									[1920, 1990],
									[2060, 2120],
								],
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
						files: Array<{ path: string; lineRanges?: Array<{ start: number; end: number }> }>
					}
					expect(nativeArgs.files).toHaveLength(1)
					expect(nativeArgs.files[0].path).toBe("src/core/task/Task.ts")
					expect(nativeArgs.files[0].lineRanges).toEqual([
						{ start: 1920, end: 1990 },
						{ start: 2060, end: 2120 },
					])
				}
			})

			it("should handle line_ranges as strings (legacy format)", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						files: [
							{
								path: "src/core/task/Task.ts",
								line_ranges: ["1920-1990", "2060-2120"],
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
						files: Array<{ path: string; lineRanges?: Array<{ start: number; end: number }> }>
					}
					expect(nativeArgs.files).toHaveLength(1)
					expect(nativeArgs.files[0].path).toBe("src/core/task/Task.ts")
					expect(nativeArgs.files[0].lineRanges).toEqual([
						{ start: 1920, end: 1990 },
						{ start: 2060, end: 2120 },
					])
				}
			})

			it("should handle files without line_ranges", () => {
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
						files: Array<{ path: string; lineRanges?: Array<{ start: number; end: number }> }>
					}
					expect(nativeArgs.files).toHaveLength(1)
					expect(nativeArgs.files[0].path).toBe("src/utils.ts")
					expect(nativeArgs.files[0].lineRanges).toBeUndefined()
				}
			})

			it("should handle multiple files with different line_ranges", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						files: [
							{
								path: "file1.ts",
								line_ranges: ["1-50"],
							},
							{
								path: "file2.ts",
								line_ranges: ["100-150", "200-250"],
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
						files: Array<{ path: string; lineRanges?: Array<{ start: number; end: number }> }>
					}
					expect(nativeArgs.files).toHaveLength(3)
					expect(nativeArgs.files[0].lineRanges).toEqual([{ start: 1, end: 50 }])
					expect(nativeArgs.files[1].lineRanges).toEqual([
						{ start: 100, end: 150 },
						{ start: 200, end: 250 },
					])
					expect(nativeArgs.files[2].lineRanges).toBeUndefined()
				}
			})

			it("should filter out invalid line_range strings", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						files: [
							{
								path: "file.ts",
								line_ranges: ["1-50", "invalid", "100-200", "abc-def"],
							},
						],
					}),
				}

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as {
						files: Array<{ path: string; lineRanges?: Array<{ start: number; end: number }> }>
					}
					expect(nativeArgs.files[0].lineRanges).toEqual([
						{ start: 1, end: 50 },
						{ start: 100, end: 200 },
					])
				}
			})
		})
	})

	describe("processStreamingChunk", () => {
		describe("read_file tool", () => {
			it("should convert line_ranges strings to lineRanges objects during streaming", () => {
				const id = "toolu_streaming_123"
				NativeToolCallParser.startStreamingToolCall(id, "read_file")

				// Simulate streaming chunks
				const fullArgs = JSON.stringify({
					files: [
						{
							path: "src/test.ts",
							line_ranges: ["10-20", "30-40"],
						},
					],
				})

				// Process the complete args as a single chunk for simplicity
				const result = NativeToolCallParser.processStreamingChunk(id, fullArgs)

				expect(result).not.toBeNull()
				expect(result?.nativeArgs).toBeDefined()
				const nativeArgs = result?.nativeArgs as {
					files: Array<{ path: string; lineRanges?: Array<{ start: number; end: number }> }>
				}
				expect(nativeArgs.files).toHaveLength(1)
				expect(nativeArgs.files[0].lineRanges).toEqual([
					{ start: 10, end: 20 },
					{ start: 30, end: 40 },
				])
			})
		})
	})

	describe("finalizeStreamingToolCall", () => {
		describe("read_file tool", () => {
			it("should convert line_ranges strings to lineRanges objects on finalize", () => {
				const id = "toolu_finalize_123"
				NativeToolCallParser.startStreamingToolCall(id, "read_file")

				// Add the complete arguments
				NativeToolCallParser.processStreamingChunk(
					id,
					JSON.stringify({
						files: [
							{
								path: "finalized.ts",
								line_ranges: ["500-600"],
							},
						],
					}),
				)

				const result = NativeToolCallParser.finalizeStreamingToolCall(id)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as {
						files: Array<{ path: string; lineRanges?: Array<{ start: number; end: number }> }>
					}
					expect(nativeArgs.files[0].path).toBe("finalized.ts")
					expect(nativeArgs.files[0].lineRanges).toEqual([{ start: 500, end: 600 }])
				}
			})
		})

		describe("malformed tool calls", () => {
			it("should return null when JSON arguments are malformed (missing closing brace)", () => {
				const id = "toolu_malformed_1"
				NativeToolCallParser.startStreamingToolCall(id, "apply_diff")

				// Simulate malformed JSON - missing closing brace (model error scenario from PR #9542)
				NativeToolCallParser.processStreamingChunk(id, '{"path": "alphametics.go"')

				const result = NativeToolCallParser.finalizeStreamingToolCall(id)

				// Should return null because JSON.parse will fail
				expect(result).toBeNull()
			})

			it("should return null when JSON is completely empty", () => {
				const id = "toolu_malformed_2"
				NativeToolCallParser.startStreamingToolCall(id, "apply_diff")

				// Process empty/no arguments
				NativeToolCallParser.processStreamingChunk(id, "")

				const result = NativeToolCallParser.finalizeStreamingToolCall(id)

				expect(result).toBeNull()
			})

			it("should return null when JSON is only whitespace", () => {
				const id = "toolu_malformed_3"
				NativeToolCallParser.startStreamingToolCall(id, "apply_diff")

				NativeToolCallParser.processStreamingChunk(id, "   ")

				const result = NativeToolCallParser.finalizeStreamingToolCall(id)

				expect(result).toBeNull()
			})

			it("should return null when tool call was never started", () => {
				const result = NativeToolCallParser.finalizeStreamingToolCall("nonexistent_id")

				expect(result).toBeNull()
			})

			it("should return null for incomplete JSON with only opening bracket", () => {
				const id = "toolu_malformed_4"
				NativeToolCallParser.startStreamingToolCall(id, "read_file")

				NativeToolCallParser.processStreamingChunk(id, "{")

				const result = NativeToolCallParser.finalizeStreamingToolCall(id)

				expect(result).toBeNull()
			})

			it("should return null for JSON with syntax error (trailing comma)", () => {
				const id = "toolu_malformed_5"
				NativeToolCallParser.startStreamingToolCall(id, "read_file")

				NativeToolCallParser.processStreamingChunk(id, '{"files": [],}')

				const result = NativeToolCallParser.finalizeStreamingToolCall(id)

				expect(result).toBeNull()
			})

			it("should handle tool call with valid JSON but parseToolCall returns null", () => {
				const id = "toolu_parse_fail_1"
				NativeToolCallParser.startStreamingToolCall(id, "unknown_tool" as any)

				NativeToolCallParser.processStreamingChunk(id, '{"some": "data"}')

				const result = NativeToolCallParser.finalizeStreamingToolCall(id)

				// parseToolCall returns null for unknown tools, so this should be null
				expect(result).toBeNull()
			})
		})
	})
})
