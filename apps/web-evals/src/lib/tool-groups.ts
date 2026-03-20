import { deserializeStringArray, tryParseJson } from "@/lib/storage"

export type ToolGroup = {
	id: string
	name: string
	icon: string
	tools: string[]
}

function isToolGroup(value: unknown): value is ToolGroup {
	if (!value || typeof value !== "object") return false
	const v = value as Record<string, unknown>
	return (
		typeof v.id === "string" &&
		typeof v.name === "string" &&
		typeof v.icon === "string" &&
		Array.isArray(v.tools) &&
		v.tools.every((t) => typeof t === "string")
	)
}

export function deserializeToolGroups(raw: string): ToolGroup[] {
	// Be tolerant: default `useLocalStorage` JSON serialization will be valid JSON.
	// If consumers previously wrote non-JSON, treat as empty.
	const parsed = tryParseJson(raw)
	if (!Array.isArray(parsed)) return []
	return parsed.filter(isToolGroup)
}

export function serializeToolGroups(groups: ToolGroup[]): string {
	return JSON.stringify(groups)
}

export function deserializeToolGroupTools(raw: string): string[] {
	// Useful if we ever need to read just tool arrays.
	return deserializeStringArray(raw)
}
