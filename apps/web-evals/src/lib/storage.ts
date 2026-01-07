export function tryParseJson(raw: string): unknown {
	try {
		return JSON.parse(raw)
	} catch {
		return undefined
	}
}

export function deserializeNumber(raw: string): number | undefined {
	const parsed = tryParseJson(raw)
	if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed

	const asNumber = Number(raw)
	return Number.isFinite(asNumber) ? asNumber : undefined
}

export function deserializeString(raw: string): string {
	const parsed = tryParseJson(raw)
	return typeof parsed === "string" ? parsed : raw
}

export function deserializeStringArray(raw: string): string[] {
	const parsed = tryParseJson(raw)
	return Array.isArray(parsed) && parsed.every((v) => typeof v === "string") ? parsed : []
}

export function deserializeBoolean(raw: string): boolean {
	// Support legacy raw-string storage and default JSON serialization.
	if (raw === "true") return true
	if (raw === "false") return false

	const parsed = tryParseJson(raw)
	return typeof parsed === "boolean" ? parsed : false
}

export function deserializeEnum<T extends string>(raw: string, allowed: ReadonlySet<T>, fallback: T): T {
	if (allowed.has(raw as T)) return raw as T

	const parsed = tryParseJson(raw)
	if (typeof parsed === "string" && allowed.has(parsed as T)) return parsed as T

	return fallback
}
