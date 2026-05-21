import { NativeToolCallParser } from "../NativeToolCallParser"

describe("NativeToolCallParser", () => {
	beforeEach(() => {
		NativeToolCallParser.clearAllStreamingToolCalls()
		NativeToolCallParser.clearRawChunkState()
	})

	describe("parseToolCall", () => {
		describe("read_file tool", () => {
			it("should parse minimal single-file read_file args", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						path: "src/core/task/Task.ts",
					}),
				}

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					expect(result.nativeArgs).toBeDefined()
					const nativeArgs = result.nativeArgs as { path: string }
					expect(nativeArgs.path).toBe("src/core/task/Task.ts")
				}
			})

			it("should parse slice-mode params", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						path: "src/core/task/Task.ts",
						mode: "slice",
						offset: 10,
						limit: 20,
					}),
				}

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as {
						path: string
						mode?: string
						offset?: number
						limit?: number
					}
					expect(nativeArgs.path).toBe("src/core/task/Task.ts")
					expect(nativeArgs.mode).toBe("slice")
					expect(nativeArgs.offset).toBe(10)
					expect(nativeArgs.limit).toBe(20)
				}
			})

			it("should parse indentation-mode params", () => {
				const toolCall = {
					id: "toolu_123",
					name: "read_file" as const,
					arguments: JSON.stringify({
						path: "src/utils.ts",
						mode: "indentation",
						indentation: {
							anchor_line: 123,
							max_levels: 2,
							include_siblings: true,
							include_header: false,
						},
					}),
				}

				const result = NativeToolCallParser.parseToolCall(toolCall)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as {
						path: string
						mode?: string
						indentation?: {
							anchor_line?: number
							max_levels?: number
							include_siblings?: boolean
							include_header?: boolean
						}
					}
					expect(nativeArgs.path).toBe("src/utils.ts")
					expect(nativeArgs.mode).toBe("indentation")
					expect(nativeArgs.indentation?.anchor_line).toBe(123)
					expect(nativeArgs.indentation?.include_siblings).toBe(true)
					expect(nativeArgs.indentation?.include_header).toBe(false)
				}
			})

			// Legacy format backward compatibility tests
			describe("legacy format backward compatibility", () => {
				it("should parse legacy files array format with single file", () => {
					const toolCall = {
						id: "toolu_legacy_1",
						name: "read_file" as const,
						arguments: JSON.stringify({
							files: [{ path: "src/legacy/file.ts" }],
						}),
					}

					const result = NativeToolCallParser.parseToolCall(toolCall)

					expect(result).not.toBeNull()
					expect(result?.type).toBe("tool_use")
					if (result?.type === "tool_use") {
						expect(result.usedLegacyFormat).toBe(true)
						const nativeArgs = result.nativeArgs as { files: Array<{ path: string }>; _legacyFormat: true }
						expect(nativeArgs._legacyFormat).toBe(true)
						expect(nativeArgs.files).toHaveLength(1)
						expect(nativeArgs.files[0].path).toBe("src/legacy/file.ts")
					}
				})

				it("should parse legacy files array format with multiple files", () => {
					const toolCall = {
						id: "toolu_legacy_2",
						name: "read_file" as const,
						arguments: JSON.stringify({
							files: [{ path: "src/file1.ts" }, { path: "src/file2.ts" }, { path: "src/file3.ts" }],
						}),
					}

					const result = NativeToolCallParser.parseToolCall(toolCall)

					expect(result).not.toBeNull()
					expect(result?.type).toBe("tool_use")
					if (result?.type === "tool_use") {
						expect(result.usedLegacyFormat).toBe(true)
						const nativeArgs = result.nativeArgs as { files: Array<{ path: string }>; _legacyFormat: true }
						expect(nativeArgs.files).toHaveLength(3)
						expect(nativeArgs.files[0].path).toBe("src/file1.ts")
						expect(nativeArgs.files[1].path).toBe("src/file2.ts")
						expect(nativeArgs.files[2].path).toBe("src/file3.ts")
					}
				})

				it("should parse legacy line_ranges as tuples", () => {
					const toolCall = {
						id: "toolu_legacy_3",
						name: "read_file" as const,
						arguments: JSON.stringify({
							files: [
								{
									path: "src/task.ts",
									line_ranges: [
										[1, 50],
										[100, 150],
									],
								},
							],
						}),
					}

					const result = NativeToolCallParser.parseToolCall(toolCall)

					expect(result).not.toBeNull()
					expect(result?.type).toBe("tool_use")
					if (result?.type === "tool_use") {
						expect(result.usedLegacyFormat).toBe(true)
						const nativeArgs = result.nativeArgs as {
							files: Array<{ path: string; lineRanges?: Array<{ start: number; end: number }> }>
							_legacyFormat: true
						}
						expect(nativeArgs.files[0].lineRanges).toHaveLength(2)
						expect(nativeArgs.files[0].lineRanges?.[0]).toEqual({ start: 1, end: 50 })
						expect(nativeArgs.files[0].lineRanges?.[1]).toEqual({ start: 100, end: 150 })
					}
				})

				it("should parse legacy line_ranges as objects", () => {
					const toolCall = {
						id: "toolu_legacy_4",
						name: "read_file" as const,
						arguments: JSON.stringify({
							files: [
								{
									path: "src/task.ts",
									line_ranges: [
										{ start: 10, end: 20 },
										{ start: 30, end: 40 },
									],
								},
							],
						}),
					}

					const result = NativeToolCallParser.parseToolCall(toolCall)

					expect(result).not.toBeNull()
					expect(result?.type).toBe("tool_use")
					if (result?.type === "tool_use") {
						expect(result.usedLegacyFormat).toBe(true)
						const nativeArgs = result.nativeArgs as {
							files: Array<{ path: string; lineRanges?: Array<{ start: number; end: number }> }>
						}
						expect(nativeArgs.files[0].lineRanges).toHaveLength(2)
						expect(nativeArgs.files[0].lineRanges?.[0]).toEqual({ start: 10, end: 20 })
						expect(nativeArgs.files[0].lineRanges?.[1]).toEqual({ start: 30, end: 40 })
					}
				})

				it("should parse legacy line_ranges as strings", () => {
					const toolCall = {
						id: "toolu_legacy_5",
						name: "read_file" as const,
						arguments: JSON.stringify({
							files: [
								{
									path: "src/task.ts",
									line_ranges: ["1-50", "100-150"],
								},
							],
						}),
					}

					const result = NativeToolCallParser.parseToolCall(toolCall)

					expect(result).not.toBeNull()
					expect(result?.type).toBe("tool_use")
					if (result?.type === "tool_use") {
						expect(result.usedLegacyFormat).toBe(true)
						const nativeArgs = result.nativeArgs as {
							files: Array<{ path: string; lineRanges?: Array<{ start: number; end: number }> }>
						}
						expect(nativeArgs.files[0].lineRanges).toHaveLength(2)
						expect(nativeArgs.files[0].lineRanges?.[0]).toEqual({ start: 1, end: 50 })
						expect(nativeArgs.files[0].lineRanges?.[1]).toEqual({ start: 100, end: 150 })
					}
				})

				it("should parse double-stringified files array (model quirk)", () => {
					// This tests the real-world case where some models double-stringify the files array
					// e.g., { files: "[{\"path\": \"...\"}]" } instead of { files: [{path: "..."}] }
					const toolCall = {
						id: "toolu_double_stringify",
						name: "read_file" as const,
						arguments: JSON.stringify({
							files: JSON.stringify([
								{ path: "src/services/example/service.ts" },
								{ path: "src/services/mcp/McpServerManager.ts" },
							]),
						}),
					}

					const result = NativeToolCallParser.parseToolCall(toolCall)

					expect(result).not.toBeNull()
					expect(result?.type).toBe("tool_use")
					if (result?.type === "tool_use") {
						expect(result.usedLegacyFormat).toBe(true)
						const nativeArgs = result.nativeArgs as {
							files: Array<{ path: string }>
							_legacyFormat: true
						}
						expect(nativeArgs._legacyFormat).toBe(true)
						expect(nativeArgs.files).toHaveLength(2)
						expect(nativeArgs.files[0].path).toBe("src/services/example/service.ts")
						expect(nativeArgs.files[1].path).toBe("src/services/mcp/McpServerManager.ts")
					}
				})

				it("should NOT set usedLegacyFormat for new format", () => {
					const toolCall = {
						id: "toolu_new",
						name: "read_file" as const,
						arguments: JSON.stringify({
							path: "src/new/format.ts",
							mode: "slice",
							offset: 1,
							limit: 100,
						}),
					}

					const result = NativeToolCallParser.parseToolCall(toolCall)

					expect(result).not.toBeNull()
					expect(result?.type).toBe("tool_use")
					if (result?.type === "tool_use") {
						expect(result.usedLegacyFormat).toBeUndefined()
					}
				})
			})
		})
	})

	describe("processStreamingChunk", () => {
		describe("read_file tool", () => {
			it("should emit a partial ToolUse with nativeArgs.path during streaming", () => {
				const id = "toolu_streaming_123"
				NativeToolCallParser.startStreamingToolCall(id, "read_file")

				// Simulate streaming chunks
				const fullArgs = JSON.stringify({ path: "src/test.ts" })

				// Process the complete args as a single chunk for simplicity
				const result = NativeToolCallParser.processStreamingChunk(id, fullArgs)

				expect(result).not.toBeNull()
				expect(result?.nativeArgs).toBeDefined()
				const nativeArgs = result?.nativeArgs as { path: string }
				expect(nativeArgs.path).toBe("src/test.ts")
			})
		})
	})

	describe("finalizeStreamingToolCall", () => {
		describe("read_file tool", () => {
			it("should parse read_file args on finalize", () => {
				const id = "toolu_finalize_123"
				NativeToolCallParser.startStreamingToolCall(id, "read_file")

				// Add the complete arguments
				NativeToolCallParser.processStreamingChunk(
					id,
					JSON.stringify({
						path: "finalized.ts",
						mode: "slice",
						offset: 1,
						limit: 10,
					}),
				)

				const result = NativeToolCallParser.finalizeStreamingToolCall(id)

				expect(result).not.toBeNull()
				expect(result?.type).toBe("tool_use")
				if (result?.type === "tool_use") {
					const nativeArgs = result.nativeArgs as { path: string; offset?: number; limit?: number }
					expect(nativeArgs.path).toBe("finalized.ts")
					expect(nativeArgs.offset).toBe(1)
					expect(nativeArgs.limit).toBe(10)
				}
			})
		})
	})

	describe("Ollama single-chunk tool call pattern", () => {
		// Ollama sends the entire tool call (id + name + full arguments) in a single chunk,
		// unlike OpenAI which streams them incrementally across multiple chunks.
		// Ollama also uses non-standard tool call IDs like "functions.read_file:0"
		// instead of OpenAI's "call_abc123" format.

		it("should handle Ollama-style single-chunk tool call with non-standard ID", () => {
			// Simulate exactly what Ollama sends through the proxy:
			// One chunk with id, name, and complete arguments all at once
			const events = NativeToolCallParser.processRawChunk({
				index: 0,
				id: "functions.read_file:0",
				name: "read_file",
				arguments: '{"path":"/etc/hostname"}',
			})

			// Should emit tool_call_start followed by tool_call_delta
			expect(events.length).toBeGreaterThanOrEqual(2)
			expect(events[0].type).toBe("tool_call_start")
			expect(events[0]).toEqual({
				type: "tool_call_start",
				id: "functions.read_file:0",
				name: "read_file",
			})
			expect(events[1].type).toBe("tool_call_delta")
			expect(events[1]).toEqual({
				type: "tool_call_delta",
				id: "functions.read_file:0",
				delta: '{"path":"/etc/hostname"}',
			})
		})

		it("should finalize Ollama tool call via finalizeRawChunks", () => {
			// Step 1: Process the single chunk (simulating what Task.ts does)
			const rawEvents = NativeToolCallParser.processRawChunk({
				index: 0,
				id: "functions.read_file:0",
				name: "read_file",
				arguments: '{"path":"/etc/hostname"}',
			})

			// Step 2: Start streaming tool call (simulating Task.ts tool_call_start handler)
			const startEvent = rawEvents.find((e) => e.type === "tool_call_start")
			expect(startEvent).toBeDefined()
			NativeToolCallParser.startStreamingToolCall(
				startEvent!.id,
				startEvent!.type === "tool_call_start" ? (startEvent as any).name : "",
			)

			// Step 3: Process delta (simulating Task.ts tool_call_delta handler)
			const deltaEvent = rawEvents.find((e) => e.type === "tool_call_delta")
			expect(deltaEvent).toBeDefined()
			if (deltaEvent?.type === "tool_call_delta") {
				NativeToolCallParser.processStreamingChunk(deltaEvent.id, deltaEvent.delta)
			}

			// Step 4: Finalize via finalizeRawChunks (simulating end of stream in Task.ts)
			// This is what happens when the stream ends — Task.ts calls finalizeRawChunks()
			const finalEvents = NativeToolCallParser.finalizeRawChunks()
			expect(finalEvents.length).toBe(1)
			expect(finalEvents[0].type).toBe("tool_call_end")
			expect(finalEvents[0].id).toBe("functions.read_file:0")

			// Step 5: Finalize the streaming tool call (simulating Task.ts handling tool_call_end)
			const finalToolUse = NativeToolCallParser.finalizeStreamingToolCall("functions.read_file:0")
			expect(finalToolUse).not.toBeNull()
			expect(finalToolUse?.type).toBe("tool_use")
			if (finalToolUse?.type === "tool_use") {
				expect(finalToolUse.name).toBe("read_file")
				const nativeArgs = finalToolUse.nativeArgs as { path: string }
				expect(nativeArgs.path).toBe("/etc/hostname")
			}
		})

		it("should finalize Ollama tool call via processFinishReason", () => {
			// Step 1: Process the single chunk
			NativeToolCallParser.processRawChunk({
				index: 0,
				id: "functions.read_file:0",
				name: "read_file",
				arguments: '{"path":"/etc/hostname"}',
			})

			// Step 2: Process finish_reason (Ollama sends finish_reason: "tool_calls")
			const endEvents = NativeToolCallParser.processFinishReason("tool_calls")
			expect(endEvents.length).toBe(1)
			expect(endEvents[0].type).toBe("tool_call_end")
			expect(endEvents[0].id).toBe("functions.read_file:0")
		})

		it("should handle Ollama execute_command tool call", () => {
			const rawEvents = NativeToolCallParser.processRawChunk({
				index: 0,
				id: "functions.execute_command:0",
				name: "execute_command",
				arguments: '{"command":"ls -la","cwd":"/tmp"}',
			})

			expect(rawEvents.length).toBeGreaterThanOrEqual(2)

			// Start and process streaming
			NativeToolCallParser.startStreamingToolCall("functions.execute_command:0", "execute_command")
			const deltaEvent = rawEvents.find((e) => e.type === "tool_call_delta")
			if (deltaEvent?.type === "tool_call_delta") {
				NativeToolCallParser.processStreamingChunk(deltaEvent.id, deltaEvent.delta)
			}

			// Finalize
			const finalToolUse = NativeToolCallParser.finalizeStreamingToolCall("functions.execute_command:0")
			expect(finalToolUse).not.toBeNull()
			expect(finalToolUse?.type).toBe("tool_use")
			if (finalToolUse?.type === "tool_use") {
				expect(finalToolUse.name).toBe("execute_command")
				const nativeArgs = finalToolUse.nativeArgs as { command: string; cwd?: string }
				expect(nativeArgs.command).toBe("ls -la")
				expect(nativeArgs.cwd).toBe("/tmp")
			}
		})

		it("should handle multiple Ollama tool calls in sequence", () => {
			// First tool call
			const events1 = NativeToolCallParser.processRawChunk({
				index: 0,
				id: "functions.read_file:0",
				name: "read_file",
				arguments: '{"path":"/etc/hostname"}',
			})
			expect(events1[0].type).toBe("tool_call_start")

			// Second tool call
			const events2 = NativeToolCallParser.processRawChunk({
				index: 1,
				id: "functions.read_file:1",
				name: "read_file",
				arguments: '{"path":"/etc/hosts"}',
			})
			expect(events2[0].type).toBe("tool_call_start")

			// Finish both via processFinishReason
			const endEvents = NativeToolCallParser.processFinishReason("tool_calls")
			expect(endEvents.length).toBe(2)
		})
	})
})
