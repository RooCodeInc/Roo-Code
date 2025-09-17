import { describe, it, expect, vi, beforeEach } from "vitest"
import { getMcpPromptsAsCommands, executeMcpPrompt, parsePromptArguments } from "../mcp-prompts"
import { McpHub } from "../../mcp/McpHub"
import type { McpServer, McpPrompt } from "../../../shared/mcp"

// Mock McpHub
vi.mock("../../mcp/McpHub")

describe("MCP Prompts", () => {
	let mockMcpHub: any

	beforeEach(() => {
		vi.clearAllMocks()
		mockMcpHub = {
			getAllServers: vi.fn(),
			getPrompt: vi.fn(),
		}
	})

	describe("getMcpPromptsAsCommands", () => {
		it("should return empty array when mcpHub is undefined", async () => {
			const result = await getMcpPromptsAsCommands(undefined)
			expect(result).toEqual([])
		})

		it("should return empty array when no servers have prompts", async () => {
			const servers: McpServer[] = [
				{
					name: "test-server",
					config: "test-config",
					status: "connected",
					tools: [],
					resources: [],
					prompts: [],
				},
			]
			mockMcpHub.getAllServers.mockReturnValue(servers)

			const result = await getMcpPromptsAsCommands(mockMcpHub)
			expect(result).toEqual([])
		})

		it("should convert MCP prompts to commands", async () => {
			const prompts: McpPrompt[] = [
				{
					name: "generate-code",
					description: "Generate code based on requirements",
					arguments: [
						{
							name: "language",
							description: "Programming language",
							required: true,
						},
					],
				},
				{
					name: "explain",
					description: "Explain a concept",
					arguments: [],
				},
			]

			const servers: McpServer[] = [
				{
					name: "coding-assistant",
					config: "test-config",
					status: "connected",
					tools: [],
					resources: [],
					prompts,
					source: "global",
				},
			]
			mockMcpHub.getAllServers.mockReturnValue(servers)

			const result = await getMcpPromptsAsCommands(mockMcpHub)

			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({
				name: "mcp.coding-assistant.generate-code",
				content: "",
				source: "global",
				filePath: "",
				description: "Generate code based on requirements",
				argumentHint: "<language>",
			})
			expect(result[1]).toEqual({
				name: "mcp.coding-assistant.explain",
				content: "",
				source: "global",
				filePath: "",
				description: "Explain a concept",
				argumentHint: undefined,
			})
		})

		it("should handle multiple servers with prompts", async () => {
			const server1: McpServer = {
				name: "server1",
				config: "test-config",
				status: "connected",
				tools: [],
				resources: [],
				prompts: [
					{
						name: "prompt1",
						description: "First prompt",
						arguments: [],
					},
				],
				source: "project",
			}

			const server2: McpServer = {
				name: "server2",
				config: "test-config",
				status: "connected",
				tools: [],
				resources: [],
				prompts: [
					{
						name: "prompt2",
						description: "Second prompt",
						arguments: [
							{
								name: "param",
								description: "A parameter",
								required: false,
							},
						],
					},
				],
				source: "global",
			}

			mockMcpHub.getAllServers.mockReturnValue([server1, server2])

			const result = await getMcpPromptsAsCommands(mockMcpHub)

			expect(result).toHaveLength(2)
			expect(result[0].name).toBe("mcp.server1.prompt1")
			expect(result[1].name).toBe("mcp.server2.prompt2")
			expect(result[1].argumentHint).toBe("[param]")
		})

		it("should handle prompts with multiple arguments", async () => {
			const prompts: McpPrompt[] = [
				{
					name: "complex-prompt",
					description: "A complex prompt",
					arguments: [
						{
							name: "arg1",
							description: "First argument",
							required: true,
						},
						{
							name: "arg2",
							description: "Second argument",
							required: false,
						},
						{
							name: "arg3",
							description: "Third argument",
							required: true,
						},
					],
				},
			]

			const servers: McpServer[] = [
				{
					name: "test",
					config: "test-config",
					status: "connected",
					tools: [],
					resources: [],
					prompts,
					source: "global",
				},
			]
			mockMcpHub.getAllServers.mockReturnValue(servers)

			const result = await getMcpPromptsAsCommands(mockMcpHub)

			expect(result[0].argumentHint).toBe("<arg1> <arg3> [arg2]")
		})
	})

	describe("executeMcpPrompt", () => {
		it("should execute prompt without arguments", async () => {
			const mockResponse = {
				messages: [
					{
						content: {
							type: "text" as const,
							text: "Generated content",
						},
					},
				],
			}
			mockMcpHub.getPrompt.mockResolvedValue(mockResponse)

			const result = await executeMcpPrompt(mockMcpHub, "test-server", "test-prompt", {})

			expect(mockMcpHub.getPrompt).toHaveBeenCalledWith("test-server", "test-prompt", {})
			expect(result).toBe("Generated content")
		})

		it("should execute prompt with arguments", async () => {
			const mockResponse = {
				messages: [
					{
						content: {
							type: "text" as const,
							text: "Result with args",
						},
					},
				],
			}
			mockMcpHub.getPrompt.mockResolvedValue(mockResponse)

			const result = await executeMcpPrompt(mockMcpHub, "server", "prompt", {
				language: "python",
				description: "A test function",
			})

			expect(mockMcpHub.getPrompt).toHaveBeenCalledWith("server", "prompt", {
				language: "python",
				description: "A test function",
			})
			expect(result).toBe("Result with args")
		})

		it("should handle multiple messages in response", async () => {
			const mockResponse = {
				messages: [
					{
						content: {
							type: "text" as const,
							text: "First message",
						},
					},
					{
						content: {
							type: "text" as const,
							text: "Second message",
						},
					},
				],
			}
			mockMcpHub.getPrompt.mockResolvedValue(mockResponse)

			const result = await executeMcpPrompt(mockMcpHub, "server", "prompt", {})

			expect(result).toBe("First message\n\nSecond message")
		})

		it("should handle resource content types", async () => {
			const mockResponse = {
				messages: [
					{
						content: {
							type: "resource" as const,
							resource: {
								text: "Resource content",
							},
						},
					},
				],
			}
			mockMcpHub.getPrompt.mockResolvedValue(mockResponse)

			const result = await executeMcpPrompt(mockMcpHub, "server", "prompt", {})

			expect(result).toBe("Resource content")
		})

		it("should handle errors gracefully", async () => {
			mockMcpHub.getPrompt.mockRejectedValue(new Error("Connection failed"))

			await expect(executeMcpPrompt(mockMcpHub, "server", "prompt", {})).rejects.toThrow(
				"Failed to execute MCP prompt: Connection failed",
			)
		})

		it("should handle empty response", async () => {
			const mockResponse = {
				messages: [],
			}
			mockMcpHub.getPrompt.mockResolvedValue(mockResponse)

			const result = await executeMcpPrompt(mockMcpHub, "server", "prompt", {})

			expect(result).toBe("No messages returned from MCP prompt")
		})

		it("should handle messages without text content", async () => {
			const mockResponse = {
				messages: [
					{
						content: {
							type: "text" as const,
							text: "",
						},
					},
					{
						content: {
							type: "resource" as const,
							resource: {},
						},
					},
				],
			}
			mockMcpHub.getPrompt.mockResolvedValue(mockResponse)

			const result = await executeMcpPrompt(mockMcpHub, "server", "prompt", {})

			expect(result).toBe("No content returned from MCP prompt")
		})
	})

	describe("parsePromptArguments", () => {
		it("should return empty object for prompts without arguments", () => {
			const prompt: McpPrompt = {
				name: "test",
				description: "Test prompt",
				arguments: [],
			}

			const result = parsePromptArguments(prompt, "some args")
			expect(result).toEqual({})
		})

		it("should parse positional arguments", () => {
			const prompt: McpPrompt = {
				name: "test",
				description: "Test prompt",
				arguments: [
					{ name: "language", description: "Language", required: true },
					{ name: "framework", description: "Framework", required: false },
				],
			}

			const result = parsePromptArguments(prompt, "python django")
			expect(result).toEqual({
				language: "python",
				framework: "django",
			})
		})

		it("should handle missing optional arguments", () => {
			const prompt: McpPrompt = {
				name: "test",
				description: "Test prompt",
				arguments: [
					{ name: "required", description: "Required arg", required: true },
					{ name: "optional", description: "Optional arg", required: false },
				],
			}

			const result = parsePromptArguments(prompt, "value1")
			expect(result).toEqual({
				required: "value1",
			})
		})

		it("should handle extra arguments", () => {
			const prompt: McpPrompt = {
				name: "test",
				description: "Test prompt",
				arguments: [{ name: "arg1", description: "Arg 1", required: true }],
			}

			const result = parsePromptArguments(prompt, "value1 value2 value3")
			expect(result).toEqual({
				arg1: "value1",
			})
		})

		it("should handle empty argument string", () => {
			const prompt: McpPrompt = {
				name: "test",
				description: "Test prompt",
				arguments: [{ name: "arg1", description: "Arg 1", required: false }],
			}

			const result = parsePromptArguments(prompt, "")
			expect(result).toEqual({})
		})
	})
})
