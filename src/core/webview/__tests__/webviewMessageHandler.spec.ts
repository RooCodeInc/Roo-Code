import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { webviewMessageHandler } from "../webviewMessageHandler"
import { ClineProvider } from "../ClineProvider"
import { Package } from "../../../shared/package"
import { t } from "../../../i18n"

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
	workspace: {
		getConfiguration: vi.fn(),
	},
	ConfigurationTarget: {
		Global: 1,
	},
}))

// Mock i18n
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string, params?: any) => {
		if (key === "common:info.command_whitelisted" && params?.pattern) {
			return `Command pattern "${params.pattern}" has been whitelisted`
		}
		return key
	}),
}))

// Mock Package
vi.mock("../../../shared/package", () => ({
	Package: {
		name: "roo-code",
	},
}))

describe("webviewMessageHandler - whitelistCommand", () => {
	let mockProvider: any
	let mockContextProxy: any
	let mockConfigUpdate: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup mock for workspace configuration
		mockConfigUpdate = vi.fn().mockResolvedValue(undefined)
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			update: mockConfigUpdate,
		} as any)

		// Create mock context proxy
		mockContextProxy = {
			getValue: vi.fn(),
			setValue: vi.fn(),
		}

		// Create mock provider
		mockProvider = {
			contextProxy: mockContextProxy,
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
		} as any
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should add a new command pattern to the allowed commands list", async () => {
		// Setup initial state
		mockContextProxy.getValue.mockReturnValue(["npm test", "git status"])

		// Create message
		const message = {
			type: "whitelistCommand",
			pattern: "npm run build",
		}

		// Call handler
		await webviewMessageHandler(mockProvider, message as any)

		// Verify the pattern was added
		expect(mockContextProxy.setValue).toHaveBeenCalledWith("allowedCommands", [
			"npm test",
			"git status",
			"npm run build",
		])

		// Verify workspace settings were updated
		expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-code")
		expect(mockConfigUpdate).toHaveBeenCalledWith(
			"allowedCommands",
			["npm test", "git status", "npm run build"],
			vscode.ConfigurationTarget.Global,
		)

		// Verify user was notified
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			'Command pattern "npm run build" has been whitelisted',
		)

		// Verify state was posted to webview
		expect(mockProvider.postStateToWebview).toHaveBeenCalled()
	})

	it("should not add duplicate patterns", async () => {
		// Setup initial state with existing pattern
		mockContextProxy.getValue.mockReturnValue(["npm test", "git status", "npm run build"])

		// Create message with duplicate pattern
		const message = {
			type: "whitelistCommand",
			pattern: "npm run build",
		}

		// Call handler
		await webviewMessageHandler(mockProvider, message as any)

		// Verify setValue was NOT called (no update needed)
		expect(mockContextProxy.setValue).not.toHaveBeenCalled()

		// Verify workspace settings were NOT updated
		expect(mockConfigUpdate).not.toHaveBeenCalled()

		// Verify user was NOT notified
		expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()

		// Verify state was NOT posted to webview
		expect(mockProvider.postStateToWebview).not.toHaveBeenCalled()
	})

	it("should handle empty allowed commands list", async () => {
		// Setup with no existing commands
		mockContextProxy.getValue.mockReturnValue(undefined)

		// Create message
		const message = {
			type: "whitelistCommand",
			pattern: "echo 'Hello, World!'",
		}

		// Call handler
		await webviewMessageHandler(mockProvider, message as any)

		// Verify the pattern was added as the first item
		expect(mockContextProxy.setValue).toHaveBeenCalledWith("allowedCommands", ["echo 'Hello, World!'"])

		// Verify workspace settings were updated
		expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-code")
		expect(mockConfigUpdate).toHaveBeenCalledWith(
			"allowedCommands",
			["echo 'Hello, World!'"],
			vscode.ConfigurationTarget.Global,
		)

		// Verify user was notified
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			`Command pattern "echo 'Hello, World!'" has been whitelisted`,
		)
	})

	it("should filter out invalid commands", async () => {
		// Setup with some invalid commands
		mockContextProxy.getValue.mockReturnValue(["npm test", "", "  ", null, "git status"])

		// Create message
		const message = {
			type: "whitelistCommand",
			pattern: "npm run dev",
		}

		// Call handler
		await webviewMessageHandler(mockProvider, message as any)

		// Verify only valid commands were kept
		expect(mockContextProxy.setValue).toHaveBeenCalledWith("allowedCommands", [
			"npm test",
			"git status",
			"npm run dev",
		])
	})

	it("should handle missing pattern gracefully", async () => {
		// Create message without pattern
		const message = {
			type: "whitelistCommand",
		}

		// Call handler
		await webviewMessageHandler(mockProvider, message as any)

		// Verify nothing was updated
		expect(mockContextProxy.setValue).not.toHaveBeenCalled()
		expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
		expect(mockProvider.postStateToWebview).not.toHaveBeenCalled()
	})

	it("should handle non-string pattern gracefully", async () => {
		// Create message with non-string pattern
		const message = {
			type: "whitelistCommand",
			pattern: 123, // Invalid type
		}

		// Call handler
		await webviewMessageHandler(mockProvider, message as any)

		// Verify nothing was updated
		expect(mockContextProxy.setValue).not.toHaveBeenCalled()
		expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
		expect(mockProvider.postStateToWebview).not.toHaveBeenCalled()
	})

	it("should handle complex command patterns with special characters", async () => {
		// Setup initial state
		mockContextProxy.getValue.mockReturnValue(["npm test"])

		// Create message with complex pattern
		const message = {
			type: "whitelistCommand",
			pattern: 'echo "Hello, World!" && echo $HOME',
		}

		// Call handler
		await webviewMessageHandler(mockProvider, message as any)

		// Verify the pattern was added correctly
		expect(mockContextProxy.setValue).toHaveBeenCalledWith("allowedCommands", [
			"npm test",
			'echo "Hello, World!" && echo $HOME',
		])

		// Verify workspace settings were updated
		expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-code")
		expect(mockConfigUpdate).toHaveBeenCalledWith(
			"allowedCommands",
			["npm test", 'echo "Hello, World!" && echo $HOME'],
			vscode.ConfigurationTarget.Global,
		)
	})
})
