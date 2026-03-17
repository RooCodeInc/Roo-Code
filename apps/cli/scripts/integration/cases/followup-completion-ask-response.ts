import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const START_PROMPT = 'Answer this question and finish: What is 1+1? Reply with only "2", then complete the task.'
const FOLLOWUP_PROMPT = 'Different question now: what is 3+3? Reply with only "6".'

async function main() {
	const startRequestId = `start-${Date.now()}`
	const followupRequestId = `message-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let sentFollowup = false
	let sentShutdown = false
	let startAckCount = 0
	let sawStartControlAfterFollowup = false
	let followupDoneCode: string | undefined
	let sawFollowupUserTurn = false
	let sawMisroutedToolResult = false
	let sawQueueEventForFollowupRequest = false
	let followupResult = ""

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
				throw new Error(
					`received control error for requestId=${event.requestId ?? "unknown"} command=${event.command ?? "unknown"} code=${event.code ?? "unknown"} content=${event.content ?? ""}`,
				)
			}

			if (event.type === "control" && event.command === "start" && event.subtype === "ack") {
				startAckCount += 1
				if (sentFollowup) {
					sawStartControlAfterFollowup = true
				}
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

			if (event.type === "queue" && event.requestId === followupRequestId) {
				sawQueueEventForFollowupRequest = true
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

			if (event.type === "result" && event.done === true && event.requestId === startRequestId && !sentFollowup) {
				context.sendCommand({
					command: "message",
					requestId: followupRequestId,
					prompt: FOLLOWUP_PROMPT,
				})
				sentFollowup = true
				return
			}

			if (event.type !== "result" || event.done !== true || event.requestId !== followupRequestId) {
				return
			}

			followupResult = event.content ?? ""
			if (followupResult.trim().length === 0) {
				throw new Error("follow-up produced an empty result")
			}

			if (followupDoneCode !== "responded") {
				throw new Error(
					`follow-up message was not routed as ask response; code="${followupDoneCode ?? "none"}"`,
				)
			}

			if (sawMisroutedToolResult) {
				throw new Error("follow-up message was misrouted into tool_result (<user_message>), old bug reproduced")
			}
			if (sawQueueEventForFollowupRequest) {
				throw new Error("follow-up message produced queue events despite responded routing")
			}

			if (!sawFollowupUserTurn) {
				throw new Error("follow-up did not appear as a normal user turn in stream output")
			}

			if (sawStartControlAfterFollowup) {
				throw new Error("unexpected start control event after follow-up; message should not trigger a new task")
			}

			if (startAckCount !== 1) {
				throw new Error(`expected exactly one start ack event, saw ${startAckCount}`)
			}

			console.log(`[PASS] follow-up control code: "${followupDoneCode}"`)
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
				"timed out waiting for completion ask-response follow-up validation",
				`initSeen=${initSeen}`,
				`sentFollowup=${sentFollowup}`,
				`startAckCount=${startAckCount}`,
				`followupDoneCode=${followupDoneCode ?? "none"}`,
				`sawFollowupUserTurn=${sawFollowupUserTurn}`,
				`sawMisroutedToolResult=${sawMisroutedToolResult}`,
				`sawQueueEventForFollowupRequest=${sawQueueEventForFollowupRequest}`,
				`haveFollowupResult=${Boolean(followupResult)}`,
			].join(" ")
		},
	})
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
