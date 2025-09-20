import { ExtensionContext } from "vscode"
import { getSettingsDirectoryPath } from "./storage"

export async function getGlobalFsPath(context: ExtensionContext): Promise<string> {
	return context.globalStorageUri.fsPath
}

export async function ensureSettingsDirectoryExists(context: ExtensionContext): Promise<string> {
	// Use getSettingsDirectoryPath to honor custom storage path setting
	const settingsDir = await getSettingsDirectoryPath(context.globalStorageUri.fsPath)
	// getSettingsDirectoryPath already creates the directory, so no need to call mkdir
	return settingsDir
}
