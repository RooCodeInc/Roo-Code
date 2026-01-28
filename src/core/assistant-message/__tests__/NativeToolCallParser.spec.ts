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
	})

	describe("write_to_file tool - content type coercion", () => {
		describe("parseToolCall", () => {
			it("should handle content as a string (normal case)", () => {
				const toolCall = {
					id: "toolu_123",
					name: "write_to_file" as const,
					arguments: JSON.stringify({
						path: "package.json",
						content: '{\n  "name": "test"\n}',
					}),
				}

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as { path: string; content: string }
					expect(nativeArgs.path).toBe("package.json")
					expect(nativeArgs.content).toBe('{\n  "name": "test"\n}')
				}
			})

			it("should coerce content from object to JSON string", () => {
				// This simulates the bug where models like GLM 4.7 pass content as an object
				const toolCall = {
					id: "toolu_456",
					name: "write_to_file" as const,
					arguments: JSON.stringify({
						path: "package.json",
						content: { name: "sample-project", version: "1.0.0" },
					}),
				}

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as { path: string; content: string }
					expect(nativeArgs.path).toBe("package.json")
					// Content should be converted to a formatted JSON string
					expect(nativeArgs.content).toBe(
						JSON.stringify({ name: "sample-project", version: "1.0.0" }, null, 2),
					)
				}

				// Should log a warning about the type coercion
				expect(consoleSpy).toHaveBeenCalledWith(
					expect.stringContaining("Model sent non-string content for 'write_to_file' tool"),
				)

				consoleSpy.mockRestore()
			})

			it("should coerce content from array to JSON string", () => {
				const toolCall = {
					id: "toolu_789",
					name: "write_to_file" as const,
					arguments: JSON.stringify({
						path: "data.json",
						content: [1, 2, 3, { key: "value" }],
					}),
				}

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as { path: string; content: string }
					expect(nativeArgs.content).toBe(JSON.stringify([1, 2, 3, { key: "value" }], null, 2))
				}

				expect(consoleSpy).toHaveBeenCalled()
				consoleSpy.mockRestore()
			})

			it("should coerce content from number to string", () => {
				const toolCall = {
					id: "toolu_num",
					name: "write_to_file" as const,
					arguments: JSON.stringify({
						path: "number.txt",
						content: 42,
					}),
				}

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as { path: string; content: string }
					expect(nativeArgs.content).toBe("42")
				}

				expect(consoleSpy).toHaveBeenCalled()
				consoleSpy.mockRestore()
			})
		})

		describe("processStreamingChunk", () => {
			it("should coerce content from object to JSON string during streaming", () => {
				const id = "toolu_streaming_write"
				NativeToolCallParser.startStreamingToolCall(id, "write_to_file")

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

				const fullArgs = JSON.stringify({
					path: "config.json",
					content: { setting: true, value: 123 },
				})

				const result = NativeToolCallParser.processStreamingChunk(id, fullArgs)

				expect(result).not.toBeNull()
				if (result?.nativeArgs) {
					const nativeArgs = result.nativeArgs as { path: string; content: string }
					expect(nativeArgs.path).toBe("config.json")
					expect(nativeArgs.content).toBe(JSON.stringify({ setting: true, value: 123 }, null, 2))
				}

				expect(consoleSpy).toHaveBeenCalled()
				consoleSpy.mockRestore()
			})
		})

		describe("finalizeStreamingToolCall", () => {
			it("should coerce content from object to JSON string on finalize", () => {
				const id = "toolu_finalize_write"
				NativeToolCallParser.startStreamingToolCall(id, "write_to_file")

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

				NativeToolCallParser.processStreamingChunk(
					id,
					JSON.stringify({
						path: "tsconfig.json",
						content: { compilerOptions: { strict: true } },
					}),
				)

				const result = NativeToolCallParser.finalizeStreamingToolCall(id)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as { path: string; content: string }
					expect(nativeArgs.path).toBe("tsconfig.json")
					expect(nativeArgs.content).toBe(JSON.stringify({ compilerOptions: { strict: true } }, null, 2))
				}

				expect(consoleSpy).toHaveBeenCalled()
				consoleSpy.mockRestore()
			})
		})
	})
})
