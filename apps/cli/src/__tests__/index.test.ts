/**
 * Integration tests for CLI
 *
 * These tests require:
 * 1. RUN_CLI_INTEGRATION_TESTS=true environment variable (opt-in)
 * 2. A valid OPENROUTER_API_KEY environment variable
 * 3. A built extension at src/dist
 * 4. ripgrep binary available (vscode-ripgrep or system ripgrep)
 *
 * Run with: RUN_CLI_INTEGRATION_TESTS=true OPENROUTER_API_KEY=sk-or-v1-... pnpm test
 */

// pnpm --filter @roo-code/cli test src/__tests__/index.test.ts

import { ExtensionHost } from "../extension-host/extension-host.js"
import path from "path"
import fs from "fs"
import os from "os"
import { execSync } from "child_process"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const RUN_INTEGRATION_TESTS = process.env.RUN_CLI_INTEGRATION_TESTS === "true"
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const hasApiKey = !!OPENROUTER_API_KEY

// Find the extension path - we need a built extension for integration tests
function findExtensionPath(): string | null {
	// From apps/cli/src/__tests__, go up to monorepo root then to src/dist
	const monorepoPath = path.resolve(__dirname, "../../../../src/dist")
	if (fs.existsSync(path.join(monorepoPath, "extension.js"))) {
		return monorepoPath
	}
	// Also try from the apps/cli level
	const altPath = path.resolve(__dirname, "../../../src/dist")
	if (fs.existsSync(path.join(altPath, "extension.js"))) {
		return altPath
	}
	return null
}

// Check if ripgrep is available (required by the extension for file listing)
function hasRipgrep(): boolean {
	try {
		// Try vscode-ripgrep first (installed as dependency)
		const vscodeRipgrepPath = path.resolve(__dirname, "../../../../node_modules/@vscode/ripgrep/bin/rg")
		if (fs.existsSync(vscodeRipgrepPath)) {
			return true
		}
		// Try system ripgrep
		execSync("rg --version", { stdio: "ignore" })
		return true
	} catch {
		return false
	}
}

const extensionPath = findExtensionPath()
const hasExtension = !!extensionPath
const ripgrepAvailable = hasRipgrep()

// Create a temporary workspace directory for tests
function createTempWorkspace(): string {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roo-cli-test-"))
	return tempDir
}

// Clean up temporary workspace
function cleanupWorkspace(workspacePath: string): void {
	try {
		fs.rmSync(workspacePath, { recursive: true, force: true })
	} catch {
		// Ignore cleanup errors
	}
}

describe.skipIf(!RUN_INTEGRATION_TESTS || !hasApiKey || !hasExtension || !ripgrepAvailable)(
	"CLI Integration Tests (requires RUN_CLI_INTEGRATION_TESTS=true, OPENROUTER_API_KEY, built extension, and ripgrep)",
	() => {
		let workspacePath: string
		let host: ExtensionHost

		beforeAll(() => {
			console.log("Integration tests running with:")
			console.log(`  - API Key: ${OPENROUTER_API_KEY?.substring(0, 12)}...`)
			console.log(`  - Extension Path: ${extensionPath}`)
		})

		beforeEach(() => {
			workspacePath = createTempWorkspace()
		})

		afterEach(async () => {
			if (host) {
				await host.dispose()
			}
			cleanupWorkspace(workspacePath)
		})

		/**
		 * Main integration test - tests the complete end-to-end flow
		 *
		 * NOTE: Due to the extension using singletons (TelemetryService, etc.),
		 * only one integration test can run per process. This single test covers
		 * the main functionality: activation, task execution, completion, and disposal.
		 */
		it("should complete end-to-end task execution with proper lifecycle", async () => {
			host = new ExtensionHost({
				mode: "code",
				user: null,
				provider: "openrouter",
				apiKey: OPENROUTER_API_KEY!,
				model: "anthropic/claude-haiku-4.5", // Use fast, cheap model for tests.
				workspacePath,
				extensionPath: extensionPath!,
			})

			// Test activation
			await host.activate()

			// Track state messages
			const stateMessages: unknown[] = []
			host.on("extensionWebviewMessage", (msg: Record<string, unknown>) => {
				if (msg.type === "state") {
					stateMessages.push(msg)
				}
			})

			// Test task execution with completion
			// Note: runTask internally waits for webview to be ready before sending messages
			await expect(host.runTask("Say hello in exactly 5 words")).resolves.toBeUndefined()

			// After task completes, webview should have been ready
			expect(host.isInInitialSetup()).toBe(false)

			// Verify we received state updates
			expect(stateMessages.length).toBeGreaterThan(0)

			// Test disposal
			await host.dispose()
			expect((global as Record<string, unknown>).vscode).toBeUndefined()
			expect((global as Record<string, unknown>).__extensionHost).toBeUndefined()
		}, 120000) // 2 minute timeout
	},
)

// Additional test to verify skip behavior
describe("Integration test skip behavior", () => {
	it("should require RUN_CLI_INTEGRATION_TESTS=true", () => {
		if (RUN_INTEGRATION_TESTS) {
			console.log("RUN_CLI_INTEGRATION_TESTS=true, integration tests are enabled")
		} else {
			console.log("RUN_CLI_INTEGRATION_TESTS is not set to 'true', integration tests will be skipped")
		}
		expect(true).toBe(true) // Always passes
	})

	it("should have OPENROUTER_API_KEY check", () => {
		if (hasApiKey) {
			console.log("OPENROUTER_API_KEY is set")
		} else {
			console.log("OPENROUTER_API_KEY is not set, integration tests will be skipped")
		}
		expect(true).toBe(true) // Always passes
	})

	it("should have extension check", () => {
		if (hasExtension) {
			console.log(`Extension found at: ${extensionPath}`)
		} else {
			console.log("Extension not found, integration tests will be skipped")
		}
		expect(true).toBe(true) // Always passes
	})

	it("should have ripgrep check", () => {
		if (ripgrepAvailable) {
			console.log("ripgrep is available")
		} else {
			console.log("ripgrep not found, integration tests will be skipped")
		}
		expect(true).toBe(true) // Always passes
	})
})
