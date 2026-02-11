import { describe, test, expect, vi, beforeEach } from "vitest"
import { SelfCleaningPromiseHolder } from "../selfCleaningPromiseHolder"

describe("SelfCleaningPromiseHolder", () => {
	let holder: SelfCleaningPromiseHolder<number>

	beforeEach(() => {
		holder = new SelfCleaningPromiseHolder<number>()
	})

	describe("add()", () => {
		test("should add a promise and track it", () => {
			const promise = Promise.resolve(42)
			holder.add(promise)
			expect(holder.size).toBe(1)
		})

		test("should add multiple promises and track them", () => {
			holder.add(Promise.resolve(1))
			holder.add(Promise.resolve(2))
			holder.add(Promise.resolve(3))
			expect(holder.size).toBe(3)
		})

		test("should automatically remove completed promises", async () => {
			const promise = Promise.resolve(42)
			holder.add(promise)
			expect(holder.size).toBe(1)

			await promise
			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})

		test("should automatically remove rejected promises", async () => {
			let reject: (reason: Error) => void
			const promise = new Promise<number>((_, r) => (reject = r))
			holder.add(promise)
			expect(holder.size).toBe(1)

			reject!(new Error("test error"))
			try {
				await promise
			} catch {
				// Expected rejection
			}
			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})

		test("should work with different promise types", async () => {
			const stringHolder = new SelfCleaningPromiseHolder<string>()
			const promise = Promise.resolve("hello")
			stringHolder.add(promise)
			expect(stringHolder.size).toBe(1)

			await promise
			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(stringHolder.size).toBe(0)
		})

		test("should work with unknown type by default", async () => {
			const unknownHolder = new SelfCleaningPromiseHolder()
			const promise = Promise.resolve({ foo: "bar" })
			unknownHolder.add(promise)
			expect(unknownHolder.size).toBe(1)

			await promise
			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(unknownHolder.size).toBe(0)
		})
	})

	describe("size getter", () => {
		test("should return 0 for empty holder", () => {
			expect(holder.size).toBe(0)
		})

		test("should return the count of active promises", () => {
			holder.add(Promise.resolve(1))
			holder.add(Promise.resolve(2))
			holder.add(Promise.resolve(3))
			expect(holder.size).toBe(3)
		})

		test("should decrease as promises complete", async () => {
			let resolve1: (value: number) => void
			let resolve2: (value: number) => void
			let resolve3: (value: number) => void

			const promise1 = new Promise<number>((r) => (resolve1 = r))
			const promise2 = new Promise<number>((r) => (resolve2 = r))
			const promise3 = new Promise<number>((r) => (resolve3 = r))

			holder.add(promise1)
			holder.add(promise2)
			holder.add(promise3)
			expect(holder.size).toBe(3)

			resolve1!(1)
			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(2)

			resolve2!(2)
			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(1)

			resolve3!(3)
			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})
	})

	describe("waitForAll()", () => {
		test("should resolve immediately when holder is empty", async () => {
			await expect(holder.waitForAll()).resolves.toBeUndefined()
		})

		test("should wait for all promises to complete", async () => {
			let resolve1: (value: number) => void
			let resolve2: (value: number) => void
			let resolve3: (value: number) => void

			const promise1 = new Promise<number>((r) => (resolve1 = r))
			const promise2 = new Promise<number>((r) => (resolve2 = r))
			const promise3 = new Promise<number>((r) => (resolve3 = r))

			holder.add(promise1)
			holder.add(promise2)
			holder.add(promise3)

			expect(holder.size).toBe(3)

			// Start waiting for all promises
			const waitForAllPromise = holder.waitForAll()

			// Resolve promises one by one
			resolve1!(1)
			await new Promise((resolve) => setTimeout(resolve, 10))
			expect(holder.size).toBe(2)

			resolve2!(2)
			await new Promise((resolve) => setTimeout(resolve, 10))
			expect(holder.size).toBe(1)

			resolve3!(3)
			await new Promise((resolve) => setTimeout(resolve, 10))
			expect(holder.size).toBe(0)

			// waitForAll should resolve
			await expect(waitForAllPromise).resolves.toBeUndefined()
		})

		test("should wait for all promises even if some reject", async () => {
			let resolve1: (value: number) => void
			let reject2: (reason: Error) => void
			let resolve3: (value: number) => void

			const promise1 = new Promise<number>((r) => (resolve1 = r))
			const promise2 = new Promise<number>((_, r) => (reject2 = r))
			const promise3 = new Promise<number>((r) => (resolve3 = r))

			holder.add(promise1)
			holder.add(promise2)
			holder.add(promise3)

			const waitForAllPromise = holder.waitForAll()

			// Resolve/reject promises
			resolve1!(1)
			reject2!(new Error("test error"))
			resolve3!(3)

			// waitForAll should reject because one promise rejected
			await expect(waitForAllPromise).rejects.toThrow("test error")

			// Wait a tick for the finally handlers to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})

		test("should only wait for promises active at call time", async () => {
			let resolve1: (value: number) => void
			let resolve2: (value: number) => void

			const promise1 = new Promise<number>((r) => (resolve1 = r))
			const promise2 = new Promise<number>((r) => (resolve2 = r))

			holder.add(promise1)

			// Start waiting for all promises (only promise1 is active)
			const waitForAllPromise = holder.waitForAll()

			// Add another promise after waitForAll was called
			holder.add(promise2)

			// Resolve both promises
			resolve1!(1)
			resolve2!(2)

			// waitForAll should resolve (only waited for promise1)
			await expect(waitForAllPromise).resolves.toBeUndefined()

			// Wait a tick for the finally handlers to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})
	})

	describe("waitForOne()", () => {
		test("should resolve immediately when holder is empty", async () => {
			await expect(holder.waitForOne()).resolves.toBeUndefined()
		})

		test("should wait for at least one promise to complete", async () => {
			let resolve1: (value: number) => void
			let resolve2: (value: number) => void

			const promise1 = new Promise<number>((r) => (resolve1 = r))
			const promise2 = new Promise<number>((r) => (resolve2 = r))

			holder.add(promise1)
			holder.add(promise2)

			expect(holder.size).toBe(2)

			// Start waiting for one promise
			const waitForOnePromise = holder.waitForOne()

			// Resolve the first promise
			resolve1!(1)

			// waitForOne should resolve
			await expect(waitForOnePromise).resolves.toBeUndefined()

			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(1)
		})

		test("should resolve when the first promise rejects", async () => {
			let reject1: (reason: Error) => void
			let resolve2: (value: number) => void

			const promise1 = new Promise<number>((_, r) => (reject1 = r))
			const promise2 = new Promise<number>((r) => (resolve2 = r))

			holder.add(promise1)
			holder.add(promise2)

			const waitForOnePromise = holder.waitForOne()

			// Reject the first promise
			reject1!(new Error("test error"))

			// waitForOne should reject because Promise.race propagates rejection
			await expect(waitForOnePromise).rejects.toThrow("test error")

			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(1)
		})

		test("should resolve with the fastest promise", async () => {
			let resolve1: (value: number) => void
			let resolve2: (value: number) => void

			const promise1 = new Promise<number>((r) => (resolve1 = r))
			const promise2 = new Promise<number>((r) => (resolve2 = r))

			holder.add(promise1)
			holder.add(promise2)

			const waitForOnePromise = holder.waitForOne()

			// Resolve the second promise first
			resolve2!(2)

			// waitForOne should resolve
			await expect(waitForOnePromise).resolves.toBeUndefined()

			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(1)

			// Resolve the first promise
			resolve1!(1)
		})
	})

	describe("edge cases", () => {
		test("should handle adding the same promise multiple times", async () => {
			const promise = Promise.resolve(42)
			holder.add(promise)
			holder.add(promise)
			holder.add(promise)

			// The same promise is added multiple times, but Set deduplicates
			expect(holder.size).toBe(1)

			await promise
			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})

		test("should handle rapid addition and completion of promises", async () => {
			const promises: Promise<number>[] = []

			for (let i = 0; i < 100; i++) {
				const promise = Promise.resolve(i)
				promises.push(promise)
				holder.add(promise)
			}

			expect(holder.size).toBe(100)

			// Wait for all to complete
			await Promise.all(promises)
			// Wait a tick for the finally handlers to execute
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(holder.size).toBe(0)
		})

		test("should handle promises that never resolve (in a test scenario)", async () => {
			let resolve1: (value: number) => void
			let resolve2: (value: number) => void

			const promise1 = new Promise<number>((r) => (resolve1 = r))
			const promise2 = new Promise<number>((r) => (resolve2 = r))

			holder.add(promise1)
			holder.add(promise2)

			expect(holder.size).toBe(2)

			// Resolve one promise
			resolve1!(1)

			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(1)

			// Resolve the other promise
			resolve2!(2)

			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})

		test("should handle mixed resolved and rejected promises", async () => {
			let reject: (reason: Error) => void
			const resolvedPromise = Promise.resolve(1)
			const rejectedPromise = new Promise<number>((_, r) => (reject = r))

			holder.add(resolvedPromise)
			holder.add(rejectedPromise)

			expect(holder.size).toBe(2)

			await resolvedPromise
			reject!(new Error("test error"))
			try {
				await rejectedPromise
			} catch {
				// Expected
			}

			// Wait a tick for the finally handlers to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})

		test("should work with already resolved promises", async () => {
			const promise = Promise.resolve(42)
			await promise // Already resolved

			holder.add(promise)
			expect(holder.size).toBe(1)

			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})

		test("should work with already rejected promises", async () => {
			let reject: (reason: Error) => void
			const promise = new Promise<number>((_, r) => (reject = r))
			reject!(new Error("test error"))
			try {
				await promise
			} catch {
				// Expected
			}

			holder.add(promise)
			expect(holder.size).toBe(1)

			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})
	})

	describe("integration with waitForAll and waitForOne", () => {
		test("should allow sequential waitForAll calls", async () => {
			let resolve1: (value: number) => void
			let resolve2: (value: number) => void

			const promise1 = new Promise<number>((r) => (resolve1 = r))
			const promise2 = new Promise<number>((r) => (resolve2 = r))

			holder.add(promise1)

			// Resolve the first promise before waiting
			resolve1!(1)
			await holder.waitForAll()

			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))

			holder.add(promise2)

			// Resolve the second promise before waiting
			resolve2!(2)
			await holder.waitForAll()

			// Wait a tick for the finally handlers to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})

		test("should allow mixing waitForAll and waitForOne", async () => {
			let resolve1: (value: number) => void
			let resolve2: (value: number) => void
			let resolve3: (value: number) => void

			const promise1 = new Promise<number>((r) => (resolve1 = r))
			const promise2 = new Promise<number>((r) => (resolve2 = r))
			const promise3 = new Promise<number>((r) => (resolve3 = r))

			holder.add(promise1)
			holder.add(promise2)
			holder.add(promise3)

			// Wait for one promise to complete
			const waitForOnePromise = holder.waitForOne()
			resolve1!(1)
			await waitForOnePromise

			// Wait a tick for the finally handler to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(2)

			// Wait for the remaining promises
			const waitForAllPromise = holder.waitForAll()
			resolve2!(2)
			resolve3!(3)
			await waitForAllPromise

			// Wait a tick for the finally handlers to execute
			await new Promise((resolve) => setTimeout(resolve, 0))
			expect(holder.size).toBe(0)
		})
	})
})
