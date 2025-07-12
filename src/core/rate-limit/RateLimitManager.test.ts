import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { RateLimitManager } from "./RateLimitManager"
import { TaskStateLock } from "../task/TaskStateLock"

describe("RateLimitManager", () => {
	let rateLimitManager: RateLimitManager

	beforeEach(() => {
		rateLimitManager = new RateLimitManager("test_rate_limit")
	})

	afterEach(() => {
		rateLimitManager.reset()
	})

	test("updateLastRequestTime sets current timestamp", async () => {
		const before = Date.now()
		await rateLimitManager.updateLastRequestTime()
		const after = Date.now()

		const retrieved = await rateLimitManager.getLastRequestTime()
		expect(retrieved).not.toBeNull()
		expect(retrieved!).toBeGreaterThanOrEqual(before)
		expect(retrieved!).toBeLessThanOrEqual(after)
	})

	test("getLastRequestTime returns null when not set", async () => {
		const result = await rateLimitManager.getLastRequestTime()
		expect(result).toBeNull()
	})

	test("calculateDelay returns 0 when no previous request", async () => {
		const delay = await rateLimitManager.calculateDelay(5)
		expect(delay).toBe(0)
	})

	test("calculateDelay calculates correct delay", async () => {
		// Set a request time 2 seconds ago
		const now = Date.now()
		const twoSecondsAgo = now - 2000

		// Update with specific timestamp
		await rateLimitManager.updateLastRequestTime(twoSecondsAgo)

		// With 5 second rate limit, should need to wait ~3 more seconds
		const delay = await rateLimitManager.calculateDelay(5)
		expect(delay).toBeGreaterThanOrEqual(2900)
		expect(delay).toBeLessThanOrEqual(3100) // Allow some timing variance
	})

	test("calculateDelay returns 0 when enough time has passed", async () => {
		// Set a request time 10 seconds ago
		const tenSecondsAgo = Date.now() - 10000

		await rateLimitManager.updateLastRequestTime(tenSecondsAgo)

		// With 5 second rate limit, no delay needed
		const delay = await rateLimitManager.calculateDelay(5)
		expect(delay).toBe(0)
	})

	test("reset clears the timestamp", async () => {
		// Set a timestamp
		await rateLimitManager.updateLastRequestTime()
		expect(await rateLimitManager.getLastRequestTime()).not.toBeNull()

		// Reset should clear it
		rateLimitManager.reset()
		expect(await rateLimitManager.getLastRequestTime()).toBeNull()
	})

	test("concurrent operations maintain consistency", async () => {
		const promises = []

		// Start multiple concurrent operations
		for (let i = 0; i < 10; i++) {
			promises.push(rateLimitManager.updateLastRequestTime())
		}

		await Promise.all(promises)

		// The final timestamp should be stored
		const stored = await rateLimitManager.getLastRequestTime()
		expect(stored).not.toBeNull()
	})

	test("thread safety with TaskStateLock", async () => {
		const taskStateLock = new TaskStateLock()
		const manager = new RateLimitManager("test_concurrent", taskStateLock)

		// Simulate concurrent access
		const operations = []
		const timestamps: number[] = []

		for (let i = 0; i < 5; i++) {
			operations.push(
				(async () => {
					await manager.updateLastRequestTime()
					const time = await manager.getLastRequestTime()
					if (time !== null) {
						timestamps.push(time)
					}
				})(),
			)
		}

		await Promise.all(operations)

		// All operations should have completed
		expect(timestamps.length).toBeGreaterThan(0)

		// The stored timestamp should be one of the recorded ones
		const finalTime = await manager.getLastRequestTime()
		expect(finalTime).not.toBeNull()
		expect(timestamps).toContain(finalTime!)
	})

	test("hasActiveRateLimit returns correct status", async () => {
		// Initially no rate limit
		expect(await rateLimitManager.hasActiveRateLimit()).toBe(false)

		// After setting timestamp
		await rateLimitManager.updateLastRequestTime()
		expect(await rateLimitManager.hasActiveRateLimit()).toBe(true)

		// After reset
		rateLimitManager.reset()
		expect(await rateLimitManager.hasActiveRateLimit()).toBe(false)
	})

	test("calculateRateLimitDelay returns delay in seconds", async () => {
		// Set a request time 2 seconds ago
		const now = Date.now()
		const twoSecondsAgo = now - 2000

		await rateLimitManager.updateLastRequestTime(twoSecondsAgo)

		// With 5 second rate limit, should need to wait ~3 more seconds
		const delaySeconds = await rateLimitManager.calculateRateLimitDelay(5)
		expect(delaySeconds).toBe(3)
	})
})
