import { MessageQueueService } from "../../message-queue/MessageQueueService"

/**
 * Tests for the mid-task message injection feature.
 *
 * When a user queues messages while the agent is working,
 * they should be drained and injected into the next API call's
 * user content as [USER_MID_TASK_MESSAGE] blocks.
 *
 * This test validates the drain-and-inject logic in isolation,
 * using the same MessageQueueService that Task.ts uses.
 */
describe("Mid-task message injection", () => {
	let queue: MessageQueueService

	beforeEach(() => {
		queue = new MessageQueueService()
	})

	afterEach(() => {
		queue.dispose()
	})

	/**
	 * Simulates the drain-and-inject logic from Task.ts L2647-2666.
	 * Returns the injection text block if any messages were queued,
	 * or undefined if the queue was empty.
	 */
	function drainAndBuildInjection(mqs: MessageQueueService): string | undefined {
		if (mqs.isEmpty()) {
			return undefined
		}

		const queuedTexts: string[] = []

		while (!mqs.isEmpty()) {
			const msg = mqs.dequeueMessage()

			if (msg?.text) {
				queuedTexts.push(msg.text)
			}
		}

		if (queuedTexts.length === 0) {
			return undefined
		}

		return (
			"\n[USER_MID_TASK_MESSAGE]\nThe user has sent the following message(s) while you were working. " +
			"Please acknowledge and incorporate this feedback into your current task:\n" +
			queuedTexts.join("\n") +
			"\n[/USER_MID_TASK_MESSAGE]"
		)
	}

	it("returns undefined when queue is empty", () => {
		const result = drainAndBuildInjection(queue)
		expect(result).toBeUndefined()
	})

	it("injects a single queued message with correct tags", () => {
		queue.addMessage("use TypeScript instead of JavaScript")
		const result = drainAndBuildInjection(queue)

		expect(result).toBeDefined()
		expect(result).toContain("[USER_MID_TASK_MESSAGE]")
		expect(result).toContain("use TypeScript instead of JavaScript")
		expect(result).toContain("[/USER_MID_TASK_MESSAGE]")
	})

	it("injects multiple queued messages in order", () => {
		queue.addMessage("first advice")
		queue.addMessage("second advice")
		queue.addMessage("third advice")
		const result = drainAndBuildInjection(queue)

		expect(result).toBeDefined()
		expect(result).toContain("first advice")
		expect(result).toContain("second advice")
		expect(result).toContain("third advice")

		// Verify order: first should appear before second
		const firstIndex = result!.indexOf("first advice")
		const secondIndex = result!.indexOf("second advice")
		const thirdIndex = result!.indexOf("third advice")
		expect(firstIndex).toBeLessThan(secondIndex)
		expect(secondIndex).toBeLessThan(thirdIndex)
	})

	it("drains the queue completely after injection", () => {
		queue.addMessage("some advice")
		queue.addMessage("more advice")

		drainAndBuildInjection(queue)

		expect(queue.isEmpty()).toBe(true)
		// Second drain should return undefined
		expect(drainAndBuildInjection(queue)).toBeUndefined()
	})

	it("does not interfere with messages queued after drain", () => {
		queue.addMessage("before drain")
		drainAndBuildInjection(queue)

		// Simulate new message arriving after drain (during API call)
		queue.addMessage("after drain")
		expect(queue.isEmpty()).toBe(false)

		const result = drainAndBuildInjection(queue)
		expect(result).toContain("after drain")
		expect(result).not.toContain("before drain")
	})
})
