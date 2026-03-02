import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const FIRST_PROMPT = `What is 1+1? Reply with only "2".`
const FOLLOWUP_PROMPT = `Different question now: what is 3+3? Reply with only "6".`

function parseEventContent(text: string | undefined): string {
	return typeof text === "string" ? text : ""
}

function validateFollowupAnswer(text: string): void {
	const normalized = text.toLowerCase()
	const containsExpected = /\b6\b/.test(normalized) || normalized.includes("six")
	const containsOldAnswer = /\b1\+1\b/.test(normalized) || /\b2\b/.test(normalized)
	const containsQuestionReference = normalized.includes("3+3")

	if (!containsExpected) {
		throw new Error(`follow-up result did not answer the follow-up question; result="${text}"`)
	}

	if (!containsQuestionReference && containsOldAnswer && !containsExpected) {
		throw new Error(`follow-up result appears anchored to first question; result="${text}"`)
	}
}

async function main() {
	const startRequestId = `start-${Date.now()}`
	const followupRequestId = `message-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let sentFollowup = false
	let sentShutdown = false
	let firstResult = ""
	let followupResult = ""

	await runStreamCase({
		onEvent(event: StreamEvent, context) {
			if (event.type === "system" && event.subtype === "init" && !initSeen) {
				initSeen = true
				context.sendCommand({
					command: "start",
					requestId: startRequestId,
					prompt: FIRST_PROMPT,
				})
				return
			}

			if (event.type === "control" && event.subtype === "error") {
				throw new Error(
					`received control error for requestId=${event.requestId ?? "unknown"} command=${event.command ?? "unknown"} code=${event.code ?? "unknown"} content=${event.content ?? ""}`,
				)
			}

			if (event.type !== "result" || event.done !== true) {
				return
			}

			if (event.requestId === startRequestId) {
				firstResult = parseEventContent(event.content)
				if (!/\b2\b/.test(firstResult)) {
					throw new Error(`first result did not answer first prompt; result="${firstResult}"`)
				}

				if (!sentFollowup) {
					context.sendCommand({
						command: "message",
						requestId: followupRequestId,
						prompt: FOLLOWUP_PROMPT,
					})
					sentFollowup = true
				}
				return
			}

			if (event.requestId !== followupRequestId) {
				return
			}

			followupResult = parseEventContent(event.content)
			validateFollowupAnswer(followupResult)
			console.log(`[PASS] first result="${firstResult}"`)
			console.log(`[PASS] follow-up result="${followupResult}"`)

			if (!sentShutdown) {
				context.sendCommand({
					command: "shutdown",
					requestId: shutdownRequestId,
				})
				sentShutdown = true
			}
		},
		onTimeoutMessage() {
			return `timed out waiting for completion (initSeen=${initSeen}, sentFollowup=${sentFollowup}, firstResult=${Boolean(firstResult)}, followupResult=${Boolean(followupResult)})`
		},
	})
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
