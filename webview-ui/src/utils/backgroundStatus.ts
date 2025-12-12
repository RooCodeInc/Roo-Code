export type BackgroundStatus =
	| "queued"
	| "in_progress"
	| "completed"
	| "failed"
	| "canceled"
	| "reconnecting"
	| "polling"

export function labelForBackgroundStatus(s?: BackgroundStatus): string {
	switch (s) {
		case "queued":
			return "API Request: background mode (queued)…"
		case "in_progress":
			return "API Request: background mode (in progress)…"
		case "reconnecting":
			return "API Request: background mode (reconnecting…)"
		case "polling":
			return "API Request: background mode (polling…)"
		case "completed":
			return "API Request: background mode (completed)"
		case "failed":
			return "API Request: background mode (failed)"
		case "canceled":
			return "API Request: background mode (canceled)"
		default:
			return "API Request: background mode"
	}
}
