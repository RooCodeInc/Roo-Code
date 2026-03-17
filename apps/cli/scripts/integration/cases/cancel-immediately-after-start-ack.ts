import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const LONG_PROMPT =
	'Run exactly this command and do not summarize until it finishes: sleep 12 && echo "done". After it finishes, reply with exactly "done".'

async function main() {
	const startRequestId = `start-${Date.now()}`
	const cancelRequestId = `cancel-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let startAccepted = false
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
				event.requestId === startRequestId &&
				!startAccepted
			) {
				startAccepted = true
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
					if (!sentShutdown) {
						context.sendCommand({
							command: "shutdown",
							requestId: shutdownRequestId,
						})
						sentShutdown = true
					}
				}
				return
			}

			if (event.type === "error") {
				throw new Error(`unexpected stream error event: ${event.content ?? "unknown error"}`)
			}
		},
		onTimeoutMessage() {
			return `timed out waiting for immediate-cancel flow (initSeen=${initSeen}, startAccepted=${startAccepted}, sentCancel=${sentCancel}, cancelDone=${cancelDone}, sentShutdown=${sentShutdown})`
		},
	})

	if (!startAccepted || !sentCancel || !cancelDone || !sentShutdown) {
		throw new Error(
			`immediate-cancel flow did not complete expected transitions (startAccepted=${startAccepted}, sentCancel=${sentCancel}, cancelDone=${cancelDone}, sentShutdown=${sentShutdown})`,
		)
	}
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
