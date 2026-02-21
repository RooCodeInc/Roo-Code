import { loadIntents } from "./intentLoader"

let activeIntent: any = null

export function selectActiveIntent(intentId: string) {
	const intents = loadIntents()
	const intent = intents.find((i: any) => i.id === intentId)

	if (!intent) {
		throw new Error(`Invalid intent ID: ${intentId}`)
	}

	activeIntent = intent
	return intent
}

export function getActiveIntent() {
	return activeIntent
}
