import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const LONG_PROMPT =
	'Run exactly this command and do not summarize until it finishes: sleep 8 && echo "done". After it finishes, reply with exactly "done".'

async function main() {
	const firstStartRequestId = `start-a-${Date.now()}`
	const secondStartRequestId = `start-b-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let firstStartAccepted = false
	let secondStartSent = false
	let sawTaskBusyError = false
	let sentShutdown = false

	await runStreamCase({
		onEvent(event: StreamEvent, context) {
			if (event.type === "system" && event.subtype === "init" && !initSeen) {
				initSeen = true
				context.sendCommand({
					command: "start",
					requestId: firstStartRequestId,
					prompt: LONG_PROMPT,
				})
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "ack" &&
				event.command === "start" &&
				event.requestId === firstStartRequestId &&
				!firstStartAccepted
			) {
				firstStartAccepted = true
				context.sendCommand({
					command: "start",
					requestId: secondStartRequestId,
					prompt: "What is 1+1? Reply with only 2.",
				})
				secondStartSent = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "error" &&
				event.command === "start" &&
				event.requestId === secondStartRequestId &&
				event.code === "task_busy"
			) {
				sawTaskBusyError = true
				if (!sentShutdown) {
					context.sendCommand({
						command: "shutdown",
						requestId: shutdownRequestId,
					})
					sentShutdown = true
				}
				return
			}
		},
		onTimeoutMessage() {
			return `timed out waiting for task_busy error (initSeen=${initSeen}, firstStartAccepted=${firstStartAccepted}, secondStartSent=${secondStartSent}, sawTaskBusyError=${sawTaskBusyError})`
		},
	})

	if (!sawTaskBusyError) {
		throw new Error("expected task_busy error for second start command was not observed")
	}
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
