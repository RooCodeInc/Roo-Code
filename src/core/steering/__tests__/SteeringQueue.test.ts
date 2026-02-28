import { SteeringQueue } from "../SteeringQueue"

describe("SteeringQueue", () => {
	let queue: SteeringQueue

	beforeEach(() => {
		queue = new SteeringQueue()
	})

	describe("enqueue", () => {
		it("should add advice to the queue", () => {
			queue.enqueue("Use Vitest instead of Jest")
			expect(queue.size).toBe(1)
			expect(queue.hasPending).toBe(true)
		})

		it("should ignore empty or whitespace-only advice", () => {
			queue.enqueue("")
			queue.enqueue("   ")
			expect(queue.size).toBe(0)
			expect(queue.hasPending).toBe(false)
		})

		it("should trim advice text", () => {
			queue.enqueue("  Use Vitest  ")
			const result = queue.drain()
			expect(result).toContain("Use Vitest")
			expect(result).not.toContain("  Use Vitest  ")
		})

		it("should drop oldest item when at capacity (5)", () => {
			for (let i = 1; i <= 6; i++) {
				queue.enqueue(`Advice ${i}`)
			}
			expect(queue.size).toBe(5)
			const result = queue.drain()!
			expect(result).not.toContain("Advice 1")
			expect(result).toContain("Advice 2")
			expect(result).toContain("Advice 6")
		})
	})

	describe("drain", () => {
		it("should return undefined when empty", () => {
			expect(queue.drain()).toBeUndefined()
		})

		it("should return formatted injection text", () => {
			queue.enqueue("Use Vitest instead of Jest")
			queue.enqueue("Use UTF-8 encoding")
			const result = queue.drain()!

			expect(result).toContain("<steering_advice>")
			expect(result).toContain("</steering_advice>")
			expect(result).toContain("1. Use Vitest instead of Jest")
			expect(result).toContain("2. Use UTF-8 encoding")
		})

		it("should clear the queue after draining", () => {
			queue.enqueue("Some advice")
			queue.drain()
			expect(queue.size).toBe(0)
			expect(queue.hasPending).toBe(false)
			expect(queue.drain()).toBeUndefined()
		})

		it("should skip expired advice (older than 5 minutes)", () => {
			queue.enqueue("Old advice")

			// Manually expire the item by backdating its timestamp
			const internalQueue = (queue as any).queue as Array<{ text: string; timestamp: number }>
			internalQueue[0].timestamp = Date.now() - 6 * 60 * 1000 // 6 min ago

			queue.enqueue("Fresh advice")

			const result = queue.drain()!
			expect(result).not.toContain("Old advice")
			expect(result).toContain("Fresh advice")
		})

		it("should return undefined when all advice is expired", () => {
			queue.enqueue("Stale advice")
			const internalQueue = (queue as any).queue as Array<{ text: string; timestamp: number }>
			internalQueue[0].timestamp = Date.now() - 6 * 60 * 1000

			expect(queue.drain()).toBeUndefined()
			expect(queue.size).toBe(0)
		})
	})

	describe("clear", () => {
		it("should remove all pending advice", () => {
			queue.enqueue("Advice 1")
			queue.enqueue("Advice 2")
			queue.clear()
			expect(queue.size).toBe(0)
			expect(queue.hasPending).toBe(false)
		})
	})

	describe("zero-overhead path", () => {
		it("should have no overhead when empty (drain returns undefined)", () => {
			// This verifies the zero-overhead contract: when no advice is pending,
			// drain() returns undefined and no injection text is generated.
			expect(queue.drain()).toBeUndefined()
			expect(queue.hasPending).toBe(false)
		})
	})
})
