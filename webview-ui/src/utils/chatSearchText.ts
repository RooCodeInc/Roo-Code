import type { ClineMessage } from "@roo-code/types"

const DIAGRAM_LANGUAGES = new Set(["mermaid"])

const DIAGRAM_START_RE =
	/^(?:graph\s+(?:TB|BT|RL|LR|TD)|flowchart\s+(?:TB|BT|RL|LR|TD)|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie(?:\s+title)?|gitGraph|mindmap|timeline|quadrantChart|xychart-beta|block-beta|packet-beta|architecture-beta|sankey-beta|requirementDiagram|C4(?:Context|Container|Component|Dynamic|Deployment))/i

const getCodeFenceLanguage = (info: string) => info.trim().split(/\s+/)[0]?.toLowerCase() ?? ""

const getFirstNonEmptyLine = (text: string) =>
	text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean) ?? ""

export const normalizeSearchQuery = (query: string) => query.trim().toLocaleLowerCase()

export const isRenderedDiagramCodeBlock = (languageOrInfo: string | undefined, code: string) => {
	const language = getCodeFenceLanguage(languageOrInfo ?? "").replace(/^language-/, "")

	if (DIAGRAM_LANGUAGES.has(language)) {
		return true
	}

	return DIAGRAM_START_RE.test(getFirstNonEmptyLine(code))
}

export const stripRenderedDiagramBlocks = (markdown: string) => {
	if (!markdown) {
		return ""
	}

	return markdown.replace(
		/(^|\n)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)(?:\n\2[ \t]*(?=\n|$)|$)/g,
		(match, prefix: string, _fence: string, info: string, code: string) => {
			return isRenderedDiagramCodeBlock(info, code) ? `${prefix}\n` : match
		},
	)
}

const collectToolSearchText = (text: string) => {
	try {
		const tool = JSON.parse(text)
		const parts: string[] = []

		for (const key of [
			"tool",
			"path",
			"content",
			"diff",
			"reason",
			"query",
			"command",
			"args",
			"serverName",
			"toolName",
			"question",
		]) {
			if (typeof tool[key] === "string") {
				parts.push(tool[key])
			}
		}

		for (const key of ["batchFiles", "batchDirs", "batchDiffs", "todos", "suggest"]) {
			if (Array.isArray(tool[key])) {
				parts.push(JSON.stringify(tool[key]))
			}
		}

		return parts.length > 0 ? parts.join("\n") : text
	} catch {
		return text
	}
}

export const getChatSearchText = (message: Pick<ClineMessage, "type" | "ask" | "say" | "text"> | undefined) => {
	if (!message || typeof message.text !== "string") {
		return ""
	}

	const rawText =
		message.type === "ask" && message.ask === "tool" ? collectToolSearchText(message.text) : message.text

	return stripRenderedDiagramBlocks(rawText)
}

export const countSearchMatches = (text: string, query: string) => {
	const normalizedQuery = normalizeSearchQuery(query)

	if (!normalizedQuery) {
		return 0
	}

	const normalizedText = text.toLocaleLowerCase()
	let count = 0
	let index = 0

	while (index <= normalizedText.length) {
		const nextIndex = normalizedText.indexOf(normalizedQuery, index)

		if (nextIndex === -1) {
			break
		}

		count += 1
		index = nextIndex + normalizedQuery.length
	}

	return count
}

export const getSearchMatchSnippet = (text: string, query: string, matchIndex: number, radius = 48) => {
	const normalizedQuery = normalizeSearchQuery(query)

	if (!normalizedQuery) {
		return ""
	}

	const normalizedText = text.toLocaleLowerCase()
	let index = 0
	let foundIndex = -1

	for (let i = 0; i <= matchIndex; i++) {
		foundIndex = normalizedText.indexOf(normalizedQuery, index)

		if (foundIndex === -1) {
			return ""
		}

		index = foundIndex + normalizedQuery.length
	}

	const start = Math.max(0, foundIndex - radius)
	const end = Math.min(text.length, foundIndex + normalizedQuery.length + radius)
	const prefix = start > 0 ? "..." : ""
	const suffix = end < text.length ? "..." : ""

	return `${prefix}${text.slice(start, end)}${suffix}`.replace(/\s+/g, " ")
}
