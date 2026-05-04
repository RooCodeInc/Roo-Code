import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"

import { createZooMigrationHandoff, showZooMigrationNotice } from "../ZooMigration"

describe("createZooMigrationHandoff", () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-zoo-migration-"))
		vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
			get: vi.fn((key: string, defaultValue?: unknown) => {
				if (key === "customStoragePath") {
					return ""
				}
				return defaultValue
			}),
			inspect: vi.fn((key: string) => ({
				globalValue: key === "allowedCommands" ? ["git diff"] : undefined,
			})),
		} as any)
	})

	afterEach(async () => {
		vi.restoreAllMocks()
		await fs.rm(tmpDir, { recursive: true, force: true })
	})

	it("creates a copy-based handoff with settings and tasks but excludes cache data", async () => {
		const context = makeContext(tmpDir)
		await fs.mkdir(path.join(tmpDir, "settings"), { recursive: true })
		await fs.mkdir(path.join(tmpDir, "tasks", "task-1"), { recursive: true })
		await fs.mkdir(path.join(tmpDir, "cache"), { recursive: true })
		await fs.writeFile(path.join(tmpDir, "settings", "mcp_settings.json"), "{}")
		await fs.writeFile(path.join(tmpDir, "tasks", "task-1", "history_item.json"), "{}")
		await fs.writeFile(path.join(tmpDir, "cache", "openrouter_models.json"), "{}")

		const result = await createZooMigrationHandoff({
			context,
			contextProxy: { export: vi.fn().mockResolvedValue({ mode: "code" }) } as any,
			providerSettingsManager: { export: vi.fn().mockResolvedValue({ currentApiConfigName: "default" }) },
			includeSecrets: false,
		})

		const handoffJson = JSON.parse(await fs.readFile(result.handoffPath, "utf-8"))
		expect(handoffJson.containsSecrets).toBe(false)
		expect(handoffJson.providerProfiles).toBeUndefined()
		expect(handoffJson.globalSettings).toEqual({ mode: "code" })
		expect(handoffJson.copiedData).toEqual({
			settings: "data/settings",
			tasks: "data/tasks",
		})
		await expect(
			fs.readFile(path.join(tmpDir, "zoo-migration", "data", "settings", "mcp_settings.json"), "utf-8"),
		).resolves.toBe("{}")
		await expect(
			fs.readFile(path.join(tmpDir, "zoo-migration", "data", "tasks", "task-1", "history_item.json"), "utf-8"),
		).resolves.toBe("{}")
		await expect(
			fs.access(path.join(tmpDir, "zoo-migration", "data", "cache", "openrouter_models.json")),
		).rejects.toThrow()
	})

	it("exports provider profiles only when the user opts into secret migration", async () => {
		const context = makeContext(tmpDir)
		const providerProfiles = {
			currentApiConfigName: "default",
			apiConfigs: {
				default: {
					id: "profile-1",
					apiProvider: "openai",
					openAiApiKey: "secret-key",
				},
			},
		}

		const result = await createZooMigrationHandoff({
			context,
			contextProxy: { export: vi.fn().mockResolvedValue({}) } as any,
			providerSettingsManager: { export: vi.fn().mockResolvedValue(providerProfiles as any) },
			includeSecrets: true,
		})

		const handoffJson = JSON.parse(await fs.readFile(result.handoffPath, "utf-8"))
		expect(handoffJson.containsSecrets).toBe(true)
		expect(handoffJson.providerProfiles).toEqual(providerProfiles)
	})

	it("uses a configured custom storage path as the source data path", async () => {
		const customStoragePath = path.join(tmpDir, "custom-storage")
		const context = makeContext(path.join(tmpDir, "global-storage"))
		await fs.mkdir(path.join(customStoragePath, "settings"), { recursive: true })
		await fs.writeFile(path.join(customStoragePath, "settings", "custom_modes.yaml"), "customModes: []\n")

		vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
			get: vi.fn((key: string, defaultValue?: unknown) => {
				if (key === "customStoragePath") {
					return customStoragePath
				}
				return defaultValue
			}),
			inspect: vi.fn(),
		} as any)

		const result = await createZooMigrationHandoff({
			context,
			contextProxy: { export: vi.fn().mockResolvedValue({}) } as any,
			providerSettingsManager: { export: vi.fn().mockResolvedValue({ currentApiConfigName: "default" }) },
			includeSecrets: false,
		})

		expect(result.handoff.source.storageBasePath).toBe(customStoragePath)
		await expect(
			fs.readFile(
				path.join(tmpDir, "global-storage", "zoo-migration", "data", "settings", "custom_modes.yaml"),
				"utf-8",
			),
		).resolves.toBe("customModes: []\n")
	})
})

describe("showZooMigrationNotice", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("shows the migration notice on activation", async () => {
		const update = vi.fn().mockResolvedValue(undefined)
		const context = {
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update,
			},
		} as any
		const outputChannel = { appendLine: vi.fn() } as any
		const showInformationMessage = vi
			.spyOn(vscode.window, "showInformationMessage")
			.mockImplementation((async (_message: string, ...actions: unknown[]) => actions.at(-1)) as any)

		await showZooMigrationNotice(context, { outputChannel, delayMs: 0 })

		expect(showInformationMessage).toHaveBeenCalled()
		expect(update).not.toHaveBeenCalled()
		expect(outputChannel.appendLine).toHaveBeenCalledWith("[Zoo Migration] Showing migration notice for 3.53.1")
	})

	it("does not mark the notice shown when VS Code dismisses it without a user selection", async () => {
		const update = vi.fn().mockResolvedValue(undefined)
		const context = {
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update,
			},
		} as any
		vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined)

		await showZooMigrationNotice(context, { delayMs: 0 })

		expect(update).not.toHaveBeenCalled()
	})

	it("does not mark the notice shown when the user chooses Learn More", async () => {
		const update = vi.fn().mockResolvedValue(undefined)
		const context = {
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update,
			},
		} as any
		vi.spyOn(vscode.window, "showInformationMessage").mockImplementation((async (
			_message: string,
			...actions: unknown[]
		) => actions.at(2)) as any)
		const openExternal = vi.spyOn(vscode.env, "openExternal").mockResolvedValue(true)

		await showZooMigrationNotice(context, { delayMs: 0 })

		expect(openExternal).toHaveBeenCalled()
		expect(update).not.toHaveBeenCalled()
	})

	it("shows the notice even when older persistent state says it was already shown", async () => {
		const context = {
			globalState: {
				get: vi.fn().mockReturnValue(true),
				update: vi.fn(),
			},
		} as any
		const showInformationMessage = vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined)

		await showZooMigrationNotice(context, { delayMs: 0 })

		expect(showInformationMessage).toHaveBeenCalled()
		expect(context.globalState.update).not.toHaveBeenCalled()
	})
})

function makeContext(globalStoragePath: string): vscode.ExtensionContext {
	return {
		globalStorageUri: vscode.Uri.file(globalStoragePath),
		globalState: {
			get: vi.fn(),
			update: vi.fn().mockResolvedValue(undefined),
		},
	} as any
}
