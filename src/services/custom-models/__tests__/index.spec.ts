import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as path from "path"

// Use vi.hoisted to ensure mocks are available during hoisting
const { mockReadFile, mockFileExists, mockGetGlobalRooDirectory, mockGetProjectRooDirectoryForCwd } = vi.hoisted(
	() => ({
		mockReadFile: vi.fn(),
		mockFileExists: vi.fn(),
		mockGetGlobalRooDirectory: vi.fn(),
		mockGetProjectRooDirectoryForCwd: vi.fn(),
	}),
)

// Mock fs/promises module
vi.mock("fs/promises", () => ({
	default: {
		readFile: mockReadFile,
	},
	readFile: mockReadFile,
}))

// Mock the roo-config module
vi.mock("../../roo-config", () => ({
	getGlobalRooDirectory: mockGetGlobalRooDirectory,
	getProjectRooDirectoryForCwd: mockGetProjectRooDirectoryForCwd,
	fileExists: mockFileExists,
}))

// Import after mocks
import { getCustomModelsForProvider } from "../index"

describe("getCustomModelsForProvider", () => {
	const mockCwd = "/test/workspace"
	const mockGlobalDir = "/home/user/.roo"
	const mockProjectDir = "/test/workspace/.roo"

	beforeEach(() => {
		vi.clearAllMocks()
		mockGetGlobalRooDirectory.mockReturnValue(mockGlobalDir)
		mockGetProjectRooDirectoryForCwd.mockReturnValue(mockProjectDir)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should return empty object when no files exist", async () => {
		mockFileExists.mockResolvedValue(false)

		const result = await getCustomModelsForProvider("openrouter", mockCwd)

		expect(result).toEqual({})
		expect(mockFileExists).toHaveBeenCalledTimes(2)
	})

	it("should load models from global file only", async () => {
		const globalModels = {
			"custom/model-1": {
				contextWindow: 32000,
				maxTokens: 4096,
				supportsPromptCache: false,
				description: "Global model",
			},
		}

		mockFileExists.mockImplementation(async (filePath: string) => {
			return filePath === path.join(mockGlobalDir, "models", "openrouter.json")
		})

		mockReadFile.mockImplementation(async (filePath: any) => {
			if (filePath === path.join(mockGlobalDir, "models", "openrouter.json")) {
				return JSON.stringify(globalModels)
			}
			throw new Error("File not found")
		})

		const result = await getCustomModelsForProvider("openrouter", mockCwd)

		expect(result).toEqual(globalModels)
	})

	it("should load models from project file only", async () => {
		const projectModels = {
			"custom/project-model": {
				contextWindow: 64000,
				maxTokens: 8192,
				supportsPromptCache: false,
				description: "Project model",
			},
		}

		mockFileExists.mockImplementation(async (filePath: string) => {
			return filePath === path.join(mockProjectDir, "models", "openrouter.json")
		})

		mockReadFile.mockImplementation(async (filePath: any) => {
			if (filePath === path.join(mockProjectDir, "models", "openrouter.json")) {
				return JSON.stringify(projectModels)
			}
			throw new Error("File not found")
		})

		const result = await getCustomModelsForProvider("openrouter", mockCwd)

		expect(result).toEqual(projectModels)
	})

	it("should merge global and project models with project overriding global", async () => {
		const globalModels = {
			"custom/model-1": {
				contextWindow: 32000,
				maxTokens: 4096,
				supportsPromptCache: false,
				description: "Global model 1",
			},
			"custom/model-2": {
				contextWindow: 64000,
				maxTokens: 8192,
				supportsPromptCache: false,
				description: "Global model 2",
			},
		}

		const projectModels = {
			"custom/model-1": {
				contextWindow: 128000,
				maxTokens: 16384,
				supportsPromptCache: true,
				description: "Project override for model 1",
			},
			"custom/model-3": {
				contextWindow: 16000,
				maxTokens: 2048,
				supportsPromptCache: false,
				description: "Project-only model",
			},
		}

		mockFileExists.mockResolvedValue(true)

		mockReadFile.mockImplementation(async (filePath: any) => {
			if (filePath === path.join(mockGlobalDir, "models", "openrouter.json")) {
				return JSON.stringify(globalModels)
			}
			if (filePath === path.join(mockProjectDir, "models", "openrouter.json")) {
				return JSON.stringify(projectModels)
			}
			throw new Error("File not found")
		})

		const result = await getCustomModelsForProvider("openrouter", mockCwd)

		expect(result).toEqual({
			"custom/model-1": projectModels["custom/model-1"], // Project overrides
			"custom/model-2": globalModels["custom/model-2"], // From global
			"custom/model-3": projectModels["custom/model-3"], // From project
		})
	})

	it("should handle invalid JSON gracefully", async () => {
		mockFileExists.mockResolvedValue(true)
		mockReadFile.mockResolvedValue("invalid json {")

		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		const result = await getCustomModelsForProvider("openrouter", mockCwd)

		expect(result).toEqual({})
		expect(consoleSpy).toHaveBeenCalled()

		consoleSpy.mockRestore()
	})

	it("should handle invalid schema gracefully", async () => {
		const invalidModels = {
			"custom/model-1": {
				// Missing required contextWindow
				maxTokens: 4096,
			},
		}

		mockFileExists.mockResolvedValue(true)
		mockReadFile.mockResolvedValue(JSON.stringify(invalidModels))

		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		const result = await getCustomModelsForProvider("openrouter", mockCwd)

		expect(result).toEqual({})
		expect(consoleSpy).toHaveBeenCalled()

		consoleSpy.mockRestore()
	})

	it("should work with different providers", async () => {
		const glamaModels = {
			"custom-glama": {
				contextWindow: 200000,
				maxTokens: 8192,
				supportsPromptCache: true,
				description: "Custom Glama",
			},
		}

		mockFileExists.mockImplementation(async (filePath: string) => {
			return filePath === path.join(mockGlobalDir, "models", "glama.json")
		})

		mockReadFile.mockImplementation(async (filePath: any) => {
			if (filePath === path.join(mockGlobalDir, "models", "glama.json")) {
				return JSON.stringify(glamaModels)
			}
			throw new Error("File not found")
		})

		const result = await getCustomModelsForProvider("glama", mockCwd)

		expect(result).toEqual(glamaModels)
	})

	it("should validate all ModelInfo fields", async () => {
		const completeModel = {
			"complete/model": {
				contextWindow: 32000,
				maxTokens: 4096,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 0.001,
				outputPrice: 0.002,
				cacheWritesPrice: 0.0005,
				cacheReadsPrice: 0.0001,
				description: "Complete model with all fields",
				supportsReasoningEffort: true,
				supportsReasoningBudget: true,
				requiredReasoningBudget: false,
				reasoningEffort: "high",
			},
		}

		mockFileExists.mockResolvedValue(true)
		mockReadFile.mockResolvedValue(JSON.stringify(completeModel))

		const result = await getCustomModelsForProvider("openrouter", mockCwd)

		expect(result).toEqual(completeModel)
	})

	it("should handle file read errors gracefully", async () => {
		mockFileExists.mockResolvedValue(true)
		mockReadFile.mockRejectedValue(new Error("Permission denied"))

		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		const result = await getCustomModelsForProvider("openrouter", mockCwd)

		expect(result).toEqual({})
		expect(consoleSpy).toHaveBeenCalled()

		consoleSpy.mockRestore()
	})
})
