import * as fs from "fs"
import * as path from "path"
// @ts-expect-error - js-yaml types not available, but module exists
import * as yaml from "js-yaml"
import { IntentSpec } from "../types"

export async function loadActiveIntents(workspacePath: string): Promise<IntentSpec[]> {
	const yamlPath = path.join(workspacePath, ".orchestration", "active_intents.yaml")
	try {
		if (!fs.existsSync(yamlPath)) {
			return []
		}
		const fileContents = fs.readFileSync(yamlPath, "utf8")
		const data = yaml.load(fileContents) as { active_intents?: IntentSpec[] }
		return data.active_intents || []
	} catch (error) {
		console.error("Failed to load active_intents.yaml:", error)
		return []
	}
}

export async function saveActiveIntents(workspacePath: string, intents: IntentSpec[]): Promise<void> {
	const yamlPath = path.join(workspacePath, ".orchestration", "active_intents.yaml")
	const data = { active_intents: intents }
	const yamlContent = yaml.dump(data, { indent: 2 })
	fs.writeFileSync(yamlPath, yamlContent, "utf8")
}

export function isWithinScope(filePath: string, ownedScope: string[]): boolean {
	return ownedScope.some((pattern) => {
		const regex = new RegExp("^" + pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$")
		return regex.test(filePath)
	})
}
