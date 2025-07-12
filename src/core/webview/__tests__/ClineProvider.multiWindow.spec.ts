// npx vitest core/webview/__tests__/ClineProvider.multiWindow.spec.ts

import * as vscode from "vscode"
import { TelemetryService } from "@roo-code/telemetry"
import { ContextProxy } from "../../config/ContextProxy"
import { ClineProvider } from "../ClineProvider"
import { defaultModeSlug } from "../../../shared/modes"

// Mock setup
vi.mock("vscode")
vi.mock("../../prompts/sections/custom-instructions")
vi.mock("../../../utils/tts")
vi.mock("../../../api")
vi.mock("../../prompts/system")
vi.mock("../../../integrations/workspace/WorkspaceTracker")
vi.mock("../../task/Task")
vi.mock("../../../integrations/misc/extract-text")
vi.mock("../../../api/providers/fetchers/modelCache")
vi.mock("@roo-code/cloud")

const mockAddCustomInstructions = vi.fn().mockResolvedValue("Combined instructions")
;(vi.mocked(await import("../../prompts/sections/custom-instructions")) as any).addCustomInstructions =
	mockAddCustomInstructions

vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	OutputChannel: vi.fn(),
	WebviewView: vi.fn(),
	Uri: {
		joinPath: vi.fn(),
		file: vi.fn(),
	},
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
	},
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
			update: vi.fn(),
		}),
		onDidChangeConfiguration: vi.fn().mockImplementation(() => ({
			dispose: vi.fn(),
		})),
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		appName: "Visual Studio Code",
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	version: "1.85.0",
}))

describe("ClineProvider - Multi-Window Mode Isolation", () => {
	let provider1: ClineProvider
	let provider2: ClineProvider
	let mockContext1: vscode.ExtensionContext
	let mockContext2: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView1: vscode.WebviewView
	let mockWebviewView2: vscode.WebviewView
	let mockPostMessage1: any
	let mockPostMessage2: any

	beforeEach(async () => {
		vi.clearAllMocks()

		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		// Create shared global state that both providers will use
		const sharedGlobalState: Record<string, string | undefined> = {
			mode: "code", // Initial global mode
			currentApiConfigName: "current-config",
		}

		// Clear any existing static state from ClineProvider
		// @ts-ignore - accessing private static property for testing
		if ((ClineProvider as any).activeInstances) {
			;(ClineProvider as any).activeInstances.clear()
		}

		const secrets: Record<string, string | undefined> = {}

		// Create first context (simulating first window)
		mockContext1 = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn().mockImplementation((key: string) => sharedGlobalState[key]),
				update: vi
					.fn()
					.mockImplementation((key: string, value: string | undefined) => (sharedGlobalState[key] = value)),
				keys: vi.fn().mockImplementation(() => Object.keys(sharedGlobalState)),
			},
			secrets: {
				get: vi.fn().mockImplementation((key: string) => secrets[key]),
				store: vi.fn().mockImplementation((key: string, value: string | undefined) => (secrets[key] = value)),
				delete: vi.fn().mockImplementation((key: string) => delete secrets[key]),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		// Create second context (simulating second window) - shares same global state
		mockContext2 = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn().mockImplementation((key: string) => sharedGlobalState[key]),
				update: vi
					.fn()
					.mockImplementation((key: string, value: string | undefined) => (sharedGlobalState[key] = value)),
				keys: vi.fn().mockImplementation(() => Object.keys(sharedGlobalState)),
			},
			secrets: {
				get: vi.fn().mockImplementation((key: string) => secrets[key]),
				store: vi.fn().mockImplementation((key: string, value: string | undefined) => (secrets[key] = value)),
				delete: vi.fn().mockImplementation((key: string) => delete secrets[key]),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		// Mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		} as unknown as vscode.OutputChannel

		// Mock webviews
		mockPostMessage1 = vi.fn()
		mockPostMessage2 = vi.fn()

		mockWebviewView1 = {
			webview: {
				postMessage: mockPostMessage1,
				html: "",
				options: {},
				onDidReceiveMessage: vi.fn(),
				asWebviewUri: vi.fn(),
			},
			visible: true,
			onDidDispose: vi.fn().mockImplementation((callback) => {
				callback()
				return { dispose: vi.fn() }
			}),
			onDidChangeVisibility: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
		} as unknown as vscode.WebviewView

		mockWebviewView2 = {
			webview: {
				postMessage: mockPostMessage2,
				html: "",
				options: {},
				onDidReceiveMessage: vi.fn(),
				asWebviewUri: vi.fn(),
			},
			visible: true,
			onDidDispose: vi.fn().mockImplementation((callback) => {
				callback()
				return { dispose: vi.fn() }
			}),
			onDidChangeVisibility: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
		} as unknown as vscode.WebviewView

		// Create and initialize ContextProxy instances
		const contextProxy1 = new ContextProxy(mockContext1)
		const contextProxy2 = new ContextProxy(mockContext2)
		await contextProxy1.initialize()
		await contextProxy2.initialize()

		// Create two provider instances (simulating two windows)
		provider1 = new ClineProvider(mockContext1, mockOutputChannel, "sidebar", contextProxy1)
		provider2 = new ClineProvider(mockContext2, mockOutputChannel, "sidebar", contextProxy2)

		// Mock getMcpHub method for both providers
		provider1.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})

		provider2.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})
	})

	test("each provider instance initializes with current global mode", async () => {
		// Both providers should initialize with the current global mode
		const state1 = await provider1.getState()
		const state2 = await provider2.getState()

		// Since the global state is set to "code", both should initialize with "code"
		expect(state1.mode).toBe("code") // Global mode
		expect(state2.mode).toBe("code") // Global mode
	})

	test("mode switch in one window does not affect other windows", async () => {
		await provider1.resolveWebviewView(mockWebviewView1)
		await provider2.resolveWebviewView(mockWebviewView2)

		// Get initial states - both should be in code mode
		const initialState1 = await provider1.getState()
		const initialState2 = await provider2.getState()
		expect(initialState1.mode).toBe("code")
		expect(initialState2.mode).toBe("code")

		// Switch mode in provider1 to architect
		await provider1.handleModeSwitch("architect")

		// Check states after mode switch
		const afterSwitchState1 = await provider1.getState()
		const afterSwitchState2 = await provider2.getState()

		// Provider1 should be in architect mode
		expect(afterSwitchState1.mode).toBe("architect")
		// Provider2 should still be in code mode (not affected)
		expect(afterSwitchState2.mode).toBe("code")
	})

	test("multiple mode switches in different windows remain isolated", async () => {
		await provider1.resolveWebviewView(mockWebviewView1)
		await provider2.resolveWebviewView(mockWebviewView2)

		// Switch provider1 to architect mode
		await provider1.handleModeSwitch("architect")

		// Switch provider2 to ask mode
		await provider2.handleModeSwitch("ask")

		// Check final states
		const finalState1 = await provider1.getState()
		const finalState2 = await provider2.getState()

		// Each provider should maintain its own mode
		expect(finalState1.mode).toBe("architect")
		expect(finalState2.mode).toBe("ask")
	})

	test("new provider instances initialize with global mode, not instance-specific modes", async () => {
		// Switch provider1 to architect mode
		await provider1.handleModeSwitch("architect")

		// Create a new provider instance (simulating opening a new window)
		const contextProxy3 = new ContextProxy(mockContext1)
		await contextProxy3.initialize()
		const provider3 = new ClineProvider(mockContext1, mockOutputChannel, "sidebar", contextProxy3)
		provider3.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})

		// New provider should initialize with the current global mode (code), not provider1's mode (architect)
		const newProviderState = await provider3.getState()
		expect(newProviderState.mode).toBe("code") // Should be global mode, not "architect"

		// Verify provider1 still has its instance-specific mode
		const provider1State = await provider1.getState()
		expect(provider1State.mode).toBe("architect")
	})

	test("getStateToPostToWebview returns instance-specific mode", async () => {
		await provider1.resolveWebviewView(mockWebviewView1)
		await provider2.resolveWebviewView(mockWebviewView2)

		// Switch modes in both providers
		await provider1.handleModeSwitch("architect")
		await provider2.handleModeSwitch("ask")

		// Get webview states
		const webviewState1 = await provider1.getStateToPostToWebview()
		const webviewState2 = await provider2.getStateToPostToWebview()

		// Each should return its own instance-specific mode
		expect(webviewState1.mode).toBe("architect")
		expect(webviewState2.mode).toBe("ask")
	})

	test("mode message handler updates only the specific instance", async () => {
		await provider1.resolveWebviewView(mockWebviewView1)
		await provider2.resolveWebviewView(mockWebviewView2)

		// Get message handlers
		const messageHandler1 = (mockWebviewView1.webview.onDidReceiveMessage as any).mock.calls[0][0]
		const messageHandler2 = (mockWebviewView2.webview.onDidReceiveMessage as any).mock.calls[0][0]

		// Send mode change message to provider1
		await messageHandler1({ type: "mode", text: "architect" })

		// Check states
		const state1 = await provider1.getState()
		const state2 = await provider2.getState()

		// Only provider1 should have changed
		expect(state1.mode).toBe("architect")
		expect(state2.mode).toBe("code") // Should remain unchanged

		// Send mode change message to provider2
		await messageHandler2({ type: "mode", text: "ask" })

		// Check final states
		const finalState1 = await provider1.getState()
		const finalState2 = await provider2.getState()

		// Each should have its own mode
		expect(finalState1.mode).toBe("architect")
		expect(finalState2.mode).toBe("ask")
	})

	test("instance mode persists across state retrievals", async () => {
		await provider1.resolveWebviewView(mockWebviewView1)

		// Switch to architect mode
		await provider1.handleModeSwitch("architect")

		// Get state multiple times
		const state1 = await provider1.getState()
		const state2 = await provider1.getState()
		const state3 = await provider1.getState()

		// Mode should persist across multiple state retrievals
		expect(state1.mode).toBe("architect")
		expect(state2.mode).toBe("architect")
		expect(state3.mode).toBe("architect")
	})

	test("global state is not updated when switching instance modes", async () => {
		await provider1.resolveWebviewView(mockWebviewView1)

		// Get initial global mode
		const initialGlobalMode = mockContext1.globalState.get("mode")
		expect(initialGlobalMode).toBe("code")

		// Switch instance mode
		await provider1.handleModeSwitch("architect")

		// Global mode should remain unchanged
		const finalGlobalMode = mockContext1.globalState.get("mode")
		expect(finalGlobalMode).toBe("code") // Should still be "code"

		// But instance should have architect mode
		const instanceState = await provider1.getState()
		expect(instanceState.mode).toBe("architect")
	})

	test("fallback to global mode when instance mode is undefined", async () => {
		// Create provider without switching modes
		const state = await provider1.getState()

		// Should fallback to global mode when instance mode is not set
		expect(state.mode).toBe("code") // Global mode
	})

	test("fallback to default mode when both instance and global modes are undefined", async () => {
		// Clear global mode
		;(mockContext1.globalState.get as any).mockImplementation((key: string) => {
			if (key === "mode") return undefined
			return undefined
		})

		// Create new provider
		const contextProxy3 = new ContextProxy(mockContext1)
		await contextProxy3.initialize()
		const provider3 = new ClineProvider(mockContext1, mockOutputChannel, "sidebar", contextProxy3)
		provider3.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})

		const state = await provider3.getState()

		// Should fallback to default mode
		expect(state.mode).toBe(defaultModeSlug)
	})
})
