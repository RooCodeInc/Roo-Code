import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const START_PROMPT =
	'Run exactly this command and do not summarize until it finishes: sleep 12 && echo "done". After it finishes, reply with exactly "done".'
const FOLLOWUP_PROMPT = 'After cancellation, reply with only "RACE-OK".'

async function main() {
	const startRequestId = `start-${Date.now()}`
	const cancelRequestId = `cancel-${Date.now()}`
	const followupRequestId = `message-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let sentCancelAndFollowup = false
	let sentShutdown = false
	let cancelDoneCode: string | undefined
	let followupDoneCode: string | undefined
	let followupResult = ""
	let sawFollowupUserTurn = false
	let sawMisroutedToolResult = false
	let sawMessageControlError = false

	await runStreamCase({
		onEvent(event: StreamEvent, context) {
			if (event.type === "system" && event.subtype === "init" && !initSeen) {
				initSeen = true
				context.sendCommand({
					command: "start",
					requestId: startRequestId,
					prompt: START_PROMPT,
				})
				return
			}

			if (event.type === "control" && event.subtype === "error") {
				if (event.requestId === followupRequestId) {
					sawMessageControlError = true
				}
				throw new Error(
					`received control error for requestId=${event.requestId ?? "unknown"} command=${event.command ?? "unknown"} code=${event.code ?? "unknown"} content=${event.content ?? ""}`,
				)
			}

			if (
				!sentCancelAndFollowup &&
				event.type === "tool_use" &&
				event.requestId === startRequestId &&
				event.subtype === "command"
			) {
				context.sendCommand({
					command: "cancel",
					requestId: cancelRequestId,
				})
				context.sendCommand({
					command: "message",
					requestId: followupRequestId,
					prompt: FOLLOWUP_PROMPT,
				})
				sentCancelAndFollowup = true
				return
			}

			if (
				event.type === "control" &&
				event.command === "cancel" &&
				event.subtype === "done" &&
				event.requestId === cancelRequestId
			) {
				cancelDoneCode = event.code
				return
			}

			if (
				event.type === "control" &&
				event.command === "message" &&
				event.subtype === "done" &&
				event.requestId === followupRequestId
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
				sawFollowupUserTurn = typeof event.content === "string" && event.content.includes("RACE-OK")
				return
			}

			if (event.type !== "result" || event.done !== true || event.requestId !== followupRequestId) {
				return
			}

			followupResult = event.content ?? ""

			if (followupResult.trim().length === 0) {
				throw new Error("follow-up after cancel produced an empty result")
			}
			if (cancelDoneCode !== "cancel_requested") {
				throw new Error(
					`cancel done code mismatch; expected cancel_requested, got "${cancelDoneCode ?? "none"}"`,
				)
			}
			if (followupDoneCode !== "responded" && followupDoneCode !== "queued") {
				throw new Error(
					`unexpected follow-up done code after cancel race; expected responded|queued, got "${followupDoneCode ?? "none"}"`,
				)
			}
			if (sawMessageControlError) {
				throw new Error("follow-up message emitted control error in cancel recovery race")
			}
			if (sawMisroutedToolResult) {
				throw new Error(
					"follow-up message was misrouted into tool_result (<user_message>) in cancel recovery race",
				)
			}
			if (!sawFollowupUserTurn) {
				throw new Error("follow-up after cancel did not appear as a normal user turn")
			}

			console.log(`[PASS] cancel done code: "${cancelDoneCode}"`)
			console.log(`[PASS] follow-up done code: "${followupDoneCode}"`)
			console.log(`[PASS] follow-up user turn observed: ${sawFollowupUserTurn}`)
			console.log(`[PASS] follow-up result: "${followupResult}"`)

			if (!sentShutdown) {
				context.sendCommand({
					command: "shutdown",
					requestId: shutdownRequestId,
				})
				sentShutdown = true
			}
		},
		onTimeoutMessage() {
			return [
				"timed out waiting for cancel-message-recovery-race validation",
				`initSeen=${initSeen}`,
				`sentCancelAndFollowup=${sentCancelAndFollowup}`,
				`cancelDoneCode=${cancelDoneCode ?? "none"}`,
				`followupDoneCode=${followupDoneCode ?? "none"}`,
				`sawFollowupUserTurn=${sawFollowupUserTurn}`,
				`sawMisroutedToolResult=${sawMisroutedToolResult}`,
				`sawMessageControlError=${sawMessageControlError}`,
				`haveFollowupResult=${Boolean(followupResult)}`,
			].join(" ")
		},
	})
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
