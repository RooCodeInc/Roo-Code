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

		describe("parseToolCall", () => {
			describe("apply_diff tool", () => {
				it("should handle single-file format (path and diff)", () => {
					const toolCall = {
						id: "toolu_123",
						name: "apply_diff" as const,
						arguments: JSON.stringify({
							path: "src/test.ts",
							diff: "<<<<<<< SEARCH\nold code\n=======\nnew code\n>>>>>>> REPLACE",
						}),
					}

					const result = NativeToolCallParser.parseToolCall(toolCall)

					expect(result).not.toBeNull()
					expect(result?.type).toBe("tool_use")
					if (result?.type === "tool_use") {
						expect(result.nativeArgs).toBeDefined()
						const nativeArgs = result.nativeArgs as { path: string; diff: string }
						expect(nativeArgs.path).toBe("src/test.ts")
						expect(nativeArgs.diff).toContain("<<<<<<< SEARCH")
						expect(nativeArgs.diff).toContain(">>>>>>> REPLACE")
					}
				})

				it("should handle multi-file format (files array)", () => {
					const toolCall = {
						id: "toolu_456",
						name: "apply_diff" as const,
						arguments: JSON.stringify({
							files: [
								{
									path: "src/file1.ts",
									diff: "<<<<<<< SEARCH\nold code 1\n=======\nnew code 1\n>>>>>>> REPLACE",
								},
								{
									path: "src/file2.ts",
									diff: "<<<<<<< SEARCH\nold code 2\n=======\nnew code 2\n>>>>>>> REPLACE",
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
							files: Array<{ path: string; diff: string }>
						}
						expect(nativeArgs.files).toHaveLength(2)
						expect(nativeArgs.files[0].path).toBe("src/file1.ts")
						expect(nativeArgs.files[0].diff).toContain("old code 1")
						expect(nativeArgs.files[1].path).toBe("src/file2.ts")
						expect(nativeArgs.files[1].diff).toContain("old code 2")
					}
				})

				it("should handle multi-file format with single file", () => {
					const toolCall = {
						id: "toolu_789",
						name: "apply_diff" as const,
						arguments: JSON.stringify({
							files: [
								{
									path: "src/single.ts",
									diff: "<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE",
								},
							],
						}),
					}

					const result = NativeToolCallParser.parseToolCall(toolCall)

					expect(result).not.toBeNull()
					expect(result?.type).toBe("tool_use")
					if (result?.type === "tool_use") {
						const nativeArgs = result.nativeArgs as {
							files: Array<{ path: string; diff: string }>
						}
						expect(nativeArgs.files).toHaveLength(1)
						expect(nativeArgs.files[0].path).toBe("src/single.ts")
					}
				})
			})
		})

		describe("processStreamingChunk", () => {
			describe("apply_diff tool", () => {
				it("should handle single-file format during streaming", () => {
					const id = "toolu_streaming_apply_diff_single"
					NativeToolCallParser.startStreamingToolCall(id, "apply_diff")

					const fullArgs = JSON.stringify({
						path: "streaming/test.ts",
						diff: "<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE",
					})

					const result = NativeToolCallParser.processStreamingChunk(id, fullArgs)

					expect(result).not.toBeNull()
					expect(result?.nativeArgs).toBeDefined()
					const nativeArgs = result?.nativeArgs as { path: string; diff: string }
					expect(nativeArgs.path).toBe("streaming/test.ts")
					expect(nativeArgs.diff).toContain("<<<<<<< SEARCH")
				})

				it("should handle multi-file format during streaming", () => {
					const id = "toolu_streaming_apply_diff_multi"
					NativeToolCallParser.startStreamingToolCall(id, "apply_diff")

					const fullArgs = JSON.stringify({
						files: [
							{
								path: "streaming/file1.ts",
								diff: "<<<<<<< SEARCH\nold1\n=======\nnew1\n>>>>>>> REPLACE",
							},
							{
								path: "streaming/file2.ts",
								diff: "<<<<<<< SEARCH\nold2\n=======\nnew2\n>>>>>>> REPLACE",
							},
						],
					})

					const result = NativeToolCallParser.processStreamingChunk(id, fullArgs)

					expect(result).not.toBeNull()
					expect(result?.nativeArgs).toBeDefined()
					const nativeArgs = result?.nativeArgs as {
						files: Array<{ path: string; diff: string }>
					}
					expect(nativeArgs.files).toHaveLength(2)
					expect(nativeArgs.files[0].path).toBe("streaming/file1.ts")
					expect(nativeArgs.files[1].path).toBe("streaming/file2.ts")
				})
			})
		})

		describe("finalizeStreamingToolCall", () => {
			describe("apply_diff tool", () => {
				it("should finalize single-file format correctly", () => {
					const id = "toolu_finalize_apply_diff_single"
					NativeToolCallParser.startStreamingToolCall(id, "apply_diff")

					NativeToolCallParser.processStreamingChunk(
						id,
						JSON.stringify({
							path: "finalized/single.ts",
							diff: "<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE",
						}),
					)

					const result = NativeToolCallParser.finalizeStreamingToolCall(id)

					expect(result).not.toBeNull()
					expect(result?.type).toBe("tool_use")
					if (result?.type === "tool_use") {
						const nativeArgs = result.nativeArgs as { path: string; diff: string }
						expect(nativeArgs.path).toBe("finalized/single.ts")
						expect(nativeArgs.diff).toContain("<<<<<<< SEARCH")
					}
				})

				it("should finalize multi-file format correctly", () => {
					const id = "toolu_finalize_apply_diff_multi"
					NativeToolCallParser.startStreamingToolCall(id, "apply_diff")

					NativeToolCallParser.processStreamingChunk(
						id,
						JSON.stringify({
							files: [
								{
									path: "finalized/file1.ts",
									diff: "<<<<<<< SEARCH\nold1\n=======\nnew1\n>>>>>>> REPLACE",
								},
								{
									path: "finalized/file2.ts",
									diff: "<<<<<<< SEARCH\nold2\n=======\nnew2\n>>>>>>> REPLACE",
								},
							],
						}),
					)

					const result = NativeToolCallParser.finalizeStreamingToolCall(id)

					expect(result).not.toBeNull()
					expect(result?.type).toBe("tool_use")
					if (result?.type === "tool_use") {
						const nativeArgs = result.nativeArgs as {
							files: Array<{ path: string; diff: string }>
						}
						expect(nativeArgs.files).toHaveLength(2)
						expect(nativeArgs.files[0].path).toBe("finalized/file1.ts")
						expect(nativeArgs.files[1].path).toBe("finalized/file2.ts")
					}
				})
			})
		})
	})
})
