import * as vscode from "vscode"

import { FimCompletionProvider } from "../FimCompletionProvider"
import * as FimApiClient from "../FimApiClient"

// Mock the API client
vi.mock("../FimApiClient", () => ({
	requestFimCompletion: vi.fn(),
}))

describe("FimCompletionProvider", () => {
	const mockRequestFimCompletion = vi.mocked(FimApiClient.requestFimCompletion)

	const defaultConfig = {
		enabled: true,
		provider: "openai-compatible" as const,
		modelId: "deepseek-coder",
		baseUrl: "http://localhost:1234",
		apiKey: "test-key",
		debounceMs: 0, // No debounce for tests
		maxTokens: 128,
	}

	// Create mock document
	function createMockDocument(text: string): vscode.TextDocument {
		const lines = text.split("\n")
		return {
			getText: vi.fn((range?: vscode.Range) => {
				if (!range) return text
				// Simplified: return text between positions
				const startOffset = getOffset(text, range.start.line, range.start.character)
				const endOffset = getOffset(text, range.end.line, range.end.character)
				return text.substring(startOffset, endOffset)
			}),
			lineCount: lines.length,
			lineAt: vi.fn((line: number) => ({
				range: {
					end: new vscode.Position(line, lines[line]?.length ?? 0),
				},
			})),
		} as unknown as vscode.TextDocument
	}

	function getOffset(text: string, line: number, character: number): number {
		const lines = text.split("\n")
		let offset = 0
		for (let i = 0; i < line && i < lines.length; i++) {
			offset += lines[i].length + 1 // +1 for newline
		}
		return offset + character
	}

	// Create mock cancellation token
	function createMockToken(cancelled = false): vscode.CancellationToken {
		return {
			isCancellationRequested: cancelled,
			onCancellationRequested: vi.fn(() => ({ dispose: vi.fn() })),
		}
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should return undefined when disabled", async () => {
		const provider = new FimCompletionProvider({ ...defaultConfig, enabled: false })
		const doc = createMockDocument("const x = ")
		const pos = new vscode.Position(0, 10)
		const token = createMockToken()

		const result = await provider.provideInlineCompletionItems(
			doc,
			pos,
			{ triggerKind: vscode.InlineCompletionTriggerKind.Automatic } as vscode.InlineCompletionContext,
			token,
		)

		expect(result).toBeUndefined()
		expect(mockRequestFimCompletion).not.toHaveBeenCalled()
	})

	it("should return undefined for empty documents", async () => {
		const provider = new FimCompletionProvider(defaultConfig)
		const doc = createMockDocument("")
		const pos = new vscode.Position(0, 0)
		const token = createMockToken()

		const result = await provider.provideInlineCompletionItems(
			doc,
			pos,
			{ triggerKind: vscode.InlineCompletionTriggerKind.Automatic } as vscode.InlineCompletionContext,
			token,
		)

		expect(result).toBeUndefined()
	})

	it("should return completion items on successful API response", async () => {
		mockRequestFimCompletion.mockResolvedValueOnce({
			completion: '  console.log("hello");',
		})

		const provider = new FimCompletionProvider(defaultConfig)
		const doc = createMockDocument("function hello() {\n}")
		const pos = new vscode.Position(0, 19)
		const token = createMockToken()

		const result = await provider.provideInlineCompletionItems(
			doc,
			pos,
			{ triggerKind: vscode.InlineCompletionTriggerKind.Automatic } as vscode.InlineCompletionContext,
			token,
		)

		expect(result).toBeDefined()
		expect(result).toHaveLength(1)
		expect(mockRequestFimCompletion).toHaveBeenCalledOnce()
	})

	it("should return undefined for whitespace-only completions", async () => {
		mockRequestFimCompletion.mockResolvedValueOnce({
			completion: "   \n  \t  ",
		})

		const provider = new FimCompletionProvider(defaultConfig)
		const doc = createMockDocument("const x = ")
		const pos = new vscode.Position(0, 10)
		const token = createMockToken()

		const result = await provider.provideInlineCompletionItems(
			doc,
			pos,
			{ triggerKind: vscode.InlineCompletionTriggerKind.Automatic } as vscode.InlineCompletionContext,
			token,
		)

		expect(result).toBeUndefined()
	})

	it("should return undefined when API request fails", async () => {
		mockRequestFimCompletion.mockRejectedValueOnce(new Error("Network error"))

		const provider = new FimCompletionProvider(defaultConfig)
		const doc = createMockDocument("const x = ")
		const pos = new vscode.Position(0, 10)
		const token = createMockToken()

		const result = await provider.provideInlineCompletionItems(
			doc,
			pos,
			{ triggerKind: vscode.InlineCompletionTriggerKind.Automatic } as vscode.InlineCompletionContext,
			token,
		)

		expect(result).toBeUndefined()
	})

	it("should cache results and return cached completions", async () => {
		mockRequestFimCompletion.mockResolvedValue({
			completion: "42",
		})

		const provider = new FimCompletionProvider(defaultConfig)
		const doc = createMockDocument("const x = ")
		const pos = new vscode.Position(0, 10)
		const token = createMockToken()
		const context = { triggerKind: vscode.InlineCompletionTriggerKind.Automatic } as vscode.InlineCompletionContext

		// First call - should hit API
		await provider.provideInlineCompletionItems(doc, pos, context, token)
		expect(mockRequestFimCompletion).toHaveBeenCalledOnce()

		// Second call with same context - should use cache
		await provider.provideInlineCompletionItems(doc, pos, context, token)
		expect(mockRequestFimCompletion).toHaveBeenCalledOnce() // Still only 1 call
	})

	it("should clear cache when config is updated", async () => {
		mockRequestFimCompletion.mockResolvedValue({
			completion: "42",
		})

		const provider = new FimCompletionProvider(defaultConfig)
		const doc = createMockDocument("const x = ")
		const pos = new vscode.Position(0, 10)
		const token = createMockToken()
		const context = { triggerKind: vscode.InlineCompletionTriggerKind.Automatic } as vscode.InlineCompletionContext

		// First call
		await provider.provideInlineCompletionItems(doc, pos, context, token)
		expect(mockRequestFimCompletion).toHaveBeenCalledOnce()

		// Update config - should clear cache
		provider.updateConfig(defaultConfig)

		// Third call - should hit API again since cache was cleared
		await provider.provideInlineCompletionItems(doc, pos, context, token)
		expect(mockRequestFimCompletion).toHaveBeenCalledTimes(2)
	})

	it("should dispose properly", () => {
		const provider = new FimCompletionProvider(defaultConfig)
		expect(() => provider.dispose()).not.toThrow()
	})
})
