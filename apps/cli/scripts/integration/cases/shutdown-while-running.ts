import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const LONG_PROMPT =
	'Run exactly this command and do not summarize until it finishes: sleep 20 && echo "done". After it finishes, reply with exactly "done".'

async function main() {
	const startRequestId = `start-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let startAccepted = false
	let shutdownSent = false
	let shutdownAck = false
	let shutdownDone = false

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
					command: "shutdown",
					requestId: shutdownRequestId,
				})
				shutdownSent = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "ack" &&
				event.command === "shutdown" &&
				event.requestId === shutdownRequestId
			) {
				shutdownAck = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "done" &&
				event.command === "shutdown" &&
				event.requestId === shutdownRequestId
			) {
				shutdownDone = true
			}
		},
		onTimeoutMessage() {
			return `timed out waiting for shutdown flow (initSeen=${initSeen}, startAccepted=${startAccepted}, shutdownSent=${shutdownSent}, shutdownAck=${shutdownAck}, shutdownDone=${shutdownDone})`
		},
	})

	if (!shutdownAck || !shutdownDone) {
		throw new Error("shutdown control events were not fully observed")
	}
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
