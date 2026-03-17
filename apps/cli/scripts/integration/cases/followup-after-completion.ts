import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const FIRST_PROMPT = `What is 1+1? Reply with only "2".`
const FOLLOWUP_PROMPT = `Different question now: what is 3+3? Reply with only "6".`

function parseEventContent(text: string | undefined): string {
	return typeof text === "string" ? text : ""
}

function validateFollowupResult(text: string): void {
	if (text.trim().length === 0) {
		throw new Error("follow-up produced an empty result")
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
	let followupDoneCode: string | undefined
	let sawFollowupUserTurn = false
	let sawMisroutedToolResult = false

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
				if (
					event.type === "control" &&
					event.requestId === followupRequestId &&
					event.command === "message" &&
					event.subtype === "done"
				) {
					followupDoneCode = event.code
					return
				}

				if (
					event.type === "tool_result" &&
					event.requestId === followupRequestId &&
					typeof event.content === "string" &&
					event.content.includes("<user_message>")
				) {
					sawMisroutedToolResult = true
					return
				}

				if (event.type === "user" && event.requestId === followupRequestId) {
					sawFollowupUserTurn = typeof event.content === "string" && event.content.includes("3+3")
					return
				}

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
			validateFollowupResult(followupResult)

			if (followupDoneCode !== "responded") {
				throw new Error(
					`follow-up message was not routed as ask response; code="${followupDoneCode ?? "none"}"`,
				)
			}

			if (!sawFollowupUserTurn) {
				throw new Error("follow-up did not appear as a normal user turn in stream output")
			}

			if (sawMisroutedToolResult) {
				throw new Error("follow-up message was misrouted into tool_result (<user_message>), old bug reproduced")
			}

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
