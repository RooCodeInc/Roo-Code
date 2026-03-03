import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const START_PROMPT = 'Answer this question and finish: What is 1+1? Reply with only "2", then complete the task.'
const FOLLOWUP_PROMPT = 'Different question now: what is 3+3? Reply with only "6".'
const ONE_PIXEL_IMAGE =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9R4WQAAAAASUVORK5CYII="

async function main() {
	const startRequestId = `start-${Date.now()}`
	const followupRequestId = `message-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let sentFollowup = false
	let sentShutdown = false
	let followupDoneCode: string | undefined
	let sawFollowupUserTurn = false
	let sawMisroutedToolResult = false
	let sawQueueImageMetadata = false
	let shutdownDoneSeen = false

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

			if (
				event.type === "control" &&
				event.command === "message" &&
				event.subtype === "done" &&
				event.requestId === followupRequestId
			) {
				followupDoneCode = event.code
				if (!sentShutdown) {
					context.sendCommand({
						command: "shutdown",
						requestId: shutdownRequestId,
					})
					sentShutdown = true
				}
				return
			}

			if (
				event.type === "control" &&
				event.command === "shutdown" &&
				event.subtype === "done" &&
				event.requestId === shutdownRequestId
			) {
				shutdownDoneSeen = true

				if (followupDoneCode !== "responded") {
					throw new Error(
						`follow-up image message was not routed as ask response; code="${followupDoneCode ?? "none"}"`,
					)
				}
				if (sawQueueImageMetadata) {
					throw new Error("follow-up image message was unexpectedly queued (observed queue image metadata)")
				}
				if (sawMisroutedToolResult) {
					throw new Error("follow-up image message was misrouted into tool_result (<user_message>)")
				}

				console.log(`[PASS] follow-up image control code: "${followupDoneCode}"`)
				console.log(`[PASS] follow-up image user turn observed before shutdown: ${sawFollowupUserTurn}`)
				return
			}

			if (
				event.type === "queue" &&
				Array.isArray(event.queue) &&
				event.queue.some((item) => item?.imageCount === 1)
			) {
				sawQueueImageMetadata = true
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
					images: [ONE_PIXEL_IMAGE],
				})
				sentFollowup = true
				return
			}
		},
		onTimeoutMessage() {
			return [
				"timed out waiting for followup-completion-ask-response-images validation",
				`initSeen=${initSeen}`,
				`sentFollowup=${sentFollowup}`,
				`sentShutdown=${sentShutdown}`,
				`shutdownDoneSeen=${shutdownDoneSeen}`,
				`followupDoneCode=${followupDoneCode ?? "none"}`,
				`sawFollowupUserTurn=${sawFollowupUserTurn}`,
				`sawMisroutedToolResult=${sawMisroutedToolResult}`,
				`sawQueueImageMetadata=${sawQueueImageMetadata}`,
			].join(" ")
		},
	})
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
