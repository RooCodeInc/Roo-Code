import fs from "fs/promises"
import path from "path"

const mapByIntent = new Map<string, Set<string>>()
let hydratedByWorkspace = new Set<string>()

function mapPath(cwd: string): string {
	return path.join(cwd, ".orchestration", "intent_map.md")
}

function renderMarkdown(): string {
	const intents = [...mapByIntent.keys()].sort()
	const lines: string[] = ["# Intent Map", ""]
	for (const intentId of intents) {
		lines.push(`## ${intentId}`)
		const files = [...(mapByIntent.get(intentId) ?? new Set())].sort()
		for (const file of files) {
			lines.push(`- \`${file}\``)
		}
		lines.push("")
	}
	return lines.join("\n")
}

async function hydrateFromDisk(cwd: string): Promise<void> {
	if (hydratedByWorkspace.has(cwd)) {
		return
	}
	const target = mapPath(cwd)
	try {
		const raw = await fs.readFile(target, "utf-8")
		let currentIntent: string | null = null
		for (const line of raw.split(/\r?\n/)) {
			const intentHeader = line.match(/^##\s+(.+)$/)
			if (intentHeader) {
				currentIntent = intentHeader[1].trim()
				if (!mapByIntent.has(currentIntent)) {
					mapByIntent.set(currentIntent, new Set<string>())
				}
				continue
			}
			const fileItem = line.match(/^- \`(.+)\`$/)
			if (fileItem && currentIntent) {
				const files = mapByIntent.get(currentIntent) ?? new Set<string>()
				files.add(fileItem[1].trim())
				mapByIntent.set(currentIntent, files)
			}
		}
	} catch (error: any) {
		if (error?.code !== "ENOENT") {
			throw error
		}
	}
	hydratedByWorkspace.add(cwd)
}

export async function updateIntentMap(
	cwd: string,
	intentId: string | null,
	filePath: string | undefined,
): Promise<void> {
	if (!intentId || !filePath) {
		return
	}
	await hydrateFromDisk(cwd)
	const files = mapByIntent.get(intentId) ?? new Set<string>()
	files.add(filePath)
	mapByIntent.set(intentId, files)
	const target = mapPath(cwd)
	await fs.mkdir(path.dirname(target), { recursive: true })
	await fs.writeFile(target, renderMarkdown(), "utf-8")
}
