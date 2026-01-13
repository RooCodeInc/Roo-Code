/**
 * Tests for CommandStreamManager
 *
 * Tests the command output streaming functionality extracted from session.ts.
 */

import type { ClineMessage } from "@roo-code/types"

import { DeltaTracker } from "../delta-tracker.js"
import { CommandStreamManager } from "../command-stream.js"
import { NullLogger } from "../interfaces.js"
import type { SendUpdateFn } from "../interfaces.js"

describe("CommandStreamManager", () => {
	let deltaTracker: DeltaTracker
	let sendUpdate: SendUpdateFn
	let sentUpdates: Array<Record<string, unknown>>
	let manager: CommandStreamManager

	beforeEach(() => {
		deltaTracker = new DeltaTracker()
		sentUpdates = []
		sendUpdate = (update) => {
			sentUpdates.push(update as Record<string, unknown>)
		}
		manager = new CommandStreamManager({
			deltaTracker,
			sendUpdate,
			logger: new NullLogger(),
		})
	})

	describe("isCommandOutputMessage", () => {
		it("returns true for command_output say messages", () => {
			const message: ClineMessage = {
				type: "say",
				say: "command_output",
				ts: Date.now(),
				text: "output",
			}
			expect(manager.isCommandOutputMessage(message)).toBe(true)
		})

		it("returns false for other say types", () => {
			const message: ClineMessage = {
				type: "say",
				say: "text",
				ts: Date.now(),
				text: "hello",
			}
			expect(manager.isCommandOutputMessage(message)).toBe(false)
		})

		it("returns false for ask messages", () => {
			const message: ClineMessage = {
				type: "ask",
				ask: "command",
				ts: Date.now(),
				text: "run command",
			}
			expect(manager.isCommandOutputMessage(message)).toBe(false)
		})
	})

	describe("trackCommand", () => {
		it("tracks a pending command", () => {
			manager.trackCommand("call-1", "npm test", 12345)
			expect(manager.getPendingCommandCount()).toBe(1)
		})

		it("tracks multiple commands", () => {
			manager.trackCommand("call-1", "npm test", 12345)
			manager.trackCommand("call-2", "npm build", 12346)
			expect(manager.getPendingCommandCount()).toBe(2)
		})

		it("overwrites command with same ID", () => {
			manager.trackCommand("call-1", "npm test", 12345)
			manager.trackCommand("call-1", "npm build", 12346)
			expect(manager.getPendingCommandCount()).toBe(1)
		})
	})

	describe("handleExecutionOutput", () => {
		it("does nothing without a pending command", () => {
			manager.handleExecutionOutput("exec-1", "Hello")

			expect(sentUpdates.length).toBe(0)
		})

		it("sends opening code fence as agent_message_chunk on first output", () => {
			manager.trackCommand("call-1", "npm test", 12345)
			manager.handleExecutionOutput("exec-1", "Hello")

			// First message is opening fence, second is the content
			expect(sentUpdates.length).toBe(2)
			expect(sentUpdates[0]).toEqual({
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: "```\n" },
			})
			expect(sentUpdates[1]).toEqual({
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: "Hello" },
			})
		})

		it("sends only delta content on subsequent calls (no fence)", () => {
			manager.trackCommand("call-1", "npm test", 12345)
			manager.handleExecutionOutput("exec-1", "Hello")
			sentUpdates.length = 0 // Clear previous updates

			manager.handleExecutionOutput("exec-1", "Hello World")

			// Only the delta " World" is sent, no fence
			expect(sentUpdates.length).toBe(1)
			expect(sentUpdates[0]).toEqual({
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: " World" },
			})
		})

		it("tracks code fence by toolCallId not executionId", () => {
			manager.trackCommand("call-1", "npm test", 12345)

			// First execution stream
			manager.handleExecutionOutput("exec-1", "First")
			expect(manager.hasOpenCodeFences()).toBe(true)

			// Second execution stream for same command - no new opening fence since toolCallId already has one
			manager.handleExecutionOutput("exec-2", "Second")

			// Should still only have one open fence (tracked by toolCallId)
			expect(manager.hasOpenCodeFences()).toBe(true)

			// Second call should NOT have opening fence since toolCallId already has one
			// sentUpdates[0] = opening fence, sentUpdates[1] = "First", sentUpdates[2] = "Second"
			expect(sentUpdates[2]).toEqual({
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: "Second" },
			})
		})

		it("sends streaming output as agent_message_chunk", () => {
			manager.trackCommand("call-1", "npm test", 12345)
			manager.handleExecutionOutput("exec-1", "Running...")

			// Opening fence + content
			const contentUpdate = sentUpdates.find(
				(u) =>
					u.sessionUpdate === "agent_message_chunk" && (u.content as { text: string }).text === "Running...",
			)
			expect(contentUpdate).toEqual({
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: "Running..." },
			})
		})
	})

	describe("handleCommandOutput", () => {
		it("ignores partial messages", () => {
			const message: ClineMessage = {
				type: "say",
				say: "command_output",
				ts: Date.now(),
				text: "partial output",
				partial: true,
			}

			manager.handleCommandOutput(message)
			expect(sentUpdates.length).toBe(0)
		})

		it("sends closing fence and completion when streaming was used", () => {
			// Track command and open a code fence via execution output
			manager.trackCommand("call-1", "npm test", 12345)
			manager.handleExecutionOutput("exec-1", "output")
			expect(manager.hasOpenCodeFences()).toBe(true)

			sentUpdates.length = 0 // Clear

			const message: ClineMessage = {
				type: "say",
				say: "command_output",
				ts: Date.now(),
				text: "final output",
				partial: false,
			}

			manager.handleCommandOutput(message)

			// First: closing fence as agent_message_chunk
			expect(sentUpdates[0]).toEqual({
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: "```\n" },
			})
			// Second: tool_call_update with completed status (no content, just rawOutput)
			expect(sentUpdates[1]).toEqual({
				sessionUpdate: "tool_call_update",
				toolCallId: "call-1",
				status: "completed",
				rawOutput: { output: "final output" },
			})
			expect(manager.hasOpenCodeFences()).toBe(false)
		})

		it("sends completion update for pending command without streaming", () => {
			manager.trackCommand("call-1", "npm test", 12345)

			const message: ClineMessage = {
				type: "say",
				say: "command_output",
				ts: Date.now(),
				text: "Test passed!",
				partial: false,
			}

			manager.handleCommandOutput(message)

			// No streaming, so no closing fence - just the completion update
			const completionUpdate = sentUpdates.find(
				(u) => u.sessionUpdate === "tool_call_update" && u.status === "completed",
			)
			expect(completionUpdate).toEqual({
				sessionUpdate: "tool_call_update",
				toolCallId: "call-1",
				status: "completed",
				rawOutput: { output: "Test passed!" },
			})
		})

		it("removes pending command after completion", () => {
			manager.trackCommand("call-1", "npm test", 12345)
			expect(manager.getPendingCommandCount()).toBe(1)

			const message: ClineMessage = {
				type: "say",
				say: "command_output",
				ts: Date.now(),
				text: "done",
				partial: false,
			}

			manager.handleCommandOutput(message)
			expect(manager.getPendingCommandCount()).toBe(0)
		})

		it("picks most recent pending command when multiple exist", () => {
			manager.trackCommand("call-1", "npm test", 12345)
			manager.trackCommand("call-2", "npm build", 12346) // More recent

			const message: ClineMessage = {
				type: "say",
				say: "command_output",
				ts: Date.now(),
				text: "done",
				partial: false,
			}

			manager.handleCommandOutput(message)

			const completionUpdate = sentUpdates.find((u) => u.sessionUpdate === "tool_call_update")
			expect((completionUpdate as Record<string, unknown>).toolCallId).toBe("call-2")
		})
	})

	describe("reset", () => {
		it("clears code fence tracking", () => {
			manager.trackCommand("call-1", "npm test", 12345)
			manager.handleExecutionOutput("exec-1", "output")
			expect(manager.hasOpenCodeFences()).toBe(true)

			manager.reset()
			expect(manager.hasOpenCodeFences()).toBe(false)
		})

		it("clears pending commands to avoid stale entries", () => {
			// Pending commands from previous prompts would cause duplicate completion messages
			manager.trackCommand("call-1", "npm test", 12345)
			manager.reset()
			expect(manager.getPendingCommandCount()).toBe(0)
		})
	})

	describe("getPendingCommandCount", () => {
		it("returns 0 when no commands tracked", () => {
			expect(manager.getPendingCommandCount()).toBe(0)
		})

		it("returns correct count", () => {
			manager.trackCommand("call-1", "cmd1", 1)
			manager.trackCommand("call-2", "cmd2", 2)
			expect(manager.getPendingCommandCount()).toBe(2)
		})
	})

	describe("hasOpenCodeFences", () => {
		it("returns false initially", () => {
			expect(manager.hasOpenCodeFences()).toBe(false)
		})

		it("returns true after execution output with pending command", () => {
			manager.trackCommand("call-1", "npm test", 12345)
			manager.handleExecutionOutput("exec-1", "output")
			expect(manager.hasOpenCodeFences()).toBe(true)
		})

		it("returns false after reset", () => {
			manager.trackCommand("call-1", "npm test", 12345)
			manager.handleExecutionOutput("exec-1", "output")
			manager.reset()
			expect(manager.hasOpenCodeFences()).toBe(false)
		})
	})
})
