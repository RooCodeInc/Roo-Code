import * as path from "path"
import * as fs from "fs/promises"

import { customModelsFileSchema } from "@roo-code/types"

import { getGlobalRooDirectory, getProjectRooDirectoryForCwd, fileExists } from "../roo-config"
import type { RouterName, ModelRecord } from "../../shared/api"

const MODELS_DIR = "models"

/**
 * Load custom models for a specific provider from a single JSON file
 * @param filePath Path to the JSON file
 * @returns ModelRecord or empty object if file doesn't exist/is invalid
 */
async function loadModelsFromFile(filePath: string): Promise<ModelRecord> {
	try {
		if (!(await fileExists(filePath))) {
			return {}
		}

		const content = await fs.readFile(filePath, "utf-8")
		const parsed = JSON.parse(content)

		const result = customModelsFileSchema.safeParse(parsed)

		if (!result.success) {
			console.error(`[CustomModels] Invalid schema in ${filePath}:`, result.error)
			return {}
		}

		return result.data as ModelRecord
	} catch (error) {
		console.error(`[CustomModels] Error loading ${filePath}:`, error)
		return {}
	}
}

/**
 * Get custom models for a provider by merging global and project files
 * @param provider The provider slug (e.g., "openrouter")
 * @param cwd Current working directory for project path
 * @returns Merged ModelRecord with project overriding global
 */
export async function getCustomModelsForProvider(provider: RouterName, cwd: string): Promise<ModelRecord> {
	const filename = `${provider}.json`

	const globalPath = path.join(getGlobalRooDirectory(), MODELS_DIR, filename)
	const projectPath = path.join(getProjectRooDirectoryForCwd(cwd), MODELS_DIR, filename)

	const globalModels = await loadModelsFromFile(globalPath)
	const projectModels = await loadModelsFromFile(projectPath)

	// Merge: project overrides global
	return { ...globalModels, ...projectModels }
}

export * from "./static-providers"
