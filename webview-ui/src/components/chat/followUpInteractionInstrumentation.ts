export type FollowUpInteractionStage = "click" | "pending_render" | "settle" | "clear"

export interface FollowUpInteractionMarker {
	stage: FollowUpInteractionStage
	followUpTs: number | null
	source: "follow_up_suggest" | "chat_view"
	atMs: number
}

type FollowUpInteractionSink = (marker: FollowUpInteractionMarker) => void

let followUpInteractionSink: FollowUpInteractionSink | undefined
let lastMarkerAtMs = 0

const getMonotonicNowMs = (): number => {
	const rawNow =
		typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()

	if (!Number.isFinite(rawNow)) {
		lastMarkerAtMs += 1
		return lastMarkerAtMs
	}

	lastMarkerAtMs = Math.max(lastMarkerAtMs, rawNow)
	return lastMarkerAtMs
}

export const setFollowUpInteractionInstrumentationSink = (sink: FollowUpInteractionSink | undefined): void => {
	followUpInteractionSink = sink

	if (!sink) {
		lastMarkerAtMs = 0
	}
}

export const emitFollowUpInteractionMarker = (marker: Omit<FollowUpInteractionMarker, "atMs">): void => {
	if (!followUpInteractionSink) {
		return
	}

	followUpInteractionSink({
		...marker,
		atMs: getMonotonicNowMs(),
	})
}
