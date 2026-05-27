// npx vitest core/tools/__tests__/codebaseSearchTool.spec.ts

import { codebaseSearchTool } from "../CodebaseSearchTool"
import { CodeIndexManager } from "../../../services/code-index/manager"
import { formatResponse } from "../../prompts/responses"

vi.mock("vscode", () => ({
	workspace: {
		asRelativePath: vi.fn((filePath: string) => {
			// Simple mock: return the path as-is for testing
			return filePath
		}),
	},
}))

vi.mock("../../../services/code-index/manager", () => ({
	CodeIndexManager: {
		getInstance: vi.fn(),
	},
}))

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolDenied: vi.fn(() => "Tool denied"),
		toolError: vi.fn((msg: string) => `Error: ${msg}`),
	},
}))

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn(() => "/test/workspace"),
}))

describe("CodebaseSearchTool", () => {
	let mockTask: any
	let mockCallbacks: any
	let mockManager: any
	let pushToolResultValue: string | undefined

	beforeEach(() => {
		vi.clearAllMocks()
		pushToolResultValue = undefined

		mockManager = {
			isFeatureEnabled: true,
			isFeatureConfigured: true,
			searchIndex: vi.fn(),
		}
		;(CodeIndexManager.getInstance as any).mockReturnValue(mockManager)

		mockTask = {
			cwd: "/test/workspace",
			consecutiveMistakeCount: 0,
			didToolFailInCurrentTurn: false,
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing param error"),
			say: vi.fn().mockResolvedValue(undefined),
			providerRef: {
				deref: vi.fn().mockReturnValue({
					context: { extensionPath: "/test" },
				}),
			},
			rooIgnoreController: {
				validateAccess: vi.fn().mockReturnValue(true),
			},
		}

		mockCallbacks = {
			askApproval: vi.fn().mockResolvedValue(true),
			handleError: vi.fn(),
			pushToolResult: vi.fn((result: string) => {
				pushToolResultValue = result
			}),
		}
	})

	it("should filter out rooignored files from search results", async () => {
		// Set up search results with some files that should be ignored
		mockManager.searchIndex.mockResolvedValue([
			{
				score: 0.95,
				payload: {
					filePath: "src/app.ts",
					startLine: 1,
					endLine: 10,
					codeChunk: "const app = express()",
				},
			},
			{
				score: 0.9,
				payload: {
					filePath: "vendor/some-lib/crypto.c",
					startLine: 1,
					endLine: 20,
					codeChunk: "void crypto_init() {}",
				},
			},
			{
				score: 0.85,
				payload: {
					filePath: "src/utils.ts",
					startLine: 5,
					endLine: 15,
					codeChunk: "export function helper() {}",
				},
			},
		])

		// Mock rooIgnoreController to block vendor/ files
		mockTask.rooIgnoreController.validateAccess.mockImplementation((filePath: string) => {
			return !filePath.includes("vendor/")
		})

		await codebaseSearchTool.execute({ query: "crypto" }, mockTask, mockCallbacks)

		// Should have called pushToolResult with results that don't include vendor/ files
		expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
		const result = pushToolResultValue!
		expect(result).toContain("src/app.ts")
		expect(result).toContain("src/utils.ts")
		expect(result).not.toContain("vendor/some-lib/crypto.c")
	})

	it("should return no results message when all results are filtered by rooignore", async () => {
		mockManager.searchIndex.mockResolvedValue([
			{
				score: 0.9,
				payload: {
					filePath: "vendor/some-lib/crypto.c",
					startLine: 1,
					endLine: 20,
					codeChunk: "void crypto_init() {}",
				},
			},
		])

		// Mock rooIgnoreController to block all results
		mockTask.rooIgnoreController.validateAccess.mockReturnValue(false)

		await codebaseSearchTool.execute({ query: "crypto" }, mockTask, mockCallbacks)

		expect(mockCallbacks.pushToolResult).toHaveBeenCalledWith(
			'No relevant code snippets found for the query: "crypto"',
		)
	})

	it("should pass all results through when no rooIgnoreController is set", async () => {
		mockTask.rooIgnoreController = undefined

		mockManager.searchIndex.mockResolvedValue([
			{
				score: 0.95,
				payload: {
					filePath: "vendor/some-lib/crypto.c",
					startLine: 1,
					endLine: 20,
					codeChunk: "void crypto_init() {}",
				},
			},
		])

		await codebaseSearchTool.execute({ query: "crypto" }, mockTask, mockCallbacks)

		expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
		const result = pushToolResultValue!
		expect(result).toContain("vendor/some-lib/crypto.c")
	})
})
