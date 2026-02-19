import path from "path"
import fs from "fs/promises"
import micromatch from "micromatch"

// Command classification
const SAFE_TOOLS = ["read_file", "list_files", "search_files"]
const DESTRUCTIVE_TOOLS = ["write_to_file", "edit_file", "apply_patch", "delete_file", "execute_command"]

// Load .intentignore if present
async function loadIntentIgnore(cwd: string): Promise<string[]> {
	try {
		const ignorePath = path.join(cwd, ".intentignore")
		const content = await fs.readFile(ignorePath, "utf-8")
		return content
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean)
	} catch {
		return []
	}
}

// Check if file is ignored by .intentignore
export async function isIntentIgnored(cwd: string, file: string): Promise<boolean> {
	const patterns = await loadIntentIgnore(cwd)
	return micromatch.isMatch(file, patterns)
}

// Check if file is in scope
export function isInScope(file: string, ownedScope: string[]): boolean {
	return micromatch.isMatch(file, ownedScope)
}

// Classify tool
export function classifyTool(toolName: string): "safe" | "destructive" | "unknown" {
	if (SAFE_TOOLS.includes(toolName)) return "safe"
	if (DESTRUCTIVE_TOOLS.includes(toolName)) return "destructive"
	return "unknown"
}
