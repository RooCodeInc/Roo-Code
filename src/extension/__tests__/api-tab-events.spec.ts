import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"

import { API } from "../api"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { setOnTabProviderCreated } from "../../activate/registerCommands"

vi.mock("vscode")
vi.mock("../../core/webview/ClineProvider")

// Capture the callback registered by the API constructor.
let capturedCallback: ((provider: ClineProvider) => void) | undefined

vi.mock("../../activate/registerCommands", () => ({
	openClineInNewTab: vi.fn(),
	setOnTabProviderCreated: vi.fn((cb: (provider: ClineProvider) => void) => {
		capturedCallback = cb
	}),
}))

describe("API - Tab Provider Event Registration", () => {
	let mockOutputChannel: vscode.OutputChannel
	let mockSidebarProvider: ClineProvider
	let api: API

	beforeEach(() => {
		capturedCallback = undefined

		mockOutputChannel = {
			appendLine: vi.fn(),
		} as unknown as vscode.OutputChannel

		mockSidebarProvider = {
			context: {} as vscode.ExtensionContext,
			on: vi.fn(),
			postMessageToWebview: vi.fn(),
			getCurrentTaskStack: vi.fn().mockReturnValue([]),
			getCurrentTask: vi.fn().mockReturnValue(undefined),
			viewLaunched: true,
		} as unknown as ClineProvider

		api = new API(mockOutputChannel, mockSidebarProvider, undefined, false)
	})

	it("should call setOnTabProviderCreated during construction", () => {
		expect(setOnTabProviderCreated).toHaveBeenCalledWith(expect.any(Function))
		expect(capturedCallback).toBeDefined()
	})

	it("should register listeners on tab providers created via commands", () => {
		const mockTabProvider = {
			on: vi.fn(),
			context: {} as vscode.ExtensionContext,
		} as unknown as ClineProvider

		// Simulate a tab provider being created via command
		capturedCallback!(mockTabProvider)

		// registerListeners calls provider.on(RooCodeEventName.TaskCreated, ...)
		// so we verify that on() was called on the tab provider
		expect(mockTabProvider.on).toHaveBeenCalled()
	})

	it("should register listeners on the sidebar provider during construction", () => {
		// The sidebar provider should also have listeners registered
		expect(mockSidebarProvider.on).toHaveBeenCalled()
	})
})
