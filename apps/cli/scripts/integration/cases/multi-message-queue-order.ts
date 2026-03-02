import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const LONG_PROMPT =
	'Run exactly this command and do not summarize until it finishes: sleep 6 && echo "done". After it finishes, reply with exactly "done".'
const MESSAGE_ONE_PROMPT = 'For this follow-up, reply with only "ALPHA".'
const MESSAGE_TWO_PROMPT = 'For this follow-up, reply with only "BETA".'

async function main() {
	const startRequestId = `start-${Date.now()}`
	const firstMessageRequestId = `message-a-${Date.now()}`
	const secondMessageRequestId = `message-b-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let startAccepted = false
	let sentQueuedMessages = false
	let sentShutdown = false

	let firstMessageAccepted = false
	let secondMessageAccepted = false
	let firstMessageQueued = false
	let secondMessageQueued = false

	const resultOrder: string[] = []
	let queueDequeuedByFirst = false
	let queueDrainedBySecond = false
	let firstResultSeen = false
	let secondResultSeen = false

	await runStreamCase({
		timeoutMs: 180_000,
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
					command: "message",
					requestId: firstMessageRequestId,
					prompt: MESSAGE_ONE_PROMPT,
				})
				context.sendCommand({
					command: "message",
					requestId: secondMessageRequestId,
					prompt: MESSAGE_TWO_PROMPT,
				})
				sentQueuedMessages = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "ack" &&
				event.command === "message" &&
				event.requestId === firstMessageRequestId
			) {
				firstMessageAccepted = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "ack" &&
				event.command === "message" &&
				event.requestId === secondMessageRequestId
			) {
				secondMessageAccepted = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "done" &&
				event.command === "message" &&
				event.requestId === firstMessageRequestId &&
				event.code === "queued"
			) {
				firstMessageQueued = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "done" &&
				event.command === "message" &&
				event.requestId === secondMessageRequestId &&
				event.code === "queued"
			) {
				secondMessageQueued = true
				return
			}

			if (
				event.type === "queue" &&
				event.subtype === "dequeued" &&
				event.requestId === firstMessageRequestId &&
				event.queueDepth === 1
			) {
				queueDequeuedByFirst = true
				return
			}

			if (
				event.type === "queue" &&
				event.subtype === "drained" &&
				event.requestId === secondMessageRequestId &&
				event.queueDepth === 0
			) {
				queueDrainedBySecond = true
				return
			}

			if (event.type === "result" && event.done === true) {
				if (event.requestId === firstMessageRequestId) {
					firstResultSeen = true
					resultOrder.push(firstMessageRequestId)
				}
				if (event.requestId === secondMessageRequestId) {
					secondResultSeen = true
					resultOrder.push(secondMessageRequestId)
				}
			}

			if (!firstResultSeen || !secondResultSeen || sentShutdown) {
				return
			}

			const expectedOrder = [firstMessageRequestId, secondMessageRequestId].join(",")
			if (resultOrder.join(",") !== expectedOrder) {
				throw new Error(
					`queued message result order mismatch; expected=${expectedOrder} actual=${resultOrder.join(",")}`,
				)
			}

			context.sendCommand({
				command: "shutdown",
				requestId: shutdownRequestId,
			})
			sentShutdown = true
		},
		onTimeoutMessage() {
			return `timed out waiting for queued message order validation (initSeen=${initSeen}, startAccepted=${startAccepted}, sentQueuedMessages=${sentQueuedMessages}, firstMessageAccepted=${firstMessageAccepted}, secondMessageAccepted=${secondMessageAccepted}, firstMessageQueued=${firstMessageQueued}, secondMessageQueued=${secondMessageQueued}, queueDequeuedByFirst=${queueDequeuedByFirst}, queueDrainedBySecond=${queueDrainedBySecond}, resultOrder=${resultOrder.join(" -> ")}, firstResultSeen=${firstResultSeen}, secondResultSeen=${secondResultSeen})`
		},
	})

	if (
		!firstMessageAccepted ||
		!secondMessageAccepted ||
		!firstMessageQueued ||
		!secondMessageQueued ||
		!queueDequeuedByFirst ||
		!queueDrainedBySecond
	) {
		throw new Error(
			`expected both queued messages to be accepted/queued and queue transitions observed (firstMessageAccepted=${firstMessageAccepted}, secondMessageAccepted=${secondMessageAccepted}, firstMessageQueued=${firstMessageQueued}, secondMessageQueued=${secondMessageQueued}, queueDequeuedByFirst=${queueDequeuedByFirst}, queueDrainedBySecond=${queueDrainedBySecond})`,
		)
	}

	const expectedOrder = [firstMessageRequestId, secondMessageRequestId].join(",")
	if (resultOrder.join(",") !== expectedOrder) {
		throw new Error(
			`queued message result order mismatch; expected=${expectedOrder} actual=${resultOrder.join(",")}`,
		)
	}
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
