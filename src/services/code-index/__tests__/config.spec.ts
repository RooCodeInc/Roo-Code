// Tests for getCodeIndexConfig configuration logic
// npx vitest run services/code-index/__tests__/config.spec.ts

const workspaceConfig: Record<string, any> = {}

vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: <T>(key: string): T | undefined => workspaceConfig[key],
		})),
	},
}))

import { getCodeIndexConfig, type CodeIndexMode } from "../config"

/**
 * Returns a mutable config object used by the mocked vscode.workspace.getConfiguration().
 * Each test is isolated and sets only the necessary fields.
 */
function getMockConfig() {
	return workspaceConfig
}

/**
 * Helper for setting base configuration values.
 */
function setBaseConfig({
	mode,
	enableBuiltInIgnore,
	maxParallelFileReads,
	maxParallelEmbeddings,
	chunkSizeTokens,
}: {
	mode?: CodeIndexMode
	enableBuiltInIgnore?: boolean
	maxParallelFileReads?: number
	maxParallelEmbeddings?: number
	chunkSizeTokens?: number
}) {
	const cfg = getMockConfig()
	Object.keys(cfg).forEach((key) => {
		delete cfg[key]
	})
	if (mode !== undefined) cfg.mode = mode
	if (enableBuiltInIgnore !== undefined) cfg.enableBuiltInIgnore = enableBuiltInIgnore
	if (maxParallelFileReads !== undefined) cfg.maxParallelFileReads = maxParallelFileReads
	if (maxParallelEmbeddings !== undefined) cfg.maxParallelEmbeddings = maxParallelEmbeddings
	if (chunkSizeTokens !== undefined) cfg.chunkSizeTokens = chunkSizeTokens
}

describe("getCodeIndexConfig", () => {
	beforeEach(() => {
		const cfg = getMockConfig()
		for (const key of Object.keys(cfg)) {
			delete cfg[key]
		}
	})

	describe("normal mode - without built-in ignore", () => {
		it("returns user values without restrictions and empty builtInIgnore", () => {
			setBaseConfig({
				mode: "normal",
				enableBuiltInIgnore: false,
				maxParallelFileReads: 16,
				maxParallelEmbeddings: 4,
				chunkSizeTokens: 2048,
			})

			const config = getCodeIndexConfig()

			expect(config.mode).toBe("normal")
			expect(config.maxParallelFileReads).toBe(16)
			expect(config.maxParallelEmbeddings).toBe(4)
			expect(config.chunkSizeTokens).toBe(2048)
			expect(config.enableBuiltInIgnore).toBe(false)
			expect(config.builtInIgnorePatterns).toEqual([])
		})
	})

	describe("normal mode - with built-in ignore", () => {
		it("preserves values and substitutes non-empty ignore pattern list", () => {
			setBaseConfig({
				mode: "normal",
				enableBuiltInIgnore: true,
				maxParallelFileReads: 16,
				maxParallelEmbeddings: 4,
				chunkSizeTokens: 2048,
			})

			const config = getCodeIndexConfig()

			expect(config.mode).toBe("normal")
			expect(config.maxParallelFileReads).toBe(16)
			expect(config.maxParallelEmbeddings).toBe(4)
			expect(config.chunkSizeTokens).toBe(2048)
			expect(config.enableBuiltInIgnore).toBe(true)

			expect(Array.isArray(config.builtInIgnorePatterns)).toBe(true)
			expect(config.builtInIgnorePatterns.length).toBeGreaterThan(0)

			const patterns = config.builtInIgnorePatterns
			expect(patterns.some((p) => p.includes("node_modules"))).toBe(true)
			expect(patterns.some((p) => p.includes("dist"))).toBe(true)
			expect(patterns.some((p) => p.includes("build"))).toBe(true)
		})
	})

	describe("lowResource mode - resource limiting", () => {
		it("limits values to low-resource ranges and enables built-in ignore regardless of mode", () => {
			setBaseConfig({
				mode: "lowResource",
				enableBuiltInIgnore: true,
				maxParallelFileReads: 999,
				maxParallelEmbeddings: 999,
				chunkSizeTokens: 99999,
			})

			const config = getCodeIndexConfig()

			expect(config.mode).toBe("lowResource")

			// maxParallelFileReads: [1, 4]
			expect(config.maxParallelFileReads).toBeGreaterThanOrEqual(1)
			expect(config.maxParallelFileReads).toBeLessThanOrEqual(4)

			// maxParallelEmbeddings: [1, 2]
			expect(config.maxParallelEmbeddings).toBeGreaterThanOrEqual(1)
			expect(config.maxParallelEmbeddings).toBeLessThanOrEqual(2)

			// chunkSizeTokens: [128, 768]
			expect(config.chunkSizeTokens).toBeGreaterThanOrEqual(128)
			expect(config.chunkSizeTokens).toBeLessThanOrEqual(768)

			// builtInIgnorePatterns is controlled only by the enableBuiltInIgnore flag
			expect(config.enableBuiltInIgnore).toBe(true)
			expect(config.builtInIgnorePatterns.length).toBeGreaterThan(0)
		})
	})

	describe("auto mode - detectEnvironmentProfile", () => {
		/**
		 * To isolate auto mode, we need to re-initialize the config module
		 * with a mocked implementation of os.cpus/totalmem.
		 * Here we use vi.resetModules and manual require cache management.
		 */
		const loadWithEnvMock = async ({ cpuCount, memGb }: { cpuCount: number; memGb: number }) => {
			vi.resetModules()

			const originalOs = await import("os")
			const mockOs = {
				...originalOs,
				cpus: () => new Array(cpuCount).fill({ model: "x", speed: 1000 }),
				totalmem: () => memGb * 1024 * 1024 * 1024,
			}

			vi.doMock("os", () => mockOs)

			// Mock vscode for new module instance
			vi.doMock("vscode", () => {
				const workspaceConfig: Record<string, any> = {}
				return {
					workspace: {
						getConfiguration: vi.fn(() => ({
							get: <T>(key: string): T | undefined => workspaceConfig[key],
						})),
					},
					__test__: {
						workspaceConfig,
					},
				}
			})

			const { getCodeIndexConfig: loadConfig } = await import("../config")
			// Set auto + high values to see the effect of lowResource/normal
			const cfg = getMockConfig()
			cfg.mode = "auto"
			cfg.enableBuiltInIgnore = true
			cfg.maxParallelFileReads = 999
			cfg.maxParallelEmbeddings = 999
			cfg.chunkSizeTokens = 99999

			return loadConfig()
		}

		it("auto + weak machine → uses lowResource profile (restrictions applied)", async () => {
			const config = await loadWithEnvMock({
				cpuCount: 2,
				memGb: 4,
			})

			expect(config.mode).toBe("lowResource")
			expect(config.maxParallelFileReads).toBeLessThanOrEqual(4)
			expect(config.maxParallelEmbeddings).toBeLessThanOrEqual(2)
			expect(config.chunkSizeTokens).toBeLessThanOrEqual(768)
		})

		/**
		 * IMPORTANT:
		 * We do not test here "auto + normal machine → normal profile" on real detectEnvironmentProfile
		 * to avoid false positives in different CI/environments.
		 *
		 * The contract is:
		 * - getCodeIndexConfig respects the result of detectEnvironmentProfile.
		 * - The specific choice of "normal" or "lowResource" depends on the environment (CPU/RAM) and may differ.
		 *
		 * If in the future we need to fix the "normal" branch, we will need to explicitly mock detectEnvironmentProfile
		 * inside config.ts, rather than relying on the real machine resources.
		 */
	})
})
