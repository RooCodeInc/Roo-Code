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

/**
 * Check if the extension is running in a remote environment
 */
function isRemoteEnvironment(): boolean {
	// Check if we're in a remote environment by looking at the extension context
	// In remote environments, vscode.env.remoteName will be set
	return typeof (vscode.env as any).remoteName !== "undefined" && (vscode.env as any).remoteName !== null
}

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

/**
 * Imports configuration from a specific file path
 * Shares base functionality for import settings for both the manual
 * and automatic settings importing
 */
export async function importSettingsFromPath(
	filePath: string,
	{ providerSettingsManager, contextProxy, customModesManager }: ImportOptions,
) {
	const schema = z.object({
		providerProfiles: providerProfilesSchema,
		globalSettings: globalSettingsSchema.optional(),
	})

	try {
		const previousProviderProfiles = await providerSettingsManager.export()

		const { providerProfiles: newProviderProfiles, globalSettings = {} } = schema.parse(
			JSON.parse(await fs.readFile(filePath, "utf-8")),
		)

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

		return { providerProfiles, globalSettings, success: true }
	} catch (e) {
		let error = "Unknown error"

		if (e instanceof ZodError) {
			error = e.issues.map((issue) => `[${issue.path.join(".")}]: ${issue.message}`).join("\n")
			TelemetryService.instance.captureSchemaValidationError({ schemaName: "ImportExport", error: e })
		} else if (e instanceof Error) {
			error = e.message
		}

		return { success: false, error }
	}
}

/**
 * Import settings from a file using a file dialog
 * @param options - Import options containing managers and proxy
 * @returns Promise resolving to import result
 */
export const importSettings = async ({ providerSettingsManager, contextProxy, customModesManager }: ImportOptions) => {
	// Check if we're in a remote environment
	if (isRemoteEnvironment()) {
		// In remote environments, we need to handle file selection differently
		// to ensure the user can select files from their local machine

		// Show a quick pick to let user choose between local file or remote file
		const choice = await vscode.window.showQuickPick(
			[
				{
					label: "$(file) Import from local file",
					description: "Select a file from your local machine",
					value: "local",
				},
				{
					label: "$(remote) Import from remote file",
					description: "Select a file from the remote server",
					value: "remote",
				},
			],
			{
				placeHolder: "Choose where to import settings from",
				title: "Import Settings",
			},
		)

		if (!choice) {
			return { success: false, error: "User cancelled import" }
		}

		if (choice.value === "local") {
			// For local file selection in remote environment, we need to:
			// 1. Ask user to paste the content or provide a path
			const inputChoice = await vscode.window.showQuickPick(
				[
					{
						label: "$(paste) Paste settings content",
						description: "Paste the JSON content directly",
						value: "paste",
					},
					{
						label: "$(file-text) Enter local file path",
						description: "Provide the path to a local file",
						value: "path",
					},
				],
				{
					placeHolder: "How would you like to provide the settings?",
					title: "Import Local Settings",
				},
			)

			if (!inputChoice) {
				return { success: false, error: "User cancelled import" }
			}

			if (inputChoice.value === "paste") {
				// Ask user to paste the JSON content
				const jsonContent = await vscode.window.showInputBox({
					prompt: "Paste your settings JSON content here",
					placeHolder: '{"providerProfiles": {...}, "globalSettings": {...}}',
					ignoreFocusOut: true,
					validateInput: (value) => {
						if (!value) return "Please paste the settings content"
						try {
							JSON.parse(value)
							return undefined
						} catch {
							return "Invalid JSON format"
						}
					},
				})

				if (!jsonContent) {
					return { success: false, error: "User cancelled import" }
				}

				// Create a temporary file with the content
				const tempDir = os.tmpdir()
				const tempFile = path.join(tempDir, `roo-settings-import-${Date.now()}.json`)

				try {
					await fs.writeFile(tempFile, jsonContent, "utf-8")
					const result = await importSettingsFromPath(tempFile, {
						providerSettingsManager,
						contextProxy,
						customModesManager,
					})
					// Clean up temp file
					await fs.unlink(tempFile).catch(() => {}) // Ignore errors
					return result
				} catch (error) {
					return { success: false, error: `Failed to process settings: ${error}` }
				}
			} else {
				// Ask user to enter the local file path
				const localPath = await vscode.window.showInputBox({
					prompt: "Enter the path to your local settings file",
					placeHolder: "~/Documents/roo-code-settings.json",
					ignoreFocusOut: true,
				})

				if (!localPath) {
					return { success: false, error: "User cancelled import" }
				}

				// Note: We can't directly access the local file from remote environment
				// So we'll show instructions to the user
				await vscode.window.showInformationMessage(
					"To import from a local file in a remote SSH session, please use one of these methods:\n" +
						"1. Copy the file to the remote server first using scp/sftp\n" +
						"2. Use the 'Paste settings content' option instead\n" +
						"3. Open the file locally and copy its content to paste",
					"OK",
				)

				return { success: false, error: "Cannot directly access local files from remote environment" }
			}
		} else {
			// Remote file selection - use the standard dialog
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
	} else {
		// Standard local environment - use the normal file dialog
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
	filePath?: string,
) => {
	let result

	if (filePath) {
		// Validate file path and check if file exists
		try {
			// Check if file exists and is readable
			await fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK)
			result = await importSettingsFromPath(filePath, {
				providerSettingsManager,
				contextProxy,
				customModesManager,
			})
		} catch (error) {
			result = {
				success: false,
				error: `Cannot access file at path "${filePath}": ${error instanceof Error ? error.message : "Unknown error"}`,
			}
		}
	} else {
		result = await importSettings({ providerSettingsManager, contextProxy, customModesManager })
	}

	if (result.success) {
		provider.settingsImportedAt = Date.now()
		await provider.postStateToWebview()
		await vscode.window.showInformationMessage(t("common:info.settings_imported"))
	} else if (result.error) {
		await vscode.window.showErrorMessage(t("common:errors.settings_import_failed", { error: result.error }))
	}
}
