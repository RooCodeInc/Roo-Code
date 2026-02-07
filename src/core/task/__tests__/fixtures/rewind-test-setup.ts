/**
 * Shared test fixtures for the rewind test suites.
 *
 * NOTE: Every test file that uses these helpers MUST declare its own
 * `vi.mock()` blocks — vitest hoists mocks to the top of the *test* file,
 * so they cannot be extracted into a shared module.
 */
import * as os from "os"
import * as path from "path"

import * as vscode from "vscode"

import type { ProviderSettings } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../../Task"
import { ClineProvider } from "../../../webview/ClineProvider"
import { ContextProxy } from "../../../config/ContextProxy"

/** Default API configuration used across rewind tests. */
export const DEFAULT_API_CONFIG: ProviderSettings = {
	apiProvider: "anthropic",
	apiModelId: "claude-3-5-sonnet-20241022",
	apiKey: "test-api-key",
}

/** Ensure the TelemetryService singleton is initialised (idempotent). */
export function initializeTelemetry(): void {
	if (!TelemetryService.hasInstance()) {
		TelemetryService.createInstance([])
	}
}

/** Build a minimal mock `vscode.ExtensionContext`. */
export function createMockExtensionContext(): vscode.ExtensionContext {
	const storageUri = { fsPath: path.join(os.tmpdir(), "test-storage") }

	return {
		globalState: {
			get: vi.fn().mockReturnValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
			keys: vi.fn().mockReturnValue([]),
		},
		globalStorageUri: storageUri,
		workspaceState: {
			get: vi.fn().mockReturnValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
			keys: vi.fn().mockReturnValue([]),
		},
		secrets: {
			get: vi.fn().mockResolvedValue(undefined),
			store: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
		},
		extensionUri: { fsPath: "/mock/extension/path" },
		extension: { packageJSON: { version: "1.0.0" } },
	} as unknown as vscode.ExtensionContext
}

/** Build a mock `OutputChannel`. */
export function createMockOutputChannel() {
	return {
		name: "test",
		appendLine: vi.fn(),
		append: vi.fn(),
		replace: vi.fn(),
		clear: vi.fn(),
		show: vi.fn(),
		hide: vi.fn(),
		dispose: vi.fn(),
	}
}

/** Build a `ClineProvider` backed by mocks. */
export function createMockProvider(context: vscode.ExtensionContext): any {
	return new ClineProvider(context, createMockOutputChannel(), "sidebar", new ContextProxy(context)) as any
}

/**
 * Create a `Task` that does NOT auto-start its loop.
 * Pass an explicit `apiConfig` or fall back to {@link DEFAULT_API_CONFIG}.
 */
export function createTask(provider: any, apiConfig: ProviderSettings = DEFAULT_API_CONFIG): Task {
	return new Task({
		provider,
		apiConfiguration: apiConfig,
		task: "test task",
		startTask: false,
	})
}
