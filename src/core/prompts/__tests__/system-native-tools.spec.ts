import { describe, it, expect, vi, beforeEach } from "vitest"
import { SYSTEM_PROMPT } from "../system"
import { CodeIndexManager } from "../../../services/code-index/manager"
import type { SystemPromptSettings } from "../types"

vi.mock("../../../services/code-index/manager")
vi.mock("../../../utils/storage", () => ({
	getSettingsDirectoryPath: vi.fn().mockResolvedValue("/test/settings"),
}))
vi.mock("../../../utils/globalContext", () => ({
	ensureSettingsDirectoryExists: vi.fn().mockResolvedValue("/test/settings"),
}))

describe("SYSTEM_PROMPT with native tools", () => {
	const mockContext = {
		extensionUri: { fsPath: "/test/path" },
		globalStorageUri: { fsPath: "/test/global-storage" },
		globalState: {
			get: vi.fn(),
			update: vi.fn(),
		},
		workspaceState: {
			get: vi.fn(),
			update: vi.fn(),
		},
	} as any

	const defaultSettings: SystemPromptSettings = {
		maxConcurrentFileReads: 5,
		todoListEnabled: true,
		useAgentRules: true,
		newTaskRequireTodos: true,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should filter out update_todo_list when todoListEnabled is false", async () => {
		const mockCodeIndexManager = {
			isFeatureEnabled: true,
			isFeatureConfigured: true,
			isInitialized: true,
		}
		vi.mocked(CodeIndexManager.getInstance).mockReturnValue(mockCodeIndexManager as any)

		const result = await SYSTEM_PROMPT(
			mockContext,
			"/test/cwd",
			false,
			undefined,
			undefined,
			undefined,
			"code",
			undefined,
			undefined,
			undefined,
			true,
			undefined,
			false,
			undefined,
			undefined,
			false,
			{ ...defaultSettings, todoListEnabled: false },
			undefined,
			undefined,
			true, // useNativeTools
		)

		expect(result.tools).toBeDefined()
		const toolNames = result.tools?.map((t) => t.name) || []
		expect(toolNames).not.toContain("update_todo_list")
	})

	it("should include update_todo_list when todoListEnabled is true", async () => {
		const mockCodeIndexManager = {
			isFeatureEnabled: true,
			isFeatureConfigured: true,
			isInitialized: true,
		}
		vi.mocked(CodeIndexManager.getInstance).mockReturnValue(mockCodeIndexManager as any)

		const result = await SYSTEM_PROMPT(
			mockContext,
			"/test/cwd",
			false,
			undefined,
			undefined,
			undefined,
			"code",
			undefined,
			undefined,
			undefined,
			true,
			undefined,
			false,
			undefined,
			undefined,
			false,
			{ ...defaultSettings, todoListEnabled: true },
			undefined,
			undefined,
			true, // useNativeTools
		)

		expect(result.tools).toBeDefined()
		const toolNames = result.tools?.map((t) => t.name) || []
		expect(toolNames).toContain("update_todo_list")
	})

	it("should filter out codebase_search when feature is not configured", async () => {
		const mockCodeIndexManager = {
			isFeatureEnabled: false,
			isFeatureConfigured: false,
			isInitialized: false,
		}
		vi.mocked(CodeIndexManager.getInstance).mockReturnValue(mockCodeIndexManager as any)

		const result = await SYSTEM_PROMPT(
			mockContext,
			"/test/cwd",
			false,
			undefined,
			undefined,
			undefined,
			"code",
			undefined,
			undefined,
			undefined,
			true,
			undefined,
			false,
			undefined,
			undefined,
			false,
			undefined,
			undefined,
			undefined,
			true, // useNativeTools
		)

		expect(result.tools).toBeDefined()
		const toolNames = result.tools?.map((t) => t.name) || []
		expect(toolNames).not.toContain("codebase_search")
	})

	it("should filter out generate_image when experiment is disabled", async () => {
		const mockCodeIndexManager = {
			isFeatureEnabled: true,
			isFeatureConfigured: true,
			isInitialized: true,
		}
		vi.mocked(CodeIndexManager.getInstance).mockReturnValue(mockCodeIndexManager as any)

		const result = await SYSTEM_PROMPT(
			mockContext,
			"/test/cwd",
			false,
			undefined,
			undefined,
			undefined,
			"code",
			undefined,
			undefined,
			undefined,
			true,
			{ imageGeneration: false },
			false,
			undefined,
			undefined,
			false,
			undefined,
			undefined,
			undefined,
			true, // useNativeTools
		)

		expect(result.tools).toBeDefined()
		const toolNames = result.tools?.map((t) => t.name) || []
		expect(toolNames).not.toContain("generate_image")
	})

	it("should filter out run_slash_command when experiment is disabled", async () => {
		const mockCodeIndexManager = {
			isFeatureEnabled: true,
			isFeatureConfigured: true,
			isInitialized: true,
		}
		vi.mocked(CodeIndexManager.getInstance).mockReturnValue(mockCodeIndexManager as any)

		const result = await SYSTEM_PROMPT(
			mockContext,
			"/test/cwd",
			false,
			undefined,
			undefined,
			undefined,
			"code",
			undefined,
			undefined,
			undefined,
			true,
			{ runSlashCommand: false },
			false,
			undefined,
			undefined,
			false,
			undefined,
			undefined,
			undefined,
			true, // useNativeTools
		)

		expect(result.tools).toBeDefined()
		const toolNames = result.tools?.map((t) => t.name) || []
		expect(toolNames).not.toContain("run_slash_command")
	})
})
