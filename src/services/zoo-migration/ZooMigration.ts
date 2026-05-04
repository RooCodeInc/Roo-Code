import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import type { GlobalSettings } from "@roo-code/types"

import { ContextProxy } from "../../core/config/ContextProxy"
import type { ProviderProfiles } from "../../core/config/ProviderSettingsManager"
import { t } from "../../i18n"
import { Package } from "../../shared/package"
import { fileExistsAtPath } from "../../utils/fs"
import { getStorageBasePath } from "../../utils/storage"

const HANDOFF_SCHEMA_VERSION = 1
const HANDOFF_DIR_NAME = "zoo-migration"
const HANDOFF_FILE_NAME = "handoff-v1.json"

const ZOO_REPOSITORY_URL = "https://github.com/Zoo-Code-Org/Zoo-Code"
const ZOO_ANNOUNCEMENT_URL = "https://www.reddit.com/r/RooCode/comments/1syufn1/roo_is_back_as_zoo/"
const ZOO_EXTENSION_ID = process.env.ZOO_CODE_EXTENSION_ID

const CONFIGURATION_KEYS = [
	"allowedCommands",
	"deniedCommands",
	"commandExecutionTimeout",
	"commandTimeoutAllowlist",
	"preventCompletionWithOpenTodos",
	"vsCodeLmModelSelector",
	"customStoragePath",
	"enableCodeActions",
	"autoImportSettingsPath",
	"maximumIndexedFilesForFileSearch",
	"useAgentRules",
	"apiRequestTimeout",
	"newTaskRequireTodos",
	"codeIndex.embeddingBatchSize",
	"debug",
	"debugProxy.enabled",
	"debugProxy.serverUrl",
	"debugProxy.tlsInsecure",
] as const

type ConfigurationValue = {
	value: unknown
	globalValue?: unknown
	workspaceValue?: unknown
	workspaceFolderValue?: unknown
}

type HandoffCopiedData = {
	settings?: string
	tasks?: string
}

export type ZooMigrationHandoff = {
	schemaVersion: typeof HANDOFF_SCHEMA_VERSION
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
		extensionId?: string
	}
	containsSecrets: boolean
	globalSettings?: GlobalSettings
	vscodeConfiguration: Record<string, ConfigurationValue>
	providerProfiles?: ProviderProfiles
	copiedData: HandoffCopiedData
}

export type CreateZooMigrationHandoffOptions = {
	context: vscode.ExtensionContext
	contextProxy: ContextProxy
	providerSettingsManager: {
		export: () => Promise<ProviderProfiles>
	}
	includeSecrets: boolean
	outputChannel?: vscode.OutputChannel
}

export type CreateZooMigrationHandoffResult = {
	handoffPath: string
	handoff: ZooMigrationHandoff
}

export type ShowZooMigrationNoticeOptions = {
	outputChannel?: vscode.OutputChannel
	delayMs?: number
}

export async function createZooMigrationHandoff({
	context,
	contextProxy,
	providerSettingsManager,
	includeSecrets,
	outputChannel,
}: CreateZooMigrationHandoffOptions): Promise<CreateZooMigrationHandoffResult> {
	const createdAt = new Date().toISOString()
	const migrationDir = path.join(context.globalStorageUri.fsPath, HANDOFF_DIR_NAME)
	const dataDir = path.join(migrationDir, "data")
	const storageBasePath = await getStorageBasePath(context.globalStorageUri.fsPath)
	const copiedData: HandoffCopiedData = {}

	await fs.mkdir(dataDir, { recursive: true })

	await copyDataDirectory({
		sourcePath: path.join(storageBasePath, "settings"),
		destinationPath: path.join(dataDir, "settings"),
		relativePath: "data/settings",
		copiedData,
		key: "settings",
		outputChannel,
	})

	await copyDataDirectory({
		sourcePath: path.join(storageBasePath, "tasks"),
		destinationPath: path.join(dataDir, "tasks"),
		relativePath: "data/tasks",
		copiedData,
		key: "tasks",
		outputChannel,
	})

	const globalSettings = await contextProxy.export()
	const providerProfiles = includeSecrets ? await providerSettingsManager.export() : undefined
	const handoff: ZooMigrationHandoff = {
		schemaVersion: HANDOFF_SCHEMA_VERSION,
		createdAt,
		source: {
			extensionId: `${Package.publisher}.${Package.name}`,
			publisher: Package.publisher,
			name: Package.name,
			version: Package.version,
			globalStoragePath: context.globalStorageUri.fsPath,
			storageBasePath,
		},
		zoo: {
			repositoryUrl: ZOO_REPOSITORY_URL,
			announcementUrl: ZOO_ANNOUNCEMENT_URL,
			extensionId: ZOO_EXTENSION_ID,
		},
		containsSecrets: includeSecrets,
		globalSettings,
		vscodeConfiguration: getRooConfigurationValues(),
		providerProfiles,
		copiedData,
	}

	const handoffPath = path.join(migrationDir, HANDOFF_FILE_NAME)
	await fs.writeFile(handoffPath, JSON.stringify(handoff, null, 2), "utf-8")
	await restrictFilePermissions(handoffPath, outputChannel)

	outputChannel?.appendLine(`[Zoo Migration] Prepared handoff at ${handoffPath}`)

	return { handoffPath, handoff }
}

export async function showZooMigrationNotice(
	context: vscode.ExtensionContext,
	{ outputChannel, delayMs = 1500 }: ShowZooMigrationNoticeOptions = {},
): Promise<void> {
	if (delayMs > 0) {
		await new Promise((resolve) => setTimeout(resolve, delayMs))
	}

	const installAction = t("common:zooMigration.actions.installZoo")
	const migrateAction = t("common:zooMigration.actions.prepareMigration")
	const learnMoreAction = t("common:zooMigration.actions.learnMore")
	const laterAction = t("common:zooMigration.actions.later")
	outputChannel?.appendLine(`[Zoo Migration] Showing migration notice for ${Package.version}`)
	const result = await vscode.window.showInformationMessage(
		t("common:zooMigration.notice"),
		installAction,
		migrateAction,
		learnMoreAction,
		laterAction,
	)

	if (!result) {
		outputChannel?.appendLine("[Zoo Migration] Migration notice dismissed without selection; it may be shown again")
		return
	}

	outputChannel?.appendLine(`[Zoo Migration] Migration notice selected: ${result}`)

	if (result === installAction) {
		await installOrShowZooExtension()
	} else if (result === migrateAction) {
		await vscode.commands.executeCommand(`${Package.name}.prepareZooMigration`)
	} else if (result === learnMoreAction) {
		await vscode.env.openExternal(vscode.Uri.parse(ZOO_REPOSITORY_URL))
	}
}

export async function installOrShowZooExtension(): Promise<void> {
	if (ZOO_EXTENSION_ID) {
		await vscode.commands.executeCommand("workbench.extensions.installExtension", ZOO_EXTENSION_ID)
		return
	}

	await vscode.commands.executeCommand("workbench.extensions.search", "Zoo Code")
	await vscode.window.showInformationMessage(t("common:zooMigration.zooNotPublished"))
}

export async function promptAndCreateZooMigrationHandoff(options: {
	context: vscode.ExtensionContext
	contextProxy: ContextProxy
	providerSettingsManager: CreateZooMigrationHandoffOptions["providerSettingsManager"]
	outputChannel?: vscode.OutputChannel
}): Promise<CreateZooMigrationHandoffResult | undefined> {
	const includeSecretsAction = t("common:zooMigration.actions.includeApiKeys")
	const noSecretsAction = t("common:zooMigration.actions.skipApiKeys")
	const cancelAction = t("common:zooMigration.actions.cancel")
	const result = await vscode.window.showWarningMessage(
		t("common:zooMigration.preparePrompt"),
		{ modal: true },
		includeSecretsAction,
		noSecretsAction,
		cancelAction,
	)

	if (!result || result === cancelAction) {
		return undefined
	}

	const handoffResult = await createZooMigrationHandoff({
		...options,
		includeSecrets: result === includeSecretsAction,
	})

	await vscode.window.showInformationMessage(
		t("common:zooMigration.handoffPrepared", { path: handoffResult.handoffPath }),
	)

	return handoffResult
}

function getRooConfigurationValues(): Record<string, ConfigurationValue> {
	const configuration = vscode.workspace.getConfiguration(Package.name)

	return Object.fromEntries(
		CONFIGURATION_KEYS.map((key) => {
			const inspected = typeof configuration.inspect === "function" ? configuration.inspect(key) : undefined
			return [
				key,
				{
					value: configuration.get(key),
					globalValue: inspected?.globalValue,
					workspaceValue: inspected?.workspaceValue,
					workspaceFolderValue: inspected?.workspaceFolderValue,
				},
			]
		}),
	)
}

async function copyDataDirectory({
	sourcePath,
	destinationPath,
	relativePath,
	copiedData,
	key,
	outputChannel,
}: {
	sourcePath: string
	destinationPath: string
	relativePath: string
	copiedData: HandoffCopiedData
	key: keyof HandoffCopiedData
	outputChannel?: vscode.OutputChannel
}) {
	if (!(await fileExistsAtPath(sourcePath))) {
		outputChannel?.appendLine(`[Zoo Migration] No ${key} directory found at ${sourcePath}; skipping`)
		return
	}

	await fs.rm(destinationPath, { recursive: true, force: true })
	await fs.cp(sourcePath, destinationPath, { recursive: true })
	copiedData[key] = relativePath
}

async function restrictFilePermissions(filePath: string, outputChannel?: vscode.OutputChannel) {
	try {
		await fs.chmod(filePath, 0o600)
	} catch (error) {
		outputChannel?.appendLine(
			`[Zoo Migration] Could not restrict handoff permissions: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}
