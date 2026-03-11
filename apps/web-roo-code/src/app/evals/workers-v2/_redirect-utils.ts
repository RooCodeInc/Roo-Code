export type RedirectSearchParams = Record<string, string | string[] | undefined>

export function buildQueryString(searchParams: RedirectSearchParams): string {
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(searchParams)) {
		if (typeof value === "string") params.set(key, value)
		else if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
	}
	const qs = params.toString()
	return qs ? `?${qs}` : ""
}
