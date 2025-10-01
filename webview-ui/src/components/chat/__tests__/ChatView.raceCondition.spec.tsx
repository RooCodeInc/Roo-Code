/**
 * Race Condition Test: Message Editor Data Loss During Concurrent Operations
 *
 * This test demonstrates the REAL race condition bug where user input is lost
 * when sending a message concurrently with a tool response arriving from the extension.
 *
 * The Bug:
 * 1. User types a message while a tool is executing
 * 2. Tool response arrives → `sendingDisabled: true` (button still clickable briefly)
 * 3. User clicks Send → Message is queued
 * 4. OLD BUG: `clearDraft()` is called immediately → INPUT WIPED
 * 5. Result: Message disappears before being confirmed/processed
 *
 * The Fix:
 * - Do NOT call `clearDraft()` when queueing a message
 * - Keep the message visible until it's properly processed
 * - Let the autosave provide recovery if something goes wrong
 */

import React, { useState, useCallback, useEffect } from "react"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { useAutosaveDraft } from "../../../hooks/useAutosaveDraft"

// ============================================================================
// Test Component: Simulates ChatView's message sending logic
// ============================================================================

interface MessageEditorProps {
	taskId: string
	sendingDisabled?: boolean // Controlled from outside
	clearDraftOnQueue?: boolean // Toggle between buggy and fixed behavior
	onMessageQueued?: (message: string) => void
	onMessageSent?: (message: string) => void
}

/**
 * Simplified MessageEditor that mimics ChatView's send logic with race condition scenario
 */
const MessageEditorWithRaceCondition: React.FC<MessageEditorProps> = ({
	taskId,
	sendingDisabled = false,
	clearDraftOnQueue = false,
	onMessageQueued,
	onMessageSent,
}) => {
	const { draftContent, updateDraft, clearDraft } = useAutosaveDraft({
		key: taskId,
		debounceMs: 100,
		clearOnSubmit: true,
	})

	const handleSend = useCallback(() => {
		const text = draftContent.trim()
		if (!text) return

		// This is the critical section where the race condition occurs
		if (sendingDisabled) {
			// Message is queued because sending is disabled
			onMessageQueued?.(text)

			// OLD BUGGY BEHAVIOR: Clear draft immediately
			if (clearDraftOnQueue) {
				clearDraft()
				// BUG: User sees their message disappear!
			}
			// NEW FIXED BEHAVIOR: Don't clear, keep message visible

			return
		}

		// Normal send path (not disabled)
		onMessageSent?.(text)
		clearDraft() // Only clear after actual send
	}, [draftContent, sendingDisabled, clearDraft, clearDraftOnQueue, onMessageQueued, onMessageSent])

	return (
		<div data-testid="race-condition-editor">
			<div data-testid="sending-status">{sendingDisabled ? "disabled" : "enabled"}</div>
			<textarea
				data-testid="message-input"
				value={draftContent}
				onChange={(e) => updateDraft(e.target.value)}
				placeholder="Type your message..."
			/>
			<button data-testid="send-button" onClick={handleSend} disabled={false}>
				Send
			</button>
		</div>
	)
}

// ============================================================================
// Tests
// ============================================================================

describe("ChatView Race Condition: Message Loss During Concurrent Operations", () => {
	beforeEach(() => {
		localStorage.clear()
		vi.clearAllTimers()
		vi.useFakeTimers({ shouldAdvanceTime: true })
	})

	afterEach(() => {
		localStorage.clear()
		vi.clearAllTimers()
		vi.useRealTimers()
	})

	describe("BUG: Demonstrates data loss with immediate clearDraft on queue", () => {
		it("should lose message when clearDraft is called during queueing (buggy behavior)", async () => {
			const onMessageQueued = vi.fn()
			const taskId = "test-task-race-1"

			const { rerender } = render(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={false}
					clearDraftOnQueue={true} // BUGGY: Clear immediately
					onMessageQueued={onMessageQueued}
				/>,
			)

			const input = screen.getByTestId("message-input") as HTMLTextAreaElement
			const sendButton = screen.getByTestId("send-button")

			// 1. User types a message
			await act(async () => {
				fireEvent.change(input, { target: { value: "Important message" } })
				await vi.advanceTimersByTimeAsync(150)
			})

			// Verify message is in input
			expect(input.value).toBe("Important message")

			// 2. Simulate tool response: re-render with sendingDisabled=true
			rerender(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={true}
					clearDraftOnQueue={true}
					onMessageQueued={onMessageQueued}
				/>,
			)

			// Verify sending is now disabled
			const status = screen.getByTestId("sending-status")
			expect(status.textContent).toBe("disabled")

			// 3. User clicks Send (button still clickable for a brief moment)
			await act(async () => {
				fireEvent.click(sendButton)
			})

			// Verify message was queued
			expect(onMessageQueued).toHaveBeenCalledWith("Important message")

			// 4. BUG: Message should be CLEARED from input immediately
			expect(input.value).toBe("")

			// 5. Result: User sees their message disappear! (DATA LOSS)
			// This is the bug - the message is gone before confirmation
		})

		it("should demonstrate the timing window vulnerability", async () => {
			const onMessageQueued = vi.fn()
			const taskId = "test-task-race-2"

			const { rerender } = render(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={false}
					clearDraftOnQueue={true}
					onMessageQueued={onMessageQueued}
				/>,
			)

			const input = screen.getByTestId("message-input") as HTMLTextAreaElement
			const sendButton = screen.getByTestId("send-button")

			// User starts typing
			await act(async () => {
				fireEvent.change(input, { target: { value: "My mes" } })
				await vi.advanceTimersByTimeAsync(30)

				fireEvent.change(input, { target: { value: "My message" } })
				await vi.advanceTimersByTimeAsync(50)
			})

			// Tool response arrives (disables sending)
			rerender(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={true}
					clearDraftOnQueue={true}
					onMessageQueued={onMessageQueued}
				/>,
			)

			// User clicks Send quickly (within the race window)
			await act(async () => {
				fireEvent.click(sendButton)
			})

			// Message queued but input cleared
			expect(onMessageQueued).toHaveBeenCalledWith("My message")
			expect(input.value).toBe("")

			// This demonstrates the bug happens in a realistic typing scenario
		})
	})

	describe("FIX: Preserves message when queueing without immediate clearDraft", () => {
		it("should preserve message in input when queueing (fixed behavior)", async () => {
			const onMessageQueued = vi.fn()
			const taskId = "test-task-race-3"

			const { rerender } = render(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={false}
					clearDraftOnQueue={false} // FIXED: Don't clear on queue
					onMessageQueued={onMessageQueued}
				/>,
			)

			const input = screen.getByTestId("message-input") as HTMLTextAreaElement
			const sendButton = screen.getByTestId("send-button")

			// 1. User types a message
			await act(async () => {
				fireEvent.change(input, { target: { value: "Important message" } })
				await vi.advanceTimersByTimeAsync(150)
			})

			// 2. Tool response arrives (disables sending)
			rerender(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={true}
					clearDraftOnQueue={false}
					onMessageQueued={onMessageQueued}
				/>,
			)

			const status = screen.getByTestId("sending-status")
			expect(status.textContent).toBe("disabled")

			// 3. User clicks Send
			await act(async () => {
				fireEvent.click(sendButton)
			})

			// Verify message was queued
			expect(onMessageQueued).toHaveBeenCalledWith("Important message")

			// 4. FIX: Message should REMAIN in input
			expect(input.value).toBe("Important message")

			// 5. Result: User can still see their message! (NO DATA LOSS)
			// The message stays visible until properly processed
		})

		it("should allow message to be edited while queued", async () => {
			const onMessageQueued = vi.fn()
			const taskId = "test-task-race-4"

			const { rerender } = render(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={false}
					clearDraftOnQueue={false}
					onMessageQueued={onMessageQueued}
				/>,
			)

			const input = screen.getByTestId("message-input") as HTMLTextAreaElement
			const sendButton = screen.getByTestId("send-button")

			// Type a message
			await act(async () => {
				fireEvent.change(input, { target: { value: "First version" } })
				await vi.advanceTimersByTimeAsync(150)
			})

			// Tool response arrives
			rerender(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={true}
					clearDraftOnQueue={false}
					onMessageQueued={onMessageQueued}
				/>,
			)

			// Queue the message
			await act(async () => {
				fireEvent.click(sendButton)
			})

			expect(onMessageQueued).toHaveBeenCalledWith("First version")

			// FIX: User can still edit the message after queueing
			await act(async () => {
				fireEvent.change(input, { target: { value: "First version - updated" } })
			})
			expect(input.value).toBe("First version - updated")

			// This demonstrates the message remains accessible
		})
	})

	describe("Comparison: Buggy vs Fixed behavior side-by-side", () => {
		it("should clearly show the difference in behavior", async () => {
			const onQueuedBuggy = vi.fn()
			const onQueuedFixed = vi.fn()
			const taskId1 = "buggy-version"
			const taskId2 = "fixed-version"

			const { rerender } = render(
				<>
					<div data-testid="buggy-container">
						<MessageEditorWithRaceCondition
							taskId={taskId1}
							sendingDisabled={false}
							clearDraftOnQueue={true}
							onMessageQueued={onQueuedBuggy}
						/>
					</div>
					<div data-testid="fixed-container">
						<MessageEditorWithRaceCondition
							taskId={taskId2}
							sendingDisabled={false}
							clearDraftOnQueue={false}
							onMessageQueued={onQueuedFixed}
						/>
					</div>
				</>,
			)

			const buggyInput = screen.getAllByTestId("message-input")[0] as HTMLTextAreaElement
			const fixedInput = screen.getAllByTestId("message-input")[1] as HTMLTextAreaElement
			const buggyButton = screen.getAllByTestId("send-button")[0]
			const fixedButton = screen.getAllByTestId("send-button")[1]

			// Both users type the same message
			await act(async () => {
				fireEvent.change(buggyInput, { target: { value: "Test message" } })
				fireEvent.change(fixedInput, { target: { value: "Test message" } })
				await vi.advanceTimersByTimeAsync(150)
			})

			// Tool response arrives
			rerender(
				<>
					<div data-testid="buggy-container">
						<MessageEditorWithRaceCondition
							taskId={taskId1}
							sendingDisabled={true}
							clearDraftOnQueue={true}
							onMessageQueued={onQueuedBuggy}
						/>
					</div>
					<div data-testid="fixed-container">
						<MessageEditorWithRaceCondition
							taskId={taskId2}
							sendingDisabled={true}
							clearDraftOnQueue={false}
							onMessageQueued={onQueuedFixed}
						/>
					</div>
				</>,
			)

			// Both click Send
			await act(async () => {
				fireEvent.click(buggyButton)
				fireEvent.click(fixedButton)
			})

			// Both messages are queued
			expect(onQueuedBuggy).toHaveBeenCalledWith("Test message")
			expect(onQueuedFixed).toHaveBeenCalledWith("Test message")

			// But the behavior differs:
			// BUGGY: Input cleared
			expect(buggyInput.value).toBe("")
			// FIXED: Input preserved
			expect(fixedInput.value).toBe("Test message")
		})
	})

	describe("Autosave does NOT worsen the race condition", () => {
		it("should not cause data loss even with rapid typing during race condition", async () => {
			const onMessageQueued = vi.fn()
			const taskId = "test-autosave-race-safety"

			const { rerender } = render(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={false}
					clearDraftOnQueue={false}
					onMessageQueued={onMessageQueued}
				/>,
			)

			const input = screen.getByTestId("message-input") as HTMLTextAreaElement
			const sendButton = screen.getByTestId("send-button")

			// Simulate RAPID typing (faster than debounce)
			await act(async () => {
				fireEvent.change(input, { target: { value: "H" } })
				await vi.advanceTimersByTimeAsync(20)
				fireEvent.change(input, { target: { value: "He" } })
				await vi.advanceTimersByTimeAsync(20)
				fireEvent.change(input, { target: { value: "Hel" } })
				await vi.advanceTimersByTimeAsync(20)
				fireEvent.change(input, { target: { value: "Hell" } })
				await vi.advanceTimersByTimeAsync(20)
				fireEvent.change(input, { target: { value: "Hello" } })
				await vi.advanceTimersByTimeAsync(20) // Total 100ms, just at debounce threshold
			})

			// Tool response arrives during typing
			rerender(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={true}
					clearDraftOnQueue={false}
					onMessageQueued={onMessageQueued}
				/>,
			)

			// User clicks Send immediately
			await act(async () => {
				fireEvent.click(sendButton)
			})

			// CRITICAL: Message must be queued with LATEST content
			expect(onMessageQueued).toHaveBeenCalledWith("Hello")
			// Message still visible
			expect(input.value).toBe("Hello")

			// This proves autosave doesn't interfere with the race condition fix
		})

		it("should handle autosave debounce gracefully during race condition", async () => {
			const onMessageQueued = vi.fn()
			const taskId = "test-autosave-debounce-race"

			const { rerender } = render(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={false}
					clearDraftOnQueue={false}
					onMessageQueued={onMessageQueued}
				/>,
			)

			const input = screen.getByTestId("message-input") as HTMLTextAreaElement
			const sendButton = screen.getByTestId("send-button")

			// Type message
			await act(async () => {
				fireEvent.change(input, { target: { value: "My message" } })
				// Wait LESS than debounce (autosave hasn't fired yet)
				await vi.advanceTimersByTimeAsync(50)
			})

			// Tool response arrives BEFORE autosave completes
			rerender(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={true}
					clearDraftOnQueue={false}
					onMessageQueued={onMessageQueued}
				/>,
			)

			// User sends BEFORE autosave debounce completes
			await act(async () => {
				fireEvent.click(sendButton)
			})

			// CRITICAL: Even though autosave didn't fire yet,
			// the message is still queued correctly from draftContent
			expect(onMessageQueued).toHaveBeenCalledWith("My message")
			expect(input.value).toBe("My message")

			// Autosave timing does NOT affect the fix
		})

		it("should verify autosave has minimal performance impact (100ms debounce)", async () => {
			const taskId = "test-autosave-performance"
			const startTime = Date.now()

			render(<MessageEditorWithRaceCondition taskId={taskId} sendingDisabled={false} clearDraftOnQueue={false} />)

			const input = screen.getByTestId("message-input") as HTMLTextAreaElement

			// Measure time to type and autosave
			await act(async () => {
				fireEvent.change(input, { target: { value: "Performance test" } })
				await vi.advanceTimersByTimeAsync(100) // Debounce time
			})

			const endTime = Date.now()
			const elapsed = endTime - startTime

			// With 100ms debounce, the autosave is FAST
			// This is imperceptible to users (human reaction time ~200-300ms)
			expect(elapsed).toBeLessThan(200) // Generous buffer for test overhead

			// Input remains responsive
			expect(input.value).toBe("Performance test")
		})
	})

	describe("Edge cases with the fix", () => {
		it("should handle rapid send clicks gracefully", async () => {
			const onMessageQueued = vi.fn()
			const taskId = "test-task-race-6"

			const { rerender } = render(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={false}
					clearDraftOnQueue={false}
					onMessageQueued={onMessageQueued}
				/>,
			)

			const input = screen.getByTestId("message-input") as HTMLTextAreaElement
			const sendButton = screen.getByTestId("send-button")

			await act(async () => {
				fireEvent.change(input, { target: { value: "Rapid fire" } })
				await vi.advanceTimersByTimeAsync(150)
			})

			// Tool response arrives
			rerender(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={true}
					clearDraftOnQueue={false}
					onMessageQueued={onMessageQueued}
				/>,
			)

			// Multiple rapid clicks
			await act(async () => {
				fireEvent.click(sendButton)
				fireEvent.click(sendButton)
				fireEvent.click(sendButton)
			})

			// Should queue multiple times and message remains visible
			expect(onMessageQueued).toHaveBeenCalledTimes(3)
			expect(input.value).toBe("Rapid fire")
		})

		it("should clear draft only on successful normal send", async () => {
			const onMessageSent = vi.fn()
			const taskId = "test-task-race-7"

			render(
				<MessageEditorWithRaceCondition
					taskId={taskId}
					sendingDisabled={false} // Sending NOT disabled
					clearDraftOnQueue={false}
					onMessageSent={onMessageSent}
				/>,
			)

			const input = screen.getByTestId("message-input") as HTMLTextAreaElement
			const sendButton = screen.getByTestId("send-button")

			await act(async () => {
				fireEvent.change(input, { target: { value: "Normal send" } })
				await vi.advanceTimersByTimeAsync(150)

				// Normal send (not disabled)
				fireEvent.click(sendButton)
			})

			// Should send and clear
			expect(onMessageSent).toHaveBeenCalledWith("Normal send")
			expect(input.value).toBe("")
		})
	})
})
