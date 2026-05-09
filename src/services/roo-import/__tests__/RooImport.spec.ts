// pnpm --dir src exec vitest run services/roo-import/__tests__/RooImport.spec.ts

import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"

import { importRooHandoffFromPath, findDefaultHandoffPath, findUnimportedRooHandoff } from "../RooImport"

vi.mock("../../../i18n", () => ({
	t: (key: string, opts?: Record<string, unknown>) => {
		const suffix = opts ? ` ${JSON.stringify(opts)}` : ""
		return `${key}${suffix}`
	},
}))

vi.mock("../../../shared/package", () => ({
	Package: { name: "roo-cline", publisher: "ZooCodeOrganization", version: "3.53.0" },
}))

function makeHandoff(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		schemaVersion: 1,
		createdAt: "2026-05-09T00:00:00.000Z",
		source: {
			extensionId: "RooVeterinaryInc.roo-cline",
			publisher: "RooVeterinaryInc",
			name: "roo-cline",
			version: "3.53.1",
			globalStoragePath: "/tmp/roo-storage",
			storageBasePath: "/tmp/roo-storage",
		},
		zoo: {
			repositoryUrl: "https://github.com/Zoo-Code-Org/Zoo-Code",
			announcementUrl: "https://reddit.com/...",
			extensionId: "ZooCodeOrganization.zoo-code",
		},
		containsSecrets: false,
		globalSettings: { mode: "code" },
		vscodeConfiguration: {
			allowedCommands: { value: ["git diff"], globalValue: ["git diff"] },
			customStoragePath: { value: "", globalValue: undefined },
		},
		copiedData: {},
		...overrides,
	}
}

function makeContext(globalStoragePath: string): vscode.ExtensionContext {
	return {
		globalStorageUri: { fsPath: globalStoragePath } as vscode.Uri,
		globalState: {
			get: vi.fn().mockReturnValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
		},
	} as any
}

function makeOptions(context: vscode.ExtensionContext) {
	return {
		context,
		providerSettingsManager: {
			export: vi.fn().mockResolvedValue({
				currentApiConfigName: "default",
				apiConfigs: {},
				modeApiConfigs: {},
			}),
			import: vi.fn().mockResolvedValue(undefined),
			listConfig: vi.fn().mockResolvedValue([]),
		} as any,
		contextProxy: {
			setValues: vi.fn().mockResolvedValue(undefined),
			setValue: vi.fn().mockResolvedValue(undefined),
			setProviderSettings: vi.fn().mockResolvedValue(undefined),
		} as any,
		customModesManager: {
			updateCustomMode: vi.fn().mockResolvedValue(undefined),
		} as any,
	}
}

describe("importRooHandoffFromPath", () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "zoo-roo-import-"))
	})

	afterEach(async () => {
		vi.restoreAllMocks()
		await fs.rm(tmpDir, { recursive: true, force: true })
	})

	it("rejects an unsupported schema version", async () => {
		const handoffPath = path.join(tmpDir, "handoff-v1.json")
		await fs.writeFile(handoffPath, JSON.stringify(makeHandoff({ schemaVersion: 99 })))

		const result = await importRooHandoffFromPath(handoffPath, makeOptions(makeContext(tmpDir)))

		expect(result.success).toBe(false)
		expect(result.error).toMatch(/Unsupported handoff schema version 99/)
	})

	it("applies globalSettings via contextProxy", async () => {
		const handoffPath = path.join(tmpDir, "handoff-v1.json")
		await fs.writeFile(handoffPath, JSON.stringify(makeHandoff()))
		const context = makeContext(tmpDir)
		const options = makeOptions(context)

		const result = await importRooHandoffFromPath(handoffPath, options)

		expect(result.success).toBe(true)
		expect(options.contextProxy.setValues).toHaveBeenCalledWith({ mode: "code" })
	})

	it("copies new task directories and skips existing ones", async () => {
		const handoffDir = path.join(tmpDir, "zoo-migration")
		const tasksSource = path.join(handoffDir, "data", "tasks")
		const zooTasksDest = path.join(tmpDir, "tasks")

		await fs.mkdir(path.join(tasksSource, "task-new"), { recursive: true })
		await fs.writeFile(path.join(tasksSource, "task-new", "history_item.json"), '{"id":"task-new"}')
		await fs.mkdir(path.join(tasksSource, "task-existing"), { recursive: true })
		await fs.writeFile(path.join(tasksSource, "task-existing", "history_item.json"), '{"id":"roo"}')
		await fs.mkdir(path.join(zooTasksDest, "task-existing"), { recursive: true })
		await fs.writeFile(path.join(zooTasksDest, "task-existing", "history_item.json"), '{"id":"zoo"}')

		const handoff = makeHandoff({ copiedData: { tasks: "data/tasks" } })
		const handoffPath = path.join(handoffDir, "handoff-v1.json")
		await fs.mkdir(handoffDir, { recursive: true })
		await fs.writeFile(handoffPath, JSON.stringify(handoff))

		const result = await importRooHandoffFromPath(handoffPath, makeOptions(makeContext(tmpDir)))

		expect(result.success).toBe(true)
		expect(result.tasksCopied).toBe(1)

		const copiedTask = await fs.readFile(path.join(zooTasksDest, "task-new", "history_item.json"), "utf-8")
		expect(JSON.parse(copiedTask).id).toBe("task-new")

		const existingTask = await fs.readFile(path.join(zooTasksDest, "task-existing", "history_item.json"), "utf-8")
		expect(JSON.parse(existingTask).id).toBe("zoo")
	})

	it("skips the tasks index file", async () => {
		const handoffDir = path.join(tmpDir, "zoo-migration")
		const tasksSource = path.join(handoffDir, "data", "tasks")

		await fs.mkdir(tasksSource, { recursive: true })
		await fs.writeFile(path.join(tasksSource, "_index.json"), '{"version":1}')

		const handoff = makeHandoff({ copiedData: { tasks: "data/tasks" } })
		const handoffPath = path.join(handoffDir, "handoff-v1.json")
		await fs.mkdir(handoffDir, { recursive: true })
		await fs.writeFile(handoffPath, JSON.stringify(handoff))

		const result = await importRooHandoffFromPath(handoffPath, makeOptions(makeContext(tmpDir)))

		expect(result.success).toBe(true)
		expect(result.tasksCopied).toBe(0)
		const zooTasksDir = path.join(tmpDir, "tasks")
		await expect(fs.access(path.join(zooTasksDir, "_index.json"))).rejects.toThrow()
	})

	it("imports provider profiles and activates them in ContextProxy", async () => {
		const providerProfiles = {
			currentApiConfigName: "default",
			apiConfigs: {
				default: { id: "p1", apiProvider: "openai", openAiApiKey: "sk-secret" },
			},
			modeApiConfigs: {},
		}
		const handoff = makeHandoff({ containsSecrets: true, providerProfiles })
		const handoffPath = path.join(tmpDir, "handoff-v1.json")
		await fs.writeFile(handoffPath, JSON.stringify(handoff))

		const context = makeContext(tmpDir)
		const options = makeOptions(context)

		const result = await importRooHandoffFromPath(handoffPath, options)

		expect(result.success).toBe(true)
		expect(options.providerSettingsManager.import).toHaveBeenCalled()
		// Active provider must be reflected in ContextProxy immediately
		expect(options.contextProxy.setValue).toHaveBeenCalledWith("currentApiConfigName", "default")
		expect(options.contextProxy.setProviderSettings).toHaveBeenCalled()
		expect(options.contextProxy.setValue).toHaveBeenCalledWith("listApiConfigMeta", expect.anything())
	})

	it("persists imported custom modes through CustomModesManager", async () => {
		const customModes = [{ slug: "my-mode", name: "My Mode", roleDefinition: "A mode", groups: [] }]
		const handoff = makeHandoff({ globalSettings: { mode: "code", customModes } })
		const handoffPath = path.join(tmpDir, "handoff-v1.json")
		await fs.writeFile(handoffPath, JSON.stringify(handoff))

		const context = makeContext(tmpDir)
		const options = makeOptions(context)

		const result = await importRooHandoffFromPath(handoffPath, options)

		expect(result.success).toBe(true)
		expect(options.customModesManager.updateCustomMode).toHaveBeenCalledWith("my-mode", customModes[0])
	})

	it("skips provider profiles when containsSecrets is false", async () => {
		const handoffPath = path.join(tmpDir, "handoff-v1.json")
		await fs.writeFile(handoffPath, JSON.stringify(makeHandoff({ containsSecrets: false })))
		const options = makeOptions(makeContext(tmpDir))

		await importRooHandoffFromPath(handoffPath, options)

		expect(options.providerSettingsManager.import).not.toHaveBeenCalled()
	})

	it("applies VS Code config global values that Zoo does not already have set", async () => {
		const handoffPath = path.join(tmpDir, "handoff-v1.json")
		await fs.writeFile(handoffPath, JSON.stringify(makeHandoff()))
		const update = vi.fn().mockResolvedValue(undefined)
		vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
			get: vi.fn((key: string) => (key === "customStoragePath" ? "" : undefined)),
			inspect: vi.fn(() => ({ globalValue: undefined })),
			update,
		} as any)

		const result = await importRooHandoffFromPath(handoffPath, makeOptions(makeContext(tmpDir)))

		expect(result.success).toBe(true)
		expect(update).toHaveBeenCalledWith("allowedCommands", ["git diff"], vscode.ConfigurationTarget.Global)
		// customStoragePath must never be applied — it would redirect getStorageBasePath()
		// away from the directory where tasks/settings were already copied
		expect(update).not.toHaveBeenCalledWith("customStoragePath", expect.anything(), expect.anything())
	})

	it("never applies customStoragePath even when the handoff includes a global value for it", async () => {
		const handoff = makeHandoff({
			vscodeConfiguration: {
				customStoragePath: { value: "/roo/custom/path", globalValue: "/roo/custom/path" },
				allowedCommands: { value: [], globalValue: undefined },
			},
		})
		const handoffPath = path.join(tmpDir, "handoff-v1.json")
		await fs.writeFile(handoffPath, JSON.stringify(handoff))
		const update = vi.fn().mockResolvedValue(undefined)
		vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
			get: vi.fn(() => undefined),
			inspect: vi.fn(() => ({ globalValue: undefined })),
			update,
		} as any)

		const result = await importRooHandoffFromPath(handoffPath, makeOptions(makeContext(tmpDir)))

		expect(result.success).toBe(true)
		expect(update).not.toHaveBeenCalledWith("customStoragePath", expect.anything(), expect.anything())
	})

	it("records the handoff createdAt so the notice does not re-prompt", async () => {
		const handoffPath = path.join(tmpDir, "handoff-v1.json")
		await fs.writeFile(handoffPath, JSON.stringify(makeHandoff()))
		const context = makeContext(tmpDir)

		await importRooHandoffFromPath(handoffPath, makeOptions(context))

		expect(context.globalState.update).toHaveBeenCalledWith("rooHandoffImportedAt", "2026-05-09T00:00:00.000Z")
	})
})

describe("findDefaultHandoffPath", () => {
	it("resolves to the Roo sibling directory (lowercase, matching VS Code storage convention)", () => {
		const context = makeContext("/storage/ZooCodeOrganization.zoo-code")
		const result = findDefaultHandoffPath(context)
		expect(result).toBe(path.join("/storage", "rooveterinaryinc.roo-cline", "zoo-migration", "handoff-v1.json"))
	})
})

describe("findUnimportedRooHandoff", () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "zoo-handoff-detect-"))
	})

	afterEach(async () => {
		vi.restoreAllMocks()
		await fs.rm(tmpDir, { recursive: true, force: true })
	})

	it("returns undefined when no handoff file exists", async () => {
		const context = makeContext(path.join(tmpDir, "ZooCodeOrganization.zoo-code"))
		const result = await findUnimportedRooHandoff(context)
		expect(result).toBeUndefined()
	})

	it("returns the path when a new handoff is found", async () => {
		const rooDir = path.join(tmpDir, "rooveterinaryinc.roo-cline", "zoo-migration")
		await fs.mkdir(rooDir, { recursive: true })
		const handoffPath = path.join(rooDir, "handoff-v1.json")
		await fs.writeFile(handoffPath, JSON.stringify(makeHandoff()))

		const context = {
			globalStorageUri: { fsPath: path.join(tmpDir, "ZooCodeOrganization.zoo-code") } as vscode.Uri,
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn(),
			},
		} as any

		const result = await findUnimportedRooHandoff(context)
		expect(result).toBe(handoffPath)
	})

	it("returns undefined when the handoff was already imported", async () => {
		const rooDir = path.join(tmpDir, "rooveterinaryinc.roo-cline", "zoo-migration")
		await fs.mkdir(rooDir, { recursive: true })
		const handoffPath = path.join(rooDir, "handoff-v1.json")
		await fs.writeFile(handoffPath, JSON.stringify(makeHandoff()))

		const context = {
			globalStorageUri: { fsPath: path.join(tmpDir, "ZooCodeOrganization.zoo-code") } as vscode.Uri,
			globalState: {
				get: vi.fn().mockReturnValue("2026-05-09T00:00:00.000Z"),
				update: vi.fn(),
			},
		} as any

		const result = await findUnimportedRooHandoff(context)
		expect(result).toBeUndefined()
	})
})
