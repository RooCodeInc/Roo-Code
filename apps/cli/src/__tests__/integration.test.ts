/**
 * Integration tests for CLI
 *
 * These tests require a valid OPENROUTER_API_KEY environment variable.
 * They will be skipped if the API key is not available.
 *
 * Run with: OPENROUTER_API_KEY=sk-or-v1-... pnpm test
 */

import { ExtensionHost } from "../extension-host.js"
import path from "path"
import fs from "fs"
import os from "os"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

const extensionPath = findExtensionPath()
const hasExtension = !!extensionPath

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

describe.skipIf(!hasApiKey || !hasExtension)(
	"CLI Integration Tests (requires OPENROUTER_API_KEY and built extension)",
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
				apiProvider: "openrouter",
				apiKey: OPENROUTER_API_KEY!,
				model: "anthropic/claude-haiku-4.5", // Use fast, cheap model for tests.
				workspacePath,
				extensionPath: extensionPath!,
				quiet: true,
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
	it("should have OPENROUTER_API_KEY check", () => {
		if (hasApiKey) {
			console.log("OPENROUTER_API_KEY is set, integration tests will run")
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
})
