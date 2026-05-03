import * as vscode from "vscode"

import { FimService } from "../FimService"
import type { GlobalSettings } from "@roo-code/types"

// Mock vscode.languages.registerInlineCompletionItemProvider
const mockRegisterDisposable = { dispose: vi.fn() }
vscode.languages.registerInlineCompletionItemProvider = vi.fn().mockReturnValue(mockRegisterDisposable)

describe("FimService", () => {
	let outputChannel: vscode.OutputChannel

	beforeEach(() => {
		vi.clearAllMocks()
		outputChannel = {
			appendLine: vi.fn(),
		} as unknown as vscode.OutputChannel
	})

	it("should not activate when FIM is disabled", () => {
		const service = new FimService(outputChannel)
		const settings: GlobalSettings = {
			fimEnabled: false,
			fimProvider: "openai-compatible",
			fimModelId: "deepseek-coder",
		}

		service.updateSettings(settings)

		expect(service.isActive()).toBe(false)
		expect(vscode.languages.registerInlineCompletionItemProvider).not.toHaveBeenCalled()
	})

	it("should not activate when model ID is empty", () => {
		const service = new FimService(outputChannel)
		const settings: GlobalSettings = {
			fimEnabled: true,
			fimProvider: "openai-compatible",
			fimModelId: "",
		}

		service.updateSettings(settings)

		expect(service.isActive()).toBe(false)
	})

	it("should activate when FIM is enabled with a model ID", () => {
		const service = new FimService(outputChannel)
		const settings: GlobalSettings = {
			fimEnabled: true,
			fimProvider: "openai-compatible",
			fimModelId: "deepseek-coder",
		}

		service.updateSettings(settings)

		expect(service.isActive()).toBe(true)
		expect(vscode.languages.registerInlineCompletionItemProvider).toHaveBeenCalledOnce()
	})

	it("should deactivate when settings change to disabled", () => {
		const service = new FimService(outputChannel)

		// First activate
		service.updateSettings({
			fimEnabled: true,
			fimProvider: "openai-compatible",
			fimModelId: "deepseek-coder",
		})
		expect(service.isActive()).toBe(true)

		// Then deactivate
		service.updateSettings({
			fimEnabled: false,
		})
		expect(service.isActive()).toBe(false)
		expect(mockRegisterDisposable.dispose).toHaveBeenCalled()
	})

	it("should update config without re-registering when already active", () => {
		const service = new FimService(outputChannel)

		service.updateSettings({
			fimEnabled: true,
			fimProvider: "openai-compatible",
			fimModelId: "deepseek-coder",
		})

		// Update with new model
		service.updateSettings({
			fimEnabled: true,
			fimProvider: "openai-compatible",
			fimModelId: "codestral-latest",
		})

		// Should only register once
		expect(vscode.languages.registerInlineCompletionItemProvider).toHaveBeenCalledOnce()
		expect(service.isActive()).toBe(true)
	})

	it("should pass API key to config", () => {
		const service = new FimService(outputChannel)

		service.updateSettings(
			{
				fimEnabled: true,
				fimProvider: "deepseek",
				fimModelId: "deepseek-coder",
			},
			"my-secret-key",
		)

		expect(service.isActive()).toBe(true)
	})

	it("should use default provider when not specified", () => {
		const service = new FimService(outputChannel)

		service.updateSettings({
			fimEnabled: true,
			fimModelId: "some-model",
		})

		expect(service.isActive()).toBe(true)
	})

	it("should dispose properly", () => {
		const service = new FimService(outputChannel)

		service.updateSettings({
			fimEnabled: true,
			fimProvider: "openai-compatible",
			fimModelId: "deepseek-coder",
		})

		service.dispose()

		expect(service.isActive()).toBe(false)
		expect(mockRegisterDisposable.dispose).toHaveBeenCalled()
	})

	it("should log activation and deactivation messages", () => {
		const service = new FimService(outputChannel)

		service.updateSettings({
			fimEnabled: true,
			fimProvider: "openai-compatible",
			fimModelId: "deepseek-coder",
		})

		expect(outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("[FIM] Activated"))

		service.updateSettings({ fimEnabled: false })

		expect(outputChannel.appendLine).toHaveBeenCalledWith("[FIM] Deactivated")
	})
})
