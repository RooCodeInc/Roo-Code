// npx vitest run src/core/webview/__tests__/webviewMessageHandler.draftMessage.spec.ts

import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"

vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
	},
}))

describe("webviewMessageHandler - Draft Message", () => {
	let mockClineProvider: ClineProvider

	beforeEach(() => {
		vi.clearAllMocks()

		mockClineProvider = {
			saveDraftMessage: vi.fn().mockResolvedValue(undefined),
			getDraftMessage: vi.fn(),
			clearDraftMessage: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn(),
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: {},
			}),
			contextProxy: {
				context: {
					extensionPath: "/mock/extension/path",
					globalStorageUri: { fsPath: "/mock/global/storage" },
				},
				setValue: vi.fn(),
				getValue: vi.fn(),
			},
			log: vi.fn(),
		} as unknown as ClineProvider
	})

	describe("saveDraftMessage", () => {
		it("should save draft message with text and images", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "saveDraftMessage",
				text: "Test draft message",
				images: ["data:image/png;base64,abc123"],
			})

			expect(mockClineProvider.saveDraftMessage).toHaveBeenCalledWith("Test draft message", [
				"data:image/png;base64,abc123",
			])
		})

		it("should save draft message with only text", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "saveDraftMessage",
				text: "Text only draft",
			})

			expect(mockClineProvider.saveDraftMessage).toHaveBeenCalledWith("Text only draft", [])
		})

		it("should save draft message with only images", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "saveDraftMessage",
				images: ["data:image/png;base64,image1", "data:image/png;base64,image2"],
			})

			expect(mockClineProvider.saveDraftMessage).toHaveBeenCalledWith("", [
				"data:image/png;base64,image1",
				"data:image/png;base64,image2",
			])
		})

		it("should handle empty text and images", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "saveDraftMessage",
			})

			expect(mockClineProvider.saveDraftMessage).toHaveBeenCalledWith("", [])
		})
	})

	describe("getDraftMessage", () => {
		it("should return saved draft with text and images", async () => {
			const mockDraft = {
				text: "Saved draft",
				images: ["data:image/png;base64,savedImage"],
				timestamp: 1234567890,
			}
			;(mockClineProvider.getDraftMessage as ReturnType<typeof vi.fn>).mockReturnValue(mockDraft)

			await webviewMessageHandler(mockClineProvider, {
				type: "getDraftMessage",
			})

			expect(mockClineProvider.getDraftMessage).toHaveBeenCalled()
			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "draftMessage",
				text: "Saved draft",
				images: ["data:image/png;base64,savedImage"],
			})
		})

		it("should handle when no draft is saved", async () => {
			;(mockClineProvider.getDraftMessage as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

			await webviewMessageHandler(mockClineProvider, {
				type: "getDraftMessage",
			})

			expect(mockClineProvider.getDraftMessage).toHaveBeenCalled()
			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "draftMessage",
				text: undefined,
				images: undefined,
			})
		})

		it("should handle draft with only text", async () => {
			const mockDraft = {
				text: "Text only",
				images: [],
				timestamp: 1234567890,
			}
			;(mockClineProvider.getDraftMessage as ReturnType<typeof vi.fn>).mockReturnValue(mockDraft)

			await webviewMessageHandler(mockClineProvider, {
				type: "getDraftMessage",
			})

			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "draftMessage",
				text: "Text only",
				images: [],
			})
		})
	})

	describe("clearDraftMessage", () => {
		it("should clear the draft message", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "clearDraftMessage",
			})

			expect(mockClineProvider.clearDraftMessage).toHaveBeenCalled()
		})
	})
})
