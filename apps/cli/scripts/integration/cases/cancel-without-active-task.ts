import { runStreamCase, StreamEvent } from "../lib/stream-harness"

async function main() {
	const cancelRequestId = `cancel-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let cancelAckSeen = false
	let cancelDoneSeen = false
	let shutdownSent = false

	await runStreamCase({
		onEvent(event: StreamEvent, context) {
			if (event.type === "system" && event.subtype === "init" && !initSeen) {
				initSeen = true
				context.sendCommand({
					command: "cancel",
					requestId: cancelRequestId,
				})
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "ack" &&
				event.command === "cancel" &&
				event.requestId === cancelRequestId
			) {
				cancelAckSeen = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "done" &&
				event.command === "cancel" &&
				event.requestId === cancelRequestId
			) {
				cancelDoneSeen = true

				if (event.code !== "no_active_task") {
					throw new Error(`cancel without task should return no_active_task, got "${event.code ?? "none"}"`)
				}
				if (event.success !== true) {
					throw new Error("cancel without task should be treated as successful no-op")
				}

				if (!shutdownSent) {
					context.sendCommand({
						command: "shutdown",
						requestId: shutdownRequestId,
					})
					shutdownSent = true
				}
				return
			}

			if (event.type === "control" && event.subtype === "error") {
				throw new Error(
					`unexpected control error command=${event.command ?? "unknown"} code=${event.code ?? "unknown"} content=${event.content ?? ""}`,
				)
			}
		},
		onTimeoutMessage() {
			return `timed out waiting for cancel-without-active-task validation (initSeen=${initSeen}, cancelAckSeen=${cancelAckSeen}, cancelDoneSeen=${cancelDoneSeen}, shutdownSent=${shutdownSent})`
		},
	})
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
