import { runStreamCase, StreamEvent } from "../lib/stream-harness"

async function main() {
	const messageRequestId = `message-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`
	let initSeen = false
	let sawNoActiveTaskError = false
	let sentShutdown = false

	await runStreamCase({
		onEvent(event: StreamEvent, context) {
			if (event.type === "system" && event.subtype === "init" && !initSeen) {
				initSeen = true
				context.sendCommand({
					command: "message",
					requestId: messageRequestId,
					prompt: "Hello",
				})
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "error" &&
				event.requestId === messageRequestId &&
				event.code === "no_active_task"
			) {
				sawNoActiveTaskError = true
				if (!sentShutdown) {
					context.sendCommand({
						command: "shutdown",
						requestId: shutdownRequestId,
					})
					sentShutdown = true
				}
			}
		},
		onTimeoutMessage() {
			return `timed out waiting for no_active_task error (initSeen=${initSeen}, sawNoActiveTaskError=${sawNoActiveTaskError})`
		},
	})

	if (!sawNoActiveTaskError) {
		throw new Error("expected no_active_task error was not observed")
	}
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
