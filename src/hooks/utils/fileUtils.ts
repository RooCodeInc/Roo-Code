import fs from "fs/promises"
import path from "path"
import YAML from "yaml"

export interface ActiveIntent {
	id: string
	name?: string
	status?: string
	owned_scope?: string[]
	constraints?: string[]
	acceptance_criteria?: string[]
}

export async function readActiveIntents(cwd = process.cwd()): Promise<ActiveIntent[]> {
	const p = path.join(cwd, ".orchestration", "active_intents.yaml")
	try {
		const content = await fs.readFile(p, "utf8")
		const parsed = YAML.parse(content)
		if (parsed && Array.isArray(parsed.active_intents)) return parsed.active_intents as ActiveIntent[]
		return []
	} catch (err) {
		return []
	}
}

export async function appendAgentTrace(entry: unknown, cwd = process.cwd()): Promise<void> {
	const dir = path.join(cwd, ".orchestration")
	await fs.mkdir(dir, { recursive: true })
	const file = path.join(dir, "agent_trace.jsonl")
	const line = JSON.stringify(entry) + "\n"
	await fs.appendFile(file, line, "utf8")
}

export async function ensureFileExists(relativePath: string, cwd = process.cwd()): Promise<void> {
	const p = path.join(cwd, relativePath)
	try {
		await fs.access(p)
	} catch (err) {
		await fs.writeFile(p, "", "utf8")
	}
}

export async function appendToDoc(filename: string, content: string, cwd = process.cwd()): Promise<void> {
	const p = path.join(cwd, filename)
	await fs.appendFile(p, content, "utf8")
}
