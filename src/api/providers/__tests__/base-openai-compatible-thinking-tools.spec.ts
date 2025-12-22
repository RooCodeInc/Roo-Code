import { describe, it, expect, vi, beforeEach } from "vitest"
import OpenAI from "openai"
import { BaseOpenAiCompatibleProvider } from "../base-openai-compatible-provider"
import type { ModelInfo } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../../shared/api"

// Create a concrete implementation for testing
class TestProvider extends BaseOpenAiCompatibleProvider<"test-model"> {
	constructor(options: ApiHandlerOptions) {
		super({
			providerName: "TestProvider",
			baseURL: "https://test.api.com",
			defaultProviderModelId: "test-model",
			providerModels: {
				"test-model": {
					maxTokens: 4096,
					contextWindow: 8192,
					supportsReasoningBinary: true,
				} as ModelInfo,
			},
			apiKey: "test-key",
			...options,
		})
	}
}

describe("BaseOpenAiCompatibleProvider - Tool Calls in Thinking", () => {
	let provider: TestProvider
	let mockCreate: ReturnType<typeof vi.fn>

	beforeEach(() => {
		mockCreate = vi.fn()
		vi.spyOn(OpenAI.Chat.Completions.prototype, "create").mockImplementation(mockCreate)
	})

	it("should extract tool calls from thinking content when no regular content exists", async () => {
		provider = new TestProvider({
			apiKey: "test-key",
			enableReasoningEffort: true,
		})

		// Mock a response where all content is in thinking tags with embedded tool calls
		mockCreate.mockImplementationOnce(async () => ({
			[Symbol.asyncIterator]: async function* () {
				// First chunk: thinking content with tool calls
				yield {
					choices: [
						{
							delta: {
								content: `<think>
L'utilisateur me demande de faire une review du code et de bien séparer les appels d'outils de mes pensées. Je vais analyser le fichier server/index.ts en profondeur et créer une todo list pour organiser ma revue complète du projet.

Je vais commencer par créer une todo list pour structurer ma revue, puis lire les autres fichiers importants du projet.

<update_todo_list>
<todos>
[ ] Lire et analyser la structure du projet
[ ] Examiner le fichier server/index.ts en détail
[ ] Analyser les composants React et leur architecture
[ ] Vérifier les types et interfaces
[ ] Identifier les problèmes de qualité de code
[ ] Détecter les redondances et code mort
[ ] Analyser la sécurité et les vulnérabilités
[ ] Évaluer la performance et l'efficacité
[ ] Vérifier la maintenabilité et la lisibilité
[ ] Rédiger le rapport de review complet
</todos>
</update_todo_list>

Maintenant, laissez-moi examiner les autres fichiers clés du projet pour avoir une vue d'ensemble complète :

<read_file>
<files>
[{"path": "src/App.tsx"}, {"path": "src/types/index.ts"}, {"path": "package.json"}]
</files>
</read_file>
</think>`,
							},
						},
					],
				}

				// Final chunk with usage
				yield {
					usage: {
						prompt_tokens: 100,
						completion_tokens: 50,
					},
				}
			},
		}))

		const messages = [{ role: "user" as const, content: "Review my code" }]
		const chunks: any[] = []

		for await (const chunk of provider.createMessage("System prompt", messages)) {
			chunks.push(chunk)
		}

		// Should have reasoning chunks
		const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
		expect(reasoningChunks.length).toBeGreaterThan(0)

		// Should have extracted tool calls from thinking content
		const toolCallChunks = chunks.filter((c) => c.type === "tool_call_partial")
		expect(toolCallChunks.length).toBe(2) // update_todo_list and read_file

		// Verify first tool call (update_todo_list)
		const updateTodoCall = toolCallChunks.find((c) => c.name === "update_todo_list")
		expect(updateTodoCall).toBeDefined()
		expect(updateTodoCall.index).toBe(0)
		expect(updateTodoCall.id).toMatch(/^tool_\d+_0$/)

		// Verify second tool call (read_file)
		const readFileCall = toolCallChunks.find((c) => c.name === "read_file")
		expect(readFileCall).toBeDefined()
		expect(readFileCall.index).toBe(1)
		expect(readFileCall.id).toMatch(/^tool_\d+_1$/)

		// Should have usage chunk
		const usageChunk = chunks.find((c) => c.type === "usage")
		expect(usageChunk).toBeDefined()
	})

	it("should not extract tool calls when regular content exists", async () => {
		provider = new TestProvider({
			apiKey: "test-key",
			enableReasoningEffort: true,
		})

		// Mock a response with both thinking and regular content
		mockCreate.mockImplementationOnce(async () => ({
			[Symbol.asyncIterator]: async function* () {
				// First chunk: thinking content
				yield {
					choices: [
						{
							delta: {
								content: `<think>
I need to use the read_file tool to examine the code.
<read_file>
<files>[{"path": "test.ts"}]</files>
</read_file>
</think>Here is my analysis of your code:`,
							},
						},
					],
				}

				// Second chunk: regular content
				yield {
					choices: [
						{
							delta: {
								content: "Your code looks good overall.",
							},
						},
					],
				}

				// Final chunk with usage
				yield {
					usage: {
						prompt_tokens: 100,
						completion_tokens: 50,
					},
				}
			},
		}))

		const messages = [{ role: "user" as const, content: "Review my code" }]
		const chunks: any[] = []

		for await (const chunk of provider.createMessage("System prompt", messages)) {
			chunks.push(chunk)
		}

		// Should have both reasoning and text chunks
		const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
		const textChunks = chunks.filter((c) => c.type === "text")
		expect(reasoningChunks.length).toBeGreaterThan(0)
		expect(textChunks.length).toBeGreaterThan(0)

		// Should NOT extract tool calls since regular content exists
		const toolCallChunks = chunks.filter((c) => c.type === "tool_call_partial")
		expect(toolCallChunks.length).toBe(0)
	})

	it("should handle tool calls that come through normal delta.tool_calls", async () => {
		provider = new TestProvider({
			apiKey: "test-key",
		})

		// Mock a response with tool calls in delta
		mockCreate.mockImplementationOnce(async () => ({
			[Symbol.asyncIterator]: async function* () {
				// Thinking content without tool calls
				yield {
					choices: [
						{
							delta: {
								content: "<think>I need to read a file</think>",
							},
						},
					],
				}

				// Tool call through normal channel
				yield {
					choices: [
						{
							delta: {
								tool_calls: [
									{
										index: 0,
										id: "call_123",
										function: {
											name: "read_file",
											arguments: '{"files":[{"path":"test.ts"}]}',
										},
									},
								],
							},
						},
					],
				}

				// Final chunk with usage
				yield {
					usage: {
						prompt_tokens: 100,
						completion_tokens: 50,
					},
				}
			},
		}))

		const messages = [{ role: "user" as const, content: "Review my code" }]
		const chunks: any[] = []

		for await (const chunk of provider.createMessage("System prompt", messages)) {
			chunks.push(chunk)
		}

		// Should have reasoning chunk
		const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
		expect(reasoningChunks.length).toBeGreaterThan(0)

		// Should have tool call from normal channel (not extracted from thinking)
		const toolCallChunks = chunks.filter((c) => c.type === "tool_call_partial")
		expect(toolCallChunks.length).toBe(1)
		expect(toolCallChunks[0].id).toBe("call_123") // Original ID preserved
	})

	it("should handle malformed tool calls in thinking gracefully", async () => {
		provider = new TestProvider({
			apiKey: "test-key",
			enableReasoningEffort: true,
		})

		// Mock a response with malformed tool calls in thinking
		mockCreate.mockImplementationOnce(async () => ({
			[Symbol.asyncIterator]: async function* () {
				yield {
					choices: [
						{
							delta: {
								content: `<think>
I'll use some tools:
<not_a_real_tool>
This is not a known tool
</not_a_real_tool>

<read_file>
This is malformed JSON content that can't be parsed properly {{{
</read_file>
</think>`,
							},
						},
					],
				}

				// Final chunk with usage
				yield {
					usage: {
						prompt_tokens: 100,
						completion_tokens: 50,
					},
				}
			},
		}))

		const messages = [{ role: "user" as const, content: "Test malformed" }]
		const chunks: any[] = []

		// Should not throw an error
		for await (const chunk of provider.createMessage("System prompt", messages)) {
			chunks.push(chunk)
		}

		// Should have reasoning chunks
		const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
		expect(reasoningChunks.length).toBeGreaterThan(0)

		// Should only extract the known tool (read_file), not the unknown one
		const toolCallChunks = chunks.filter((c) => c.type === "tool_call_partial")
		expect(toolCallChunks.length).toBe(1)
		expect(toolCallChunks[0].name).toBe("read_file")

		// The malformed content should be passed as-is in the files field (primary param for read_file)
		const args = JSON.parse(toolCallChunks[0].arguments)
		expect(args.files).toBeDefined()
		expect(args.files).toMatch(/This is malformed JSON/)
	})

	it("should handle multiple tool calls in thinking content", async () => {
		provider = new TestProvider({
			apiKey: "test-key",
			enableReasoningEffort: true,
		})

		// Mock a response with multiple tool calls
		mockCreate.mockImplementationOnce(async () => ({
			[Symbol.asyncIterator]: async function* () {
				yield {
					choices: [
						{
							delta: {
								content: `<think>
First, I'll list the files:
<list_files>
<path>src</path>
<recursive>true</recursive>
</list_files>

Then search for patterns:
<search_files>
<path>src</path>
<regex>TODO</regex>
<file_pattern>*.ts</file_pattern>
</search_files>

Finally, execute a command:
<execute_command>
<command>npm test</command>
<cwd>.</cwd>
</execute_command>
</think>`,
							},
						},
					],
				}

				// Final chunk with usage
				yield {
					usage: {
						prompt_tokens: 100,
						completion_tokens: 50,
					},
				}
			},
		}))

		const messages = [{ role: "user" as const, content: "Analyze project" }]
		const chunks: any[] = []

		for await (const chunk of provider.createMessage("System prompt", messages)) {
			chunks.push(chunk)
		}

		// Should extract all three tool calls
		const toolCallChunks = chunks.filter((c) => c.type === "tool_call_partial")
		expect(toolCallChunks.length).toBe(3)

		// Verify tool names and indices
		const toolNames = toolCallChunks.map((c) => c.name)
		expect(toolNames).toEqual(["list_files", "search_files", "execute_command"])

		// Verify indices are sequential
		expect(toolCallChunks[0].index).toBe(0)
		expect(toolCallChunks[1].index).toBe(1)
		expect(toolCallChunks[2].index).toBe(2)

		// Verify arguments are properly extracted
		const listFilesArgs = JSON.parse(toolCallChunks[0].arguments)
		expect(listFilesArgs.path).toBe("src")
		expect(listFilesArgs.recursive).toBe("true")

		const searchFilesArgs = JSON.parse(toolCallChunks[1].arguments)
		expect(searchFilesArgs.path).toBe("src")
		expect(searchFilesArgs.regex).toBe("TODO")
		expect(searchFilesArgs.file_pattern).toBe("*.ts")

		const executeCommandArgs = JSON.parse(toolCallChunks[2].arguments)
		expect(executeCommandArgs.command).toBe("npm test")
		expect(executeCommandArgs.cwd).toBe(".")
	})
})
