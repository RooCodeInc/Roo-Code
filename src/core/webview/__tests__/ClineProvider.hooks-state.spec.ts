// npx vitest run core/webview/__tests__/ClineProvider.hooks-state.spec.ts

import type { IHookManager, HooksConfigSnapshot, HookEventType, ResolvedHook } from "../../../services/hooks/types"

import { ClineProvider } from "../ClineProvider"

vi.mock("fs/promises", () => ({
	default: {
		mkdir: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue(""),
		writeFile: vi.fn().mockResolvedValue(undefined),
		access: vi.fn().mockResolvedValue(undefined),
		readdir: vi.fn().mockResolvedValue([]),
		rm: vi.fn().mockResolvedValue(undefined),
	},
	mkdir: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	writeFile: vi.fn().mockResolvedValue(undefined),
	access: vi.fn().mockResolvedValue(undefined),
	readdir: vi.fn().mockResolvedValue([]),
	rm: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("os", () => ({
	default: {
		homedir: vi.fn().mockReturnValue("/mock/home"),
		tmpdir: vi.fn().mockReturnValue("/mock/tmp"),
	},
	homedir: vi.fn().mockReturnValue("/mock/home"),
	tmpdir: vi.fn().mockReturnValue("/mock/tmp"),
}))

vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn(),
			update: vi.fn(),
		}),
	},
	window: {
		createTextEditorDecorationType: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		showTextDocument: vi.fn().mockResolvedValue(undefined),
		createWebviewPanel: vi.fn(),
	},
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		appName: "Visual Studio Code",
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			setProvider: vi.fn(),
			captureCodeActionUsed: vi.fn(),
			captureModeSwitch: vi.fn(),
			captureTelemetrySettingsChanged: vi.fn(),
			updateTelemetryState: vi.fn(),
		},
		hasInstance: vi.fn().mockReturnValue(true),
		createInstance: vi.fn(),
	},
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(false),
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))

vi.mock("../../../integrations/workspace/WorkspaceTracker", () => ({
	default: vi.fn().mockImplementation(() => ({
		initializeFilePaths: vi.fn(),
		dispose: vi.fn(),
	})),
}))

vi.mock("../../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: vi.fn().mockResolvedValue({
			registerClient: vi.fn(),
			unregisterClient: vi.fn(),
		}),
		unregisterProvider: vi.fn(),
	},
}))

vi.mock("../../../services/skills/SkillsManager", () => ({
	SkillsManager: vi.fn().mockImplementation(() => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn().mockResolvedValue(undefined),
	})),
}))

vi.mock("../../../services/hooks", () => ({
	createHookManager: vi.fn().mockImplementation(() => null),
	HookManager: vi.fn(),
}))

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/mock/workspace"),
}))

vi.mock("../../config/ProviderSettingsManager", () => ({
	ProviderSettingsManager: vi.fn().mockImplementation(() => ({
		listConfig: vi.fn().mockResolvedValue([]),
		getModeConfigId: vi.fn().mockResolvedValue(undefined),
		activateProfile: vi.fn().mockResolvedValue({ name: "default", apiProvider: "openrouter" }),
		getProfile: vi.fn().mockResolvedValue({ apiProvider: "openrouter" }),
		setModeConfig: vi.fn().mockResolvedValue(undefined),
		saveConfig: vi.fn().mockResolvedValue("id"),
	})),
}))

vi.mock("../../config/CustomModesManager", () => ({
	CustomModesManager: vi.fn().mockImplementation(() => ({
		getCustomModes: vi.fn().mockResolvedValue([]),
		dispose: vi.fn(),
	})),
}))

vi.mock("../../../services/marketplace", () => ({
	MarketplaceManager: vi.fn().mockImplementation(() => ({
		cleanup: vi.fn(),
		getMarketplaceItems: vi.fn().mockResolvedValue({ organizationMcps: [], marketplaceItems: [], errors: [] }),
		getInstallationMetadata: vi.fn().mockResolvedValue({ project: {}, global: {} }),
	})),
}))

vi.mock("../../../activate/registerCommands", () => ({
	setPanel: vi.fn(),
}))

vi.mock("../../../shared/package", () => ({
	Package: { name: "roo-code" },
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn().mockImplementation((key: string) => key),
}))

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

vi.mock("../../../utils/tts", () => ({
	setTtsEnabled: vi.fn(),
	setTtsSpeed: vi.fn(),
}))

vi.mock("../../../utils/git", () => ({
	getWorkspaceGitInfo: vi.fn().mockResolvedValue(undefined),
}))

describe("ClineProvider.getHooksStateForWebview", () => {
	it("returns a single HookInfo per id and includes aggregated events", () => {
		const mkHook = (id: string, events: HookEventType[], event: HookEventType): ResolvedHook =>
			({
				id,
				event,
				events,
				filePath: "/mock/hooks.yaml",
				source: "project",
				command: "echo hi",
				enabled: true,
				timeout: 60,
			}) as ResolvedHook

		const hookA = mkHook("hook-a", ["PreToolUse", "PostToolUse"], "PreToolUse")

		// hooksByEvent duplicates the same ID across events (runtime model)
		const snapshot: HooksConfigSnapshot = {
			hooksByEvent: new Map<HookEventType, ResolvedHook[]>([
				["PreToolUse", [hookA]],
				["PostToolUse", [hookA]],
			]),
			hooksById: new Map<string, ResolvedHook>([[hookA.id, hookA]]),
			loadedAt: new Date("2026-01-01T00:00:00.000Z"),
			disabledHookIds: new Set<string>(),
			hasProjectHooks: true,
		}

		const mockHookManager: IHookManager = {
			loadHooksConfig: vi.fn().mockResolvedValue(snapshot),
			reloadHooksConfig: vi.fn().mockResolvedValue(undefined),
			executeHooks: vi.fn() as any,
			getEnabledHooks: vi.fn().mockReturnValue([]),
			setHookEnabled: vi.fn().mockResolvedValue(undefined),
			updateHook: vi.fn().mockResolvedValue(undefined),
			getHookExecutionHistory: vi.fn().mockReturnValue([]),
			getConfigSnapshot: vi.fn().mockReturnValue(snapshot),
		}

		const mockContext: any = {
			extensionUri: {},
			extension: { packageJSON: { version: "0.0.0" } },
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
				delete: vi.fn(),
			},
			globalStorageUri: { fsPath: "/mock/storage" },
		}

		const provider = new ClineProvider(mockContext, { appendLine: vi.fn() } as any, "sidebar", {
			getValues: vi.fn().mockReturnValue({}),
			getValue: vi.fn().mockReturnValue(undefined),
			setValue: vi.fn().mockResolvedValue(undefined),
			setValues: vi.fn().mockResolvedValue(undefined),
			getProviderSettings: vi.fn().mockReturnValue({}),
			setProviderSettings: vi.fn().mockResolvedValue(undefined),
			extensionMode: 3,
			extensionUri: {},
			globalStorageUri: { fsPath: "/mock/storage" },
		} as any)

		;(provider as any).hookManager = mockHookManager

		const hooksState = (provider as any).getHooksStateForWebview()
		expect(hooksState).toBeDefined()
		expect(hooksState.enabledHooks).toHaveLength(1)
		expect(hooksState.enabledHooks[0].id).toBe("hook-a")
		expect(hooksState.enabledHooks[0].event).toBe("PreToolUse")
		expect(hooksState.enabledHooks[0].events).toEqual(["PreToolUse", "PostToolUse"])
	})
})
