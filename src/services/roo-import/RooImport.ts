import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import type { GlobalSettings } from "@roo-code/types"

import { ContextProxy } from "../../core/config/ContextProxy"
import { CustomModesManager } from "../../core/config/CustomModesManager"
import { ProviderSettingsManager, providerProfilesSchema } from "../../core/config/ProviderSettingsManager"
import type { ProviderProfiles } from "../../core/config/ProviderSettingsManager"
import { fileExistsAtPath } from "../../utils/fs"
import { getStorageBasePath } from "../../utils/storage"
import { Package } from "../../shared/package"
import { t } from "../../i18n"

const SUPPORTED_SCHEMA_VERSION = 1
const ROO_EXTENSION_ID = "RooVeterinaryInc.roo-cline".toLowerCase()
const HANDOFF_DIR = "zoo-migration"
const HANDOFF_FILE = "handoff-v1.json"
const TASKS_INDEX_FILE = "_index.json"

type ConfigurationValue = {
	value: unknown
	globalValue?: unknown
	workspaceValue?: unknown
	workspaceFolderValue?: unknown
}

type ZooMigrationHandoff = {
	schemaVersion: number
	createdAt: string
	source: {
		extensionId: string
		publisher: string
		name: string
		version: string
		globalStoragePath: string
		storageBasePath: string
	}
	zoo: {
		repositoryUrl: string
		announcementUrl: string
		extensionId: string
	}
	containsSecrets: boolean
	globalSettings?: GlobalSettings
	vscodeConfiguration: Record<string, ConfigurationValue>
	providerProfiles?: unknown
	copiedData: {
		settings?: string
		tasks?: string
	}
}

export type ImportRooHandoffOptions = {
	context: vscode.ExtensionContext
	providerSettingsManager: ProviderSettingsManager
	contextProxy: ContextProxy
	customModesManager: CustomModesManager
	outputChannel?: vscode.OutputChannel
}

export type ImportRooHandoffResult = {
	success: boolean
	error?: string
	warnings?: string[]
	tasksCopied?: number
}

/**
 * Returns the expected handoff file path based on Roo's standard extension storage location,
 * which sits in the same parent directory as Zoo's global storage.
 */
export function findDefaultHandoffPath(context: vscode.ExtensionContext): string {
	const parentDir = path.dirname(context.globalStorageUri.fsPath)
	return path.join(parentDir, ROO_EXTENSION_ID, HANDOFF_DIR, HANDOFF_FILE)
}

/**
 * Checks whether a Roo handoff exists that has not been imported yet.
 * Returns the handoff path if found and new, otherwise undefined.
 */
export async function findUnimportedRooHandoff(context: vscode.ExtensionContext): Promise<string | undefined> {
	const handoffPath = findDefaultHandoffPath(context)
	if (!(await fileExistsAtPath(handoffPath))) {
		return undefined
	}

	try {
		const raw: ZooMigrationHandoff = JSON.parse(await fs.readFile(handoffPath, "utf-8"))
		const lastImported = context.globalState.get<string>("rooHandoffImportedAt")
		if (lastImported === raw.createdAt) {
			return undefined
		}
		return handoffPath
	} catch {
		return undefined
	}
}

/**
 * Shows a notification when a new Roo handoff is detected on activation.
 * The user can import immediately or dismiss (they can always run the command later).
 */
export async function showRooHandoffNotice(
	context: vscode.ExtensionContext,
	options: ImportRooHandoffOptions,
): Promise<void> {
	const handoffPath = await findUnimportedRooHandoff(context)
	if (!handoffPath) {
		return
	}

	const importNow = t("common:rooImport.actions.importNow")
	const later = t("common:rooImport.actions.later")

	const result = await vscode.window.showInformationMessage(t("common:rooImport.notice"), importNow, later)

	if (result === importNow) {
		await runImport(handoffPath, options)
	}
}

/**
 * Shows a file picker pre-seeded to Roo's expected handoff location, then imports.
 */
export async function promptAndImportRooHandoff(
	options: ImportRooHandoffOptions,
): Promise<ImportRooHandoffResult | undefined> {
	const defaultPath = findDefaultHandoffPath(options.context)
	options.outputChannel?.appendLine(`[Roo Import] Looking for handoff at: ${defaultPath}`)

	// If the handoff already exists at the expected location, import directly.
	if (await fileExistsAtPath(defaultPath)) {
		return runImport(defaultPath, options)
	}

	const uris = await vscode.window.showOpenDialog({
		filters: { JSON: ["json"] },
		canSelectMany: false,
		title: t("common:rooImport.pickHandoffFile"),
	})

	if (!uris || uris.length === 0) {
		return undefined
	}

	return runImport(uris[0].fsPath, options)
}

async function runImport(handoffPath: string, options: ImportRooHandoffOptions): Promise<ImportRooHandoffResult> {
	const result = await importRooHandoffFromPath(handoffPath, options)

	if (result.success) {
		const taskCount = result.tasksCopied ?? 0
		let message = t("common:rooImport.importSuccess", { tasks: taskCount })
		if (result.warnings && result.warnings.length > 0) {
			message += ` (${result.warnings.length} warning${result.warnings.length > 1 ? "s" : ""})`
		}
		await vscode.window.showInformationMessage(message)
	} else {
		await vscode.window.showErrorMessage(t("common:rooImport.importFailed", { error: result.error ?? "" }))
	}

	return result
}

export async function importRooHandoffFromPath(
	handoffPath: string,
	{ context, providerSettingsManager, contextProxy, customModesManager, outputChannel }: ImportRooHandoffOptions,
): Promise<ImportRooHandoffResult> {
	const log = (msg: string) => outputChannel?.appendLine(`[Roo Import] ${msg}`)
	const warnings: string[] = []

	try {
		const raw: ZooMigrationHandoff = JSON.parse(await fs.readFile(handoffPath, "utf-8"))

		if (raw.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
			return {
				success: false,
				error: `Unsupported handoff schema version ${raw.schemaVersion} (expected ${SUPPORTED_SCHEMA_VERSION})`,
			}
		}

		log(`Importing Roo handoff from ${handoffPath} (created ${raw.createdAt})`)

		const handoffDir = path.dirname(handoffPath)
		const zooBasePath = await getStorageBasePath(context.globalStorageUri.fsPath)
		let tasksCopied = 0

		// 1. Copy task history — merge only, never overwrite existing Zoo tasks
		if (raw.copiedData.tasks) {
			const tasksSource = path.join(handoffDir, raw.copiedData.tasks)
			const tasksDest = path.join(zooBasePath, "tasks")
			tasksCopied = await mergeTasksDirectory(tasksSource, tasksDest, log)
			log(`Copied ${tasksCopied} task(s) from Roo`)
		}

		// 2. Copy settings files — merge only, never overwrite Zoo's existing files
		if (raw.copiedData.settings) {
			const settingsSource = path.join(handoffDir, raw.copiedData.settings)
			const settingsDest = path.join(zooBasePath, "settings")
			const copiedSettings = await mergeSettingsDirectory(settingsSource, settingsDest, log)
			log(`Copied ${copiedSettings} settings file(s) from Roo`)
		}

		// 3. Apply globalSettings and persist custom modes through the manager so
		//    they survive a CustomModesManager rebuild/reload cycle.
		if (raw.globalSettings) {
			try {
				// Persist each imported custom mode so the manager's settings files
				// stay in sync with global state (mirrors importSettingsFromPath).
				await Promise.all(
					(raw.globalSettings.customModes ?? []).map((mode) =>
						customModesManager.updateCustomMode(mode.slug, mode),
					),
				)
				await contextProxy.setValues(raw.globalSettings)
				log("Applied globalSettings")
			} catch (err) {
				const msg = `Could not apply globalSettings: ${err instanceof Error ? err.message : String(err)}`
				warnings.push(msg)
				log(msg)
			}
		}

		// 4. Import provider profiles — only when the user opted into secret migration.
		//    After storing profiles, activate the imported provider in ContextProxy so
		//    getState() reflects the new provider immediately (mirrors importSettingsFromPath).
		if (raw.containsSecrets && raw.providerProfiles) {
			try {
				const parsed = providerProfilesSchema.safeParse(raw.providerProfiles)
				if (parsed.success) {
					const existing = await providerSettingsManager.export()
					const merged: ProviderProfiles = {
						currentApiConfigName: parsed.data.currentApiConfigName || existing.currentApiConfigName,
						apiConfigs: { ...existing.apiConfigs, ...parsed.data.apiConfigs },
						modeApiConfigs: { ...existing.modeApiConfigs, ...parsed.data.modeApiConfigs },
					}
					await providerSettingsManager.import(merged)

					const currentProviderName = merged.currentApiConfigName
					const currentProvider = merged.apiConfigs[currentProviderName]
					contextProxy.setValue("currentApiConfigName", currentProviderName)
					if (currentProvider) {
						await contextProxy.setProviderSettings(currentProvider)
					}
					contextProxy.setValue("listApiConfigMeta", await providerSettingsManager.listConfig())

					log("Imported provider profiles")
				} else {
					const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")
					const msg = `Provider profiles validation failed: ${issues}`
					warnings.push(msg)
					log(msg)
				}
			} catch (err) {
				const msg = `Could not import provider profiles: ${err instanceof Error ? err.message : String(err)}`
				warnings.push(msg)
				log(msg)
			}
		}

		// 5. Apply VS Code configuration — only set keys Zoo doesn't already have a global value for.
		//    customStoragePath is intentionally excluded: tasks/settings were already copied into
		//    zooBasePath resolved with the pre-import path. Applying Roo's custom path afterward
		//    would make getStorageBasePath() point elsewhere and make the copied data invisible.
		//    It also often points at Roo's own storage directory, which is wrong for Zoo.
		const SKIP_CONFIG_KEYS = new Set(["customStoragePath"])
		const config = vscode.workspace.getConfiguration(Package.name)
		for (const [key, val] of Object.entries(raw.vscodeConfiguration)) {
			if (SKIP_CONFIG_KEYS.has(key)) {
				continue
			}
			if (val.globalValue === undefined) {
				continue
			}
			const current = config.inspect(key)
			if (current?.globalValue !== undefined) {
				continue
			}
			try {
				await config.update(key, val.globalValue, vscode.ConfigurationTarget.Global)
			} catch (err) {
				warnings.push(`Could not apply config ${key}: ${err instanceof Error ? err.message : String(err)}`)
			}
		}
		log("Applied VS Code configuration")

		// Record that this handoff has been imported so the activation notice won't re-prompt
		await context.globalState.update("rooHandoffImportedAt", raw.createdAt)

		return {
			success: true,
			warnings: warnings.length > 0 ? warnings : undefined,
			tasksCopied,
		}
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err)
		log(`Import failed: ${error}`)
		return { success: false, error }
	}
}

async function mergeTasksDirectory(sourceDir: string, destDir: string, log: (msg: string) => void): Promise<number> {
	if (!(await fileExistsAtPath(sourceDir))) {
		log(`Tasks source not found at ${sourceDir}; skipping`)
		return 0
	}

	await fs.mkdir(destDir, { recursive: true })
	let copied = 0

	const entries = await fs.readdir(sourceDir, { withFileTypes: true })
	for (const entry of entries) {
		// Skip the index — Zoo's TaskHistoryStore rebuilds it from individual task files
		if (entry.name === TASKS_INDEX_FILE) {
			continue
		}
		if (!entry.isDirectory()) {
			continue
		}

		const taskDest = path.join(destDir, entry.name)
		// Skip tasks that already exist in Zoo's storage
		if (await fileExistsAtPath(taskDest)) {
			continue
		}

		await fs.cp(path.join(sourceDir, entry.name), taskDest, { recursive: true })
		copied++
	}

	return copied
}

async function mergeSettingsDirectory(sourceDir: string, destDir: string, log: (msg: string) => void): Promise<number> {
	if (!(await fileExistsAtPath(sourceDir))) {
		log(`Settings source not found at ${sourceDir}; skipping`)
		return 0
	}

	await fs.mkdir(destDir, { recursive: true })
	let copied = 0

	const entries = await fs.readdir(sourceDir, { withFileTypes: true })
	for (const entry of entries) {
		if (!entry.isFile()) {
			continue
		}
		const destFile = path.join(destDir, entry.name)
		// Skip files already present in Zoo's settings
		if (await fileExistsAtPath(destFile)) {
			continue
		}
		await fs.copyFile(path.join(sourceDir, entry.name), destFile)
		copied++
	}

	return copied
}
