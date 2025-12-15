import type OpenAI from "openai"

import type { SerializedCustomToolDefinition } from "@roo-code/types"

type FunctionTool = Extract<OpenAI.Chat.ChatCompletionTool, { type: "function" }>

// Helper function to get tool name.
const getToolName = (tool: OpenAI.Chat.ChatCompletionTool): string | undefined => {
	if (tool.type === "function") {
		return (tool as FunctionTool).function.name
	}

	return undefined
}

// Helper function to find a function tool by name.
const findFunctionTool = (tools: OpenAI.Chat.ChatCompletionTool[], name: string): FunctionTool | undefined => {
	return tools.find((t) => t.type === "function" && (t as FunctionTool).function.name === name) as
		| FunctionTool
		| undefined
}

// Create mock registry that can be controlled per test.
const mockCustomToolRegistry = {
	loadFromDirectoryIfStale: vi.fn().mockResolvedValue({ loaded: [], failed: [] }),
	getAllSerialized: vi.fn().mockReturnValue([]),
	clear: vi.fn(),
	has: vi.fn().mockReturnValue(false),
}

vi.mock("vscode", () => ({
	EventEmitter: vi.fn().mockImplementation(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn(),
		}),
	},
}))

// Mock the CodeIndexManager dynamic import.
vi.mock("../../services/code-index/manager", () => ({
	CodeIndexManager: {
		getInstance: vi.fn().mockReturnValue({
			isFeatureEnabled: vi.fn().mockReturnValue(false),
		}),
	},
}))

vi.mock("@roo-code/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@roo-code/core")>()
	return {
		...actual,
		customToolRegistry: mockCustomToolRegistry,
	}
})

vi.mock("../prompts/tools/native-tools", () => ({
	getNativeTools: vi.fn().mockReturnValue([
		{
			type: "function",
			function: {
				name: "read_file",
				description: "Read files",
				parameters: {},
			},
		},
	]),
	getMcpServerTools: vi.fn().mockReturnValue([]),
}))

vi.mock("../prompts/tools/filter-tools-for-mode", () => ({
	filterNativeToolsForMode: vi.fn((tools) => tools),
	filterMcpToolsForMode: vi.fn((tools) => tools),
}))

describe("buildNativeToolsArray", () => {
	const mockProvider = {
		getMcpHub: vi.fn().mockReturnValue(undefined),
		context: {
			globalStorageUri: { fsPath: "/test/storage" },
			subscriptions: [],
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.resetModules()
		mockCustomToolRegistry.getAllSerialized.mockReturnValue([])
	})

	describe("custom tools injection", () => {
		it("should include custom tools in the returned array when registry has tools", async () => {
			const { buildNativeToolsArray } = await import("../build-tools")

			const customTools: SerializedCustomToolDefinition[] = [
				{
					name: "my_custom_tool",
					description: "A custom tool for testing",
				},
			]

			mockCustomToolRegistry.getAllSerialized.mockReturnValue(customTools)

			const result = await buildNativeToolsArray({
				provider: mockProvider as any,
				cwd: "/test/path",
				mode: "code",
				customModes: undefined,
				experiments: undefined,
				apiConfiguration: undefined,
				maxReadFileLine: -1,
				browserToolEnabled: true,
				modelInfo: undefined,
				diffEnabled: false,
			})

			// Should include both native tools and custom tools.
			expect(result.length).toBeGreaterThan(0)

			const customToolResult = findFunctionTool(result, "my_custom_tool")

			expect(customToolResult).toBeDefined()
			expect(customToolResult?.type).toBe("function")
			expect(customToolResult?.function.description).toBe("A custom tool for testing")
		})

		it("should include custom tools with parameters", async () => {
			const { buildNativeToolsArray } = await import("../build-tools")

			// getAllSerialized returns SerializedCustomToolDefinition with JSON Schema parameters
			const customTools: SerializedCustomToolDefinition[] = [
				{
					name: "parameterized_tool",
					description: "A tool with parameters",
					parameters: {
						type: "object",
						properties: {
							input: {
								type: "string",
								description: "The input value",
							},
							count: {
								type: "number",
								description: "Optional count",
							},
						},
						required: ["input"],
						additionalProperties: false,
					},
				},
			]

			mockCustomToolRegistry.getAllSerialized.mockReturnValue(customTools)

			const result = await buildNativeToolsArray({
				provider: mockProvider as any,
				cwd: "/test/path",
				mode: "code",
				customModes: undefined,
				experiments: undefined,
				apiConfiguration: undefined,
				maxReadFileLine: -1,
				browserToolEnabled: true,
				modelInfo: undefined,
				diffEnabled: false,
			})

			const paramTool = findFunctionTool(result, "parameterized_tool")

			expect(paramTool).toBeDefined()
			expect(paramTool?.function.parameters).toMatchObject({
				type: "object",
				properties: {
					input: {
						type: "string",
						description: "The input value",
					},
					count: {
						type: "number",
						description: "Optional count",
					},
				},
				required: ["input"],
				additionalProperties: false,
			})
		})

		it("should return only native tools when registry is empty", async () => {
			const { buildNativeToolsArray } = await import("../build-tools")

			const result = await buildNativeToolsArray({
				provider: mockProvider as any,
				cwd: "/test/path",
				mode: "code",
				customModes: undefined,
				experiments: undefined,
				apiConfiguration: undefined,
				maxReadFileLine: -1,
				browserToolEnabled: true,
				modelInfo: undefined,
				diffEnabled: false,
			})

			// Should still return native tools.
			expect(result.length).toBeGreaterThan(0)

			// Should not contain any custom tools (just the mocked native tools).
			const nativeToolNames = result.map(getToolName)
			expect(nativeToolNames).toContain("read_file")
		})

		it("should return only native tools when registry returns empty array", async () => {
			const { buildNativeToolsArray } = await import("../build-tools")

			mockCustomToolRegistry.getAllSerialized.mockReturnValue([])

			const result = await buildNativeToolsArray({
				provider: mockProvider as any,
				cwd: "/test/path",
				mode: "code",
				customModes: undefined,
				experiments: undefined,
				apiConfiguration: undefined,
				maxReadFileLine: -1,
				browserToolEnabled: true,
				modelInfo: undefined,
				diffEnabled: false,
			})

			// Should return native tools without error.
			expect(result.length).toBeGreaterThan(0)
		})

		it("should include multiple custom tools", async () => {
			const { buildNativeToolsArray } = await import("../build-tools")

			const customTools: SerializedCustomToolDefinition[] = [
				{
					name: "tool_one",
					description: "First custom tool",
				},
				{
					name: "tool_two",
					description: "Second custom tool",
				},
				{
					name: "tool_three",
					description: "Third custom tool",
				},
			]

			mockCustomToolRegistry.getAllSerialized.mockReturnValue(customTools)

			const result = await buildNativeToolsArray({
				provider: mockProvider as any,
				cwd: "/test/path",
				mode: "code",
				customModes: undefined,
				experiments: undefined,
				apiConfiguration: undefined,
				maxReadFileLine: -1,
				browserToolEnabled: true,
				modelInfo: undefined,
				diffEnabled: false,
			})

			// Should find all three custom tools.
			expect(findFunctionTool(result, "tool_one")).toBeDefined()
			expect(findFunctionTool(result, "tool_two")).toBeDefined()
			expect(findFunctionTool(result, "tool_three")).toBeDefined()
		})

		it("should append custom tools after native and MCP tools", async () => {
			const { buildNativeToolsArray } = await import("../build-tools")

			const customTools: SerializedCustomToolDefinition[] = [
				{
					name: "custom_tool",
					description: "A custom tool",
				},
			]

			mockCustomToolRegistry.getAllSerialized.mockReturnValue(customTools)

			const result = await buildNativeToolsArray({
				provider: mockProvider as any,
				cwd: "/test/path",
				mode: "code",
				customModes: undefined,
				experiments: undefined,
				apiConfiguration: undefined,
				maxReadFileLine: -1,
				browserToolEnabled: true,
				modelInfo: undefined,
				diffEnabled: false,
			})

			// Custom tools should be at the end of the array.
			const lastTool = result[result.length - 1] as FunctionTool
			expect(lastTool.function.name).toBe("custom_tool")
		})
	})
})
