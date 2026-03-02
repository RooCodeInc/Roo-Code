import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const LONG_PROMPT =
	'Run exactly this command and do not summarize until it finishes: sleep 12 && echo "done". After it finishes, reply with exactly "done".'

async function main() {
	const startRequestId = `start-a-${Date.now()}`
	const cancelRequestId = `cancel-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let startAccepted = false
	let startCommandToolUseSeen = false
	let sentCancel = false
	let cancelDone = false
	let sentShutdown = false

	await runStreamCase({
		onEvent(event: StreamEvent, context) {
			if (event.type === "system" && event.subtype === "init" && !initSeen) {
				initSeen = true
				context.sendCommand({
					command: "start",
					requestId: startRequestId,
					prompt: LONG_PROMPT,
				})
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "ack" &&
				event.command === "start" &&
				event.requestId === startRequestId
			) {
				startAccepted = true
				return
			}

			if (
				event.type === "tool_use" &&
				event.subtype === "command" &&
				event.done === true &&
				event.requestId === startRequestId
			) {
				startCommandToolUseSeen = true
			}

			if (startAccepted && startCommandToolUseSeen && !sentCancel) {
				context.sendCommand({
					command: "cancel",
					requestId: cancelRequestId,
				})
				sentCancel = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "done" &&
				event.command === "cancel" &&
				event.requestId === cancelRequestId
			) {
				if (event.code === "cancel_requested" || event.code === "no_active_task") {
					cancelDone = true
				}
				return
			}

			if (cancelDone && !sentShutdown) {
				context.sendCommand({
					command: "shutdown",
					requestId: shutdownRequestId,
				})
				sentShutdown = true
				return
			}

			if (event.type === "control" && event.subtype === "error" && event.requestId === cancelRequestId) {
				throw new Error(
					`cancel command failed with code=${event.code ?? "unknown"} content="${event.content ?? ""}"`,
				)
			}

			if (event.type === "error") {
				throw new Error(`unexpected stream error event: ${event.content ?? "unknown error"}`)
			}
		},
		onTimeoutMessage() {
			return `timed out waiting for cancel flow (initSeen=${initSeen}, startAccepted=${startAccepted}, startCommandToolUseSeen=${startCommandToolUseSeen}, sentCancel=${sentCancel}, cancelDone=${cancelDone}, sentShutdown=${sentShutdown})`
		},
	})

	if (!startAccepted || !startCommandToolUseSeen || !sentCancel || !cancelDone || !sentShutdown) {
		throw new Error(
			`cancel flow did not complete expected transitions (startAccepted=${startAccepted}, startCommandToolUseSeen=${startCommandToolUseSeen}, sentCancel=${sentCancel}, cancelDone=${cancelDone}, sentShutdown=${sentShutdown})`,
		)
	}
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
