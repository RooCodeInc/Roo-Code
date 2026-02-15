export const CHAT_SCROLL_DEBUG_EVENT_NAME = "roo:chat-scroll-debug"
const CHAT_SCROLL_DEBUG_STORAGE_KEY = "roo.chatScrollDebug"
const CHAT_SCROLL_DEBUG_QUERY_KEY = "chatScrollDebug"

export interface ChatScrollDebugDetail {
	event: string
	[key: string]: unknown
}

export function isChatScrollDebugEnabled(debugSetting?: boolean): boolean {
	if (debugSetting === true) {
		return true
	}

	if (typeof window === "undefined") {
		return false
	}

	const runtimeFlag = (window as Window & { __ROO_CHAT_SCROLL_DEBUG__?: boolean }).__ROO_CHAT_SCROLL_DEBUG__
	if (runtimeFlag === true) {
		return true
	}

	const debugFromQuery = new URLSearchParams(window.location.search).get(CHAT_SCROLL_DEBUG_QUERY_KEY)
	if (debugFromQuery === "1" || debugFromQuery === "true") {
		return true
	}

	return window.localStorage.getItem(CHAT_SCROLL_DEBUG_STORAGE_KEY) === "1"
}

export function emitChatScrollDebug(enabled: boolean, detail: ChatScrollDebugDetail): void {
	if (!enabled) {
		return
	}

	const payload = {
		ts: Date.now(),
		...detail,
	}

	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent(CHAT_SCROLL_DEBUG_EVENT_NAME, { detail: payload }))
	}
}
