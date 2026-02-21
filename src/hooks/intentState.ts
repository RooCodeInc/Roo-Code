// src/hooks/intentState.ts
let activeIntent: string | undefined

export function setActiveIntent(id: string | undefined) {
	activeIntent = id
}

export function getActiveIntent(): string | undefined {
	return activeIntent
}
