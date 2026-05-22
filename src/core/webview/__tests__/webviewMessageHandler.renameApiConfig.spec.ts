// npx vitest run core/webview/__tests__/webviewMessageHandler.renameApiConfig.spec.ts

import type { ProviderSettingsWithId } from "@roo-code/types"

vi.mock("vscode", () => ({
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
	},
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
}))

vi.mock("../../../api/providers/fetchers/modelCache")
vi.mock("../../../integrations/openai-codex/oauth", () => ({
	openAiCodexOAuthManager: { getAccessToken: vi.fn(), getAccountId: vi.fn() },
}))
vi.mock("../../../integrations/openai-codex/rate-limits", () => ({
	fetchOpenAiCodexRateLimitInfo: vi.fn(),
}))
vi.mock("../../../services/command/commands", () => ({
	getCommands: vi.fn(),
}))
vi.mock("@anthropic-ai/vertex-sdk", () => ({ AnthropicVertex: vi.fn() }))
vi.mock("google-auth-library", () => ({ GoogleAuth: vi.fn() }))
vi.mock("ollama", () => ({ Ollama: vi.fn() }))
vi.mock("../diagnosticsHandler", () => ({
	generateErrorDiagnostics: vi.fn().mockResolvedValue({ success: true, filePath: "/tmp/diagnostics.json" }),
}))
vi.mock("fs/promises", () => ({
	default: { rm: vi.fn(), mkdir: vi.fn(), readFile: vi.fn().mockResolvedValue("[]"), writeFile: vi.fn() },
	rm: vi.fn(),
	mkdir: vi.fn(),
	readFile: vi.fn().mockResolvedValue("[]"),
	writeFile: vi.fn(),
}))
vi.mock("../../../utils/fs")
vi.mock("../../../utils/path")
vi.mock("../../../utils/globalContext")
vi.mock("../../mentions/resolveImageMentions", () => ({
	resolveImageMentions: vi.fn(async ({ text, images }: { text: string; images?: string[] }) => ({
		text,
		images: [...(images ?? [])],
	})),
}))

import * as vscode from "vscode"
import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"

describe("webviewMessageHandler - renameApiConfiguration", () => {
	let mockProvider: any

	const storedConfig: ProviderSettingsWithId & { name: string } = {
		name: "OldProfile",
		id: "profile-123",
		apiProvider: "anthropic",
		apiModelId: "claude-sonnet-4-20250514",
	}

	beforeEach(() => {
		vi.clearAllMocks()

		mockProvider = {
			getState: vi.fn(),
			postMessageToWebview: vi.fn(),
			postStateToWebview: vi.fn(),
			log: vi.fn(),
			getCurrentTask: vi.fn(),
			getTaskWithId: vi.fn(),
			createTaskWithHistoryItem: vi.fn(),
			getSkillsManager: vi.fn(),
			cwd: "/mock/workspace",
			customModesManager: {
				getCustomModes: vi.fn(),
				deleteCustomMode: vi.fn(),
			},
			context: {
				extensionPath: "/mock/extension/path",
				globalStorageUri: { fsPath: "/mock/global/storage" },
			},
			contextProxy: {
				context: {
					extensionPath: "/mock/extension/path",
					globalStorageUri: { fsPath: "/mock/global/storage" },
				},
				setValue: vi.fn(),
				getValue: vi.fn(),
			},
			providerSettingsManager: {
				getProfile: vi.fn().mockResolvedValue(storedConfig),
				saveConfig: vi.fn().mockResolvedValue("profile-123"),
				deleteConfig: vi.fn().mockResolvedValue(undefined),
				listConfig: vi.fn().mockResolvedValue([]),
			},
			activateProviderProfile: vi.fn().mockResolvedValue(undefined),
		}
	})

	it("renames a profile using stored config, not webview-supplied config", async () => {
		await webviewMessageHandler(
			mockProvider as unknown as ClineProvider,
			{
				type: "renameApiConfiguration",
				values: { oldName: "OldProfile", newName: "NewProfile" },
			} as any,
		)

		// Should load the stored profile by old name
		expect(mockProvider.providerSettingsManager.getProfile).toHaveBeenCalledWith({ name: "OldProfile" })

		// Should save with stored config (without the name field) under the new name
		expect(mockProvider.providerSettingsManager.saveConfig).toHaveBeenCalledWith("NewProfile", {
			id: "profile-123",
			apiProvider: "anthropic",
			apiModelId: "claude-sonnet-4-20250514",
		})

		// Should delete the old config
		expect(mockProvider.providerSettingsManager.deleteConfig).toHaveBeenCalledWith("OldProfile")

		// Should activate the new profile
		expect(mockProvider.activateProviderProfile).toHaveBeenCalledWith({ name: "NewProfile" })
	})

	it("does not require apiConfiguration in the message", async () => {
		// The message intentionally omits apiConfiguration
		await webviewMessageHandler(
			mockProvider as unknown as ClineProvider,
			{
				type: "renameApiConfiguration",
				values: { oldName: "OldProfile", newName: "NewProfile" },
			} as any,
		)

		// Should still proceed with the rename
		expect(mockProvider.providerSettingsManager.saveConfig).toHaveBeenCalled()
		expect(mockProvider.providerSettingsManager.deleteConfig).toHaveBeenCalled()
		expect(mockProvider.activateProviderProfile).toHaveBeenCalled()
	})

	it("skips rename when oldName equals newName", async () => {
		await webviewMessageHandler(
			mockProvider as unknown as ClineProvider,
			{
				type: "renameApiConfiguration",
				values: { oldName: "SameName", newName: "SameName" },
			} as any,
		)

		expect(mockProvider.providerSettingsManager.getProfile).not.toHaveBeenCalled()
		expect(mockProvider.providerSettingsManager.saveConfig).not.toHaveBeenCalled()
		expect(mockProvider.providerSettingsManager.deleteConfig).not.toHaveBeenCalled()
	})

	it("shows error toast when getProfile fails", async () => {
		mockProvider.providerSettingsManager.getProfile.mockRejectedValue(new Error("Config not found"))

		await webviewMessageHandler(
			mockProvider as unknown as ClineProvider,
			{
				type: "renameApiConfiguration",
				values: { oldName: "MissingProfile", newName: "NewProfile" },
			} as any,
		)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("common:errors.rename_api_config")
		expect(mockProvider.providerSettingsManager.saveConfig).not.toHaveBeenCalled()
	})

	it("does nothing when values is missing", async () => {
		await webviewMessageHandler(
			mockProvider as unknown as ClineProvider,
			{
				type: "renameApiConfiguration",
			} as any,
		)

		expect(mockProvider.providerSettingsManager.getProfile).not.toHaveBeenCalled()
		expect(mockProvider.providerSettingsManager.saveConfig).not.toHaveBeenCalled()
	})
})
