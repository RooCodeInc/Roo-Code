import { safeWriteJson } from "../../utils/safeWriteJson"
import os from "os"
import * as path from "path"
import fs from "fs/promises"

import * as vscode from "vscode"
import { z, ZodError } from "zod"

import { globalSettingsSchema } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { ProviderSettingsManager, providerProfilesSchema } from "./ProviderSettingsManager"
import { ContextProxy } from "./ContextProxy"
import { CustomModesManager } from "./CustomModesManager"
import { t } from "../../i18n"

export type ImportOptions = {
	providerSettingsManager: ProviderSettingsManager
	contextProxy: ContextProxy
	customModesManager: CustomModesManager
}

type ExportOptions = {
	providerSettingsManager: ProviderSettingsManager
	contextProxy: ContextProxy
}
type ImportWithProviderOptions = ImportOptions & {
	provider: {
		settingsImportedAt?: number
		postStateToWebview: () => Promise<void>
	}
}

export type ImportSource = { filePath: string } | { fileContents: string }

/**
 * Imports configuration from a specific file path
 * Shares base functionality for import settings for both the manual
 * and automatic settings importing
 */
const importSettingsSchema = z.object({
	providerProfiles: providerProfilesSchema,
	globalSettings: globalSettingsSchema.optional(),
})

type ImportSettingsPayload = z.infer<typeof importSettingsSchema>

const toImportError = (e: unknown) => {
	let error = "Unknown error"

	if (e instanceof ZodError) {
		error = e.issues.map((issue) => `[${issue.path.join(".")}]: ${issue.message}`).join("\n")
		TelemetryService.instance.captureSchemaValidationError({ schemaName: "ImportExport", error: e })
	} else if (e instanceof Error) {
		error = e.message
	}

	return { success: false as const, error }
}

const applyImportedSettings = async (
	{ providerProfiles: newProviderProfiles, globalSettings = {} }: ImportSettingsPayload,
	{ providerSettingsManager, contextProxy, customModesManager }: ImportOptions,
) => {
	const previousProviderProfiles = await providerSettingsManager.export()

	const providerProfiles = {
		currentApiConfigName: newProviderProfiles.currentApiConfigName,
		apiConfigs: {
			...previousProviderProfiles.apiConfigs,
			...newProviderProfiles.apiConfigs,
		},
		modeApiConfigs: {
			...previousProviderProfiles.modeApiConfigs,
			...newProviderProfiles.modeApiConfigs,
		},
	}

	await Promise.all(
		(globalSettings.customModes ?? []).map((mode) => customModesManager.updateCustomMode(mode.slug, mode)),
	)

	// OpenAI Compatible settings are now correctly stored in codebaseIndexConfig
	// They will be imported automatically with the config - no special handling needed

	await providerSettingsManager.import(providerProfiles)
	await contextProxy.setValues(globalSettings)

	// Set the current provider.
	const currentProviderName = providerProfiles.currentApiConfigName
	const currentProvider = providerProfiles.apiConfigs[currentProviderName]
	contextProxy.setValue("currentApiConfigName", currentProviderName)

	// TODO: It seems like we don't need to have the provider settings in
	// the proxy; we can just use providerSettingsManager as the source of
	// truth.
	if (currentProvider) {
		contextProxy.setProviderSettings(currentProvider)
	}

	contextProxy.setValue("listApiConfigMeta", await providerSettingsManager.listConfig())

	return { providerProfiles, globalSettings, success: true as const }
}

export async function importSettingsFromContent(jsonContent: string, options: ImportOptions) {
	try {
		const payload = importSettingsSchema.parse(JSON.parse(jsonContent))
		return await applyImportedSettings(payload, options)
	} catch (e) {
		return toImportError(e)
	}
}

export async function importSettingsFromPath(filePath: string, options: ImportOptions) {
	try {
		const fileContents = await fs.readFile(filePath, "utf-8")
		return await importSettingsFromContent(fileContents, options)
	} catch (e) {
		return toImportError(e)
	}
}

/**
 * Import settings from a file using a file dialog
 * @param options - Import options containing managers and proxy
 * @returns Promise resolving to import result
 */
export const importSettings = async ({ providerSettingsManager, contextProxy, customModesManager }: ImportOptions) => {
	const uris = await vscode.window.showOpenDialog({
		filters: { JSON: ["json"] },
		canSelectMany: false,
	})

	if (!uris) {
		return { success: false, error: "User cancelled file selection" }
	}

	return importSettingsFromPath(uris[0].fsPath, {
		providerSettingsManager,
		contextProxy,
		customModesManager,
	})
}

/**
 * Import settings from a specific file
 * @param options - Import options containing managers and proxy
 * @param fileUri - URI of the file to import from
 * @returns Promise resolving to import result
 */
export const importSettingsFromFile = async (
	{ providerSettingsManager, contextProxy, customModesManager }: ImportOptions,
	fileUri: vscode.Uri,
) => {
	return importSettingsFromPath(fileUri.fsPath, {
		providerSettingsManager,
		contextProxy,
		customModesManager,
	})
}

export const exportSettings = async ({ providerSettingsManager, contextProxy }: ExportOptions) => {
	const uri = await vscode.window.showSaveDialog({
		filters: { JSON: ["json"] },
		defaultUri: vscode.Uri.file(path.join(os.homedir(), "Documents", "roo-code-settings.json")),
	})

	if (!uri) {
		return
	}

	try {
		const providerProfiles = await providerSettingsManager.export()
		const globalSettings = await contextProxy.export()

		// It's okay if there are no global settings, but if there are no
		// provider profile configured then don't export. If we wanted to
		// support this case then the `importSettings` function would need to
		// be updated to handle the case where there are no provider profiles.
		if (typeof providerProfiles === "undefined") {
			return
		}

		// OpenAI Compatible settings are now correctly stored in codebaseIndexConfig
		// No workaround needed - they will be exported automatically with the config

		const dirname = path.dirname(uri.fsPath)
		await fs.mkdir(dirname, { recursive: true })
		await safeWriteJson(uri.fsPath, { providerProfiles, globalSettings })
	} catch (e) {
		console.error("Failed to export settings:", e)
		// Don't re-throw - the UI will handle showing error messages
	}
}

/**
 * Import settings with complete UI feedback and provider state updates
 * @param options - Import options with provider instance
 * @param filePath - Optional file path to import from. If not provided, a file dialog will be shown.
 * @returns Promise that resolves when import is complete
 */
export const importSettingsWithFeedback = async (
	{ providerSettingsManager, contextProxy, customModesManager, provider }: ImportWithProviderOptions,
	source?: ImportSource,
) => {
	let result
	const baseImportOptions = { providerSettingsManager, contextProxy, customModesManager }

	if (source && "fileContents" in source) {
		result = await importSettingsFromContent(source.fileContents, baseImportOptions)
	} else if (source && "filePath" in source) {
		const { filePath } = source
		try {
			await fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK)
			result = await importSettingsFromPath(filePath, baseImportOptions)
		} catch (error) {
			result = {
				success: false,
				error: `Cannot access file at path "${filePath}": ${error instanceof Error ? error.message : "Unknown error"}`,
			}
		}
	} else {
		result = await importSettings(baseImportOptions)
	}

	if (result.success) {
		provider.settingsImportedAt = Date.now()
		await provider.postStateToWebview()
		await vscode.window.showInformationMessage(t("common:info.settings_imported"))
	} else if (result.error) {
		await vscode.window.showErrorMessage(t("common:errors.settings_import_failed", { error: result.error }))
	}
}
