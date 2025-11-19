import * as vscode from "vscode"
import * as path from "path"

import { getGlobalRooDirectory, getProjectRooDirectoryForCwd } from "../roo-config"
import { flushModels } from "../../api/providers/fetchers/modelCache"
import { clearProviderModelsCache, preloadStaticProviderModels } from "../../api/providers/model-lookup"
import { getWorkspacePath } from "../../utils/path"
import type { RouterName } from "../../shared/api"
import type { ProviderName } from "@roo-code/types"

const MODELS_DIR = "models"

/**
 * Setup file watchers for custom model JSON files
 * Watches both global and project-local .roo/models/ directories
 * @param cwd Current working directory for project path
 * @returns Disposable to clean up watchers
 */
export function setupCustomModelsWatcher(cwd: string): vscode.Disposable {
	const globalPath = path.join(getGlobalRooDirectory(), MODELS_DIR)
	const projectPath = path.join(getProjectRooDirectoryForCwd(cwd), MODELS_DIR)

	const globalWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(globalPath, "*.json"))

	const projectWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(projectPath, "*.json"))

	const handleChange = async (uri: vscode.Uri) => {
		// Extract provider from filename (e.g., "openrouter.json" → "openrouter")
		const filename = path.basename(uri.fsPath, ".json") as ProviderName
		console.log(`[CustomModels] Detected change in custom models for provider: ${filename}`)

		// Clear cache for dynamic providers
		try {
			await flushModels(filename as RouterName)
		} catch (error) {
			// Not a dynamic provider, that's fine
		}

		// Clear cache for static providers and re-preload
		clearProviderModelsCache(filename)

		// Re-preload all static provider models to ensure cache is updated
		try {
			await preloadStaticProviderModels(getWorkspacePath())
		} catch (error) {
			console.error(`[CustomModels] Error reloading static provider models:`, error)
		}
	}

	return vscode.Disposable.from(
		globalWatcher.onDidChange(handleChange),
		globalWatcher.onDidCreate(handleChange),
		globalWatcher.onDidDelete(handleChange),
		projectWatcher.onDidChange(handleChange),
		projectWatcher.onDidCreate(handleChange),
		projectWatcher.onDidDelete(handleChange),
		globalWatcher,
		projectWatcher,
	)
}
