/**
 * Tests for ToolContentStreamManager
 *
 * Tests the tool content (file creates/edits) streaming functionality
 * extracted from session.ts.
 */

import type { ClineMessage } from "@roo-code/types"

import { DeltaTracker } from "../delta-tracker.js"
import { ToolContentStreamManager } from "../tool-content-stream.js"
import { NullLogger } from "../interfaces.js"
import type { SendUpdateFn } from "../interfaces.js"

describe("ToolContentStreamManager", () => {
	let deltaTracker: DeltaTracker
	let sendUpdate: SendUpdateFn
	let sentUpdates: Array<Record<string, unknown>>
	let manager: ToolContentStreamManager

	beforeEach(() => {
		deltaTracker = new DeltaTracker()
		sentUpdates = []
		sendUpdate = (update) => {
			sentUpdates.push(update as Record<string, unknown>)
		}
		manager = new ToolContentStreamManager({
			deltaTracker,
			sendUpdate,
			logger: new NullLogger(),
		})
	})

	describe("isToolAskMessage", () => {
		it("returns true for tool ask messages", () => {
			const message: ClineMessage = {
				type: "ask",
				ask: "tool",
				ts: Date.now(),
				text: "{}",
			}
			expect(manager.isToolAskMessage(message)).toBe(true)
		})

		it("returns false for other ask types", () => {
			const message: ClineMessage = {
				type: "ask",
				ask: "command",
				ts: Date.now(),
				text: "npm test",
			}
			expect(manager.isToolAskMessage(message)).toBe(false)
		})

		it("returns false for say messages", () => {
			const message: ClineMessage = {
				type: "say",
				say: "text",
				ts: Date.now(),
				text: "hello",
			}
			expect(manager.isToolAskMessage(message)).toBe(false)
		})
	})

	describe("handleToolContentStreaming", () => {
		describe("file write tool detection", () => {
			const fileWriteTools = [
				"newFileCreated",
				"write_to_file",
				"create_file",
				"editedExistingFile",
				"apply_diff",
				"modify_file",
			]

			fileWriteTools.forEach((toolName) => {
				it(`handles ${toolName} as a file write tool`, () => {
					const message: ClineMessage = {
						type: "ask",
						ask: "tool",
						ts: 12345,
						text: JSON.stringify({
							tool: toolName,
							path: "test.ts",
							content: "content",
						}),
						partial: true,
					}

					const result = manager.handleToolContentStreaming(message)
					expect(result).toBe(true)
					// Should send header since it's a file write tool
					expect(sentUpdates.length).toBeGreaterThan(0)
				})
			})

			it("skips non-file tools", () => {
				const message: ClineMessage = {
					type: "ask",
					ask: "tool",
					ts: 12345,
					text: JSON.stringify({
						tool: "read_file",
						path: "test.ts",
					}),
					partial: true,
				}

				const result = manager.handleToolContentStreaming(message)
				expect(result).toBe(true) // Handled by skipping
				expect(sentUpdates.length).toBe(0) // Nothing sent
			})
		})

		describe("header management", () => {
			it("sends header on first valid path", () => {
				const message: ClineMessage = {
					type: "ask",
					ask: "tool",
					ts: 12345,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "src/index.ts",
						content: "",
					}),
					partial: true,
				}

				manager.handleToolContentStreaming(message)

				expect(sentUpdates.length).toBe(1)
				expect(sentUpdates[0]).toEqual({
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: "\n**Creating src/index.ts**\n```\n" },
				})
			})

			it("only sends header once per message", () => {
				const ts = 12345

				// First call
				manager.handleToolContentStreaming({
					type: "ask",
					ask: "tool",
					ts,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "test.ts",
						content: "line 1",
					}),
					partial: true,
				})

				const headerCount1 = sentUpdates.filter((u) =>
					((u.content as { text: string }).text || "").includes("**Creating"),
				).length

				// Second call with same ts
				manager.handleToolContentStreaming({
					type: "ask",
					ask: "tool",
					ts,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "test.ts",
						content: "line 1\nline 2",
					}),
					partial: true,
				})

				const headerCount2 = sentUpdates.filter((u) =>
					((u.content as { text: string }).text || "").includes("**Creating"),
				).length

				expect(headerCount1).toBe(1)
				expect(headerCount2).toBe(1) // Still 1, no duplicate
			})

			it("waits for valid path before sending header", () => {
				// Path without extension is not valid
				const message: ClineMessage = {
					type: "ask",
					ask: "tool",
					ts: 12345,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "incomplete",
						content: "content",
					}),
					partial: true,
				}

				manager.handleToolContentStreaming(message)
				expect(sentUpdates.length).toBe(0) // No header yet
			})

			it("validates path has file extension", () => {
				const validPaths = ["test.ts", "README.md", "config.json", "src/utils.js"]
				const invalidPaths = ["test", "src/folder/", "noextension"]

				validPaths.forEach((path) => {
					sentUpdates.length = 0
					manager = new ToolContentStreamManager({
						deltaTracker: new DeltaTracker(),
						sendUpdate,
						logger: new NullLogger(),
					})

					manager.handleToolContentStreaming({
						type: "ask",
						ask: "tool",
						ts: Date.now(),
						text: JSON.stringify({ tool: "write_to_file", path, content: "" }),
						partial: true,
					})

					expect(sentUpdates.length).toBeGreaterThan(0)
				})

				invalidPaths.forEach((path) => {
					sentUpdates.length = 0
					manager = new ToolContentStreamManager({
						deltaTracker: new DeltaTracker(),
						sendUpdate,
						logger: new NullLogger(),
					})

					manager.handleToolContentStreaming({
						type: "ask",
						ask: "tool",
						ts: Date.now(),
						text: JSON.stringify({ tool: "write_to_file", path, content: "x" }),
						partial: true,
					})

					expect(sentUpdates.length).toBe(0)
				})
			})
		})

		describe("content streaming", () => {
			it("streams content deltas", () => {
				const ts = 12345

				// First chunk
				manager.handleToolContentStreaming({
					type: "ask",
					ask: "tool",
					ts,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "test.ts",
						content: "const x = 1;",
					}),
					partial: true,
				})

				// Header + content
				expect(sentUpdates.length).toBe(2)
				expect(sentUpdates[1]).toEqual({
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: "const x = 1;" },
				})

				// Second chunk with more content
				manager.handleToolContentStreaming({
					type: "ask",
					ask: "tool",
					ts,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "test.ts",
						content: "const x = 1;\nconst y = 2;",
					}),
					partial: true,
				})

				// Should only send the delta
				expect(sentUpdates.length).toBe(3)
				expect(sentUpdates[2]).toEqual({
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: "\nconst y = 2;" },
				})
			})

			it("handles multiple tool streams independently", () => {
				// First tool
				manager.handleToolContentStreaming({
					type: "ask",
					ask: "tool",
					ts: 1000,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "file1.ts",
						content: "content1",
					}),
					partial: true,
				})

				// Second tool
				manager.handleToolContentStreaming({
					type: "ask",
					ask: "tool",
					ts: 2000,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "file2.ts",
						content: "content2",
					}),
					partial: true,
				})

				// Both should get headers
				const headers = sentUpdates.filter((u) =>
					((u.content as { text: string }).text || "").includes("**Creating"),
				)
				expect(headers.length).toBe(2)
			})
		})

		describe("completion", () => {
			it("sends closing code fence on complete", () => {
				const ts = 12345

				// Partial message
				manager.handleToolContentStreaming({
					type: "ask",
					ask: "tool",
					ts,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "test.ts",
						content: "content",
					}),
					partial: true,
				})

				sentUpdates.length = 0 // Clear

				// Complete message
				manager.handleToolContentStreaming({
					type: "ask",
					ask: "tool",
					ts,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "test.ts",
						content: "content",
					}),
					partial: false,
				})

				expect(sentUpdates[0]).toEqual({
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: "\n```\n" },
				})
			})

			it("cleans up header tracking on complete", () => {
				const ts = 12345

				// Partial
				manager.handleToolContentStreaming({
					type: "ask",
					ask: "tool",
					ts,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "test.ts",
						content: "content",
					}),
					partial: true,
				})

				expect(manager.getActiveHeaderCount()).toBe(1)

				// Complete
				manager.handleToolContentStreaming({
					type: "ask",
					ask: "tool",
					ts,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "test.ts",
						content: "content",
					}),
					partial: false,
				})

				expect(manager.getActiveHeaderCount()).toBe(0)
			})

			it("does not send code fence if no header was sent", () => {
				const ts = 12345

				// Complete message without prior partial (no header sent)
				manager.handleToolContentStreaming({
					type: "ask",
					ask: "tool",
					ts,
					text: JSON.stringify({
						tool: "write_to_file",
						path: "test.ts",
						content: "content",
					}),
					partial: false,
				})

				// Should not send closing fence
				const closingFences = sentUpdates.filter((u) =>
					((u.content as { text: string }).text || "").includes("```"),
				)
				expect(closingFences.length).toBe(0)
			})
		})

		describe("JSON parsing", () => {
			it("handles invalid JSON gracefully", () => {
				const message: ClineMessage = {
					type: "ask",
					ask: "tool",
					ts: 12345,
					text: "{incomplete json",
					partial: true,
				}

				const result = manager.handleToolContentStreaming(message)
				expect(result).toBe(true) // Handled by returning early
				expect(sentUpdates.length).toBe(0)
			})

			it("handles empty text", () => {
				const message: ClineMessage = {
					type: "ask",
					ask: "tool",
					ts: 12345,
					text: "",
					partial: true,
				}

				const result = manager.handleToolContentStreaming(message)
				expect(result).toBe(true)
				expect(sentUpdates.length).toBe(0)
			})
		})
	})

	describe("reset", () => {
		it("clears header tracking", () => {
			manager.handleToolContentStreaming({
				type: "ask",
				ask: "tool",
				ts: 12345,
				text: JSON.stringify({
					tool: "write_to_file",
					path: "test.ts",
					content: "content",
				}),
				partial: true,
			})

			expect(manager.getActiveHeaderCount()).toBe(1)

			manager.reset()
			expect(manager.getActiveHeaderCount()).toBe(0)
		})
	})

	describe("getActiveHeaderCount", () => {
		it("returns 0 initially", () => {
			expect(manager.getActiveHeaderCount()).toBe(0)
		})

		it("returns correct count after streaming", () => {
			manager.handleToolContentStreaming({
				type: "ask",
				ask: "tool",
				ts: 1000,
				text: JSON.stringify({ tool: "write_to_file", path: "a.ts", content: "" }),
				partial: true,
			})

			manager.handleToolContentStreaming({
				type: "ask",
				ask: "tool",
				ts: 2000,
				text: JSON.stringify({ tool: "write_to_file", path: "b.ts", content: "" }),
				partial: true,
			})

			expect(manager.getActiveHeaderCount()).toBe(2)
		})
	})
})
