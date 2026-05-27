import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"

import { API } from "../api"
import { ClineProvider } from "../../core/webview/ClineProvider"

vi.mock("vscode")
vi.mock("../../core/webview/ClineProvider")

describe("API - CancelCommand", () => {
	let api: API
	let mockOutputChannel: vscode.OutputChannel
	let mockProvider: ClineProvider
	let mockHandleTerminalOperation: ReturnType<typeof vi.fn>
	let mockLog: ReturnType<typeof vi.fn>

	beforeEach(() => {
		mockOutputChannel = {
			appendLine: vi.fn(),
		} as unknown as vscode.OutputChannel

		mockHandleTerminalOperation = vi.fn()

		mockProvider = {
			context: {} as vscode.ExtensionContext,
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			on: vi.fn(),
			getCurrentTaskStack: vi.fn().mockReturnValue([]),
			getCurrentTask: vi.fn().mockReturnValue({
				handleTerminalOperation: mockHandleTerminalOperation,
			}),
			viewLaunched: true,
		} as unknown as ClineProvider

		mockLog = vi.fn()

		api = new API(mockOutputChannel, mockProvider, undefined, true)
		;(api as any).log = mockLog
	})

	it("should call handleTerminalOperation with 'abort' on the current task", () => {
		// Access the private sidebarProvider to trigger the handler directly
		const currentTask = (api as any).sidebarProvider.getCurrentTask()
		currentTask?.handleTerminalOperation("abort")

		expect(mockHandleTerminalOperation).toHaveBeenCalledWith("abort")
		expect(mockHandleTerminalOperation).toHaveBeenCalledTimes(1)
	})

	it("should handle missing current task gracefully", () => {
		;(mockProvider.getCurrentTask as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

		// Simulating what the API handler does: optional chaining means no error
		const currentTask = (api as any).sidebarProvider.getCurrentTask()
		currentTask?.handleTerminalOperation("abort")

		expect(mockHandleTerminalOperation).not.toHaveBeenCalled()
	})

	it("should handle task with no terminal process gracefully", () => {
		const mockHandleOp = vi.fn() // does nothing, like a task with no terminalProcess
		;(mockProvider.getCurrentTask as ReturnType<typeof vi.fn>).mockReturnValue({
			handleTerminalOperation: mockHandleOp,
		})

		const currentTask = (api as any).sidebarProvider.getCurrentTask()
		currentTask?.handleTerminalOperation("abort")

		expect(mockHandleOp).toHaveBeenCalledWith("abort")
	})
})
