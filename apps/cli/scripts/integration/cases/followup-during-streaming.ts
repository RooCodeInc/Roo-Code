import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const START_PROMPT = 'Answer this question and finish: What is 1+1? Reply with only "2", then complete the task.'
const FOLLOWUP_PROMPT = 'Different question now: what is 3+3? Reply with only "6".'

function looksLikeAttemptCompletionToolUse(event: StreamEvent): boolean {
	if (event.type !== "tool_use") {
		return false
	}

	if (event.tool_use?.name === "attempt_completion") {
		return true
	}

	const content = event.content ?? ""
	return content.includes('"tool":"attempt_completion"') || content.includes('"name":"attempt_completion"')
}

function validateFollowupAnswer(text: string): void {
	const normalized = text.toLowerCase()
	const hasSix = /\b6\b/.test(normalized) || normalized.includes("six")
	if (!hasSix) {
		throw new Error(`follow-up result did not answer follow-up prompt; result="${text}"`)
	}
}

async function main() {
	const startRequestId = `start-${Date.now()}`
	const followupRequestId = `message-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let sentFollowup = false
	let sentShutdown = false
	let sawAttemptCompletion = false
	let sawFollowupUserTurn = false
	let sawMisroutedToolResult = false
	let followupResult = ""
	let sawFirstAssistantChunkForStart = false

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

			if (!sawAttemptCompletion && looksLikeAttemptCompletionToolUse(event)) {
				sawAttemptCompletion = true
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

			if (
				event.type === "assistant" &&
				event.requestId === startRequestId &&
				event.done !== true &&
				!sawFirstAssistantChunkForStart
			) {
				sawFirstAssistantChunkForStart = true
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
			validateFollowupAnswer(followupResult)

			if (sawMisroutedToolResult) {
				throw new Error("follow-up message was misrouted into tool_result (<user_message>), old bug reproduced")
			}

			if (!sawFollowupUserTurn) {
				throw new Error("follow-up did not appear as a normal user turn in stream output")
			}

			console.log(`[PASS] saw attempt_completion tool use: ${sawAttemptCompletion}`)
			console.log(`[PASS] saw start assistant chunk before follow-up: ${sawFirstAssistantChunkForStart}`)
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
				"timed out waiting for follow-up validation",
				`initSeen=${initSeen}`,
				`sentFollowup=${sentFollowup}`,
				`sawAttemptCompletion=${sawAttemptCompletion}`,
				`sawFirstAssistantChunkForStart=${sawFirstAssistantChunkForStart}`,
				`sawFollowupUserTurn=${sawFollowupUserTurn}`,
				`sawMisroutedToolResult=${sawMisroutedToolResult}`,
				`haveFollowupResult=${Boolean(followupResult)}`,
			].join(" ")
		},
	})
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
