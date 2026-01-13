import { DeltaTracker } from "../delta-tracker.js"

describe("DeltaTracker", () => {
	let tracker: DeltaTracker

	beforeEach(() => {
		tracker = new DeltaTracker()
	})

	describe("getDelta", () => {
		it("returns full text on first call for a new id", () => {
			const delta = tracker.getDelta("msg1", "Hello World")
			expect(delta).toBe("Hello World")
		})

		it("returns only new content on subsequent calls", () => {
			tracker.getDelta("msg1", "Hello")
			const delta = tracker.getDelta("msg1", "Hello World")
			expect(delta).toBe(" World")
		})

		it("returns empty string when text unchanged", () => {
			tracker.getDelta("msg1", "Hello")
			const delta = tracker.getDelta("msg1", "Hello")
			expect(delta).toBe("")
		})

		it("tracks multiple ids independently", () => {
			tracker.getDelta("msg1", "Hello")
			tracker.getDelta("msg2", "Goodbye")

			const delta1 = tracker.getDelta("msg1", "Hello World")
			const delta2 = tracker.getDelta("msg2", "Goodbye World")

			expect(delta1).toBe(" World")
			expect(delta2).toBe(" World")
		})

		it("works with numeric ids (timestamps)", () => {
			const ts1 = 1234567890
			const ts2 = 1234567891

			tracker.getDelta(ts1, "First message")
			tracker.getDelta(ts2, "Second message")

			const delta1 = tracker.getDelta(ts1, "First message updated")
			const delta2 = tracker.getDelta(ts2, "Second message updated")

			expect(delta1).toBe(" updated")
			expect(delta2).toBe(" updated")
		})

		it("handles incremental streaming correctly", () => {
			// Simulate streaming tokens
			expect(tracker.getDelta("msg", "H")).toBe("H")
			expect(tracker.getDelta("msg", "He")).toBe("e")
			expect(tracker.getDelta("msg", "Hel")).toBe("l")
			expect(tracker.getDelta("msg", "Hell")).toBe("l")
			expect(tracker.getDelta("msg", "Hello")).toBe("o")
		})
	})

	describe("peekDelta", () => {
		it("returns delta without updating tracking", () => {
			tracker.getDelta("msg1", "Hello")

			// Peek should show the delta
			expect(tracker.peekDelta("msg1", "Hello World")).toBe(" World")

			// But tracking should be unchanged, so getDelta still returns full delta
			expect(tracker.getDelta("msg1", "Hello World")).toBe(" World")

			// Now peek should show empty
			expect(tracker.peekDelta("msg1", "Hello World")).toBe("")
		})
	})

	describe("reset", () => {
		it("clears all tracking", () => {
			tracker.getDelta("msg1", "Hello")
			tracker.getDelta("msg2", "World")

			tracker.reset()

			// After reset, should get full text again
			expect(tracker.getDelta("msg1", "Hello")).toBe("Hello")
			expect(tracker.getDelta("msg2", "World")).toBe("World")
		})
	})

	describe("resetId", () => {
		it("clears tracking for specific id only", () => {
			tracker.getDelta("msg1", "Hello")
			tracker.getDelta("msg2", "World")

			tracker.resetId("msg1")

			// msg1 should be reset
			expect(tracker.getDelta("msg1", "Hello")).toBe("Hello")
			// msg2 should still be tracked
			expect(tracker.getDelta("msg2", "World")).toBe("")
		})
	})

	describe("getPosition", () => {
		it("returns 0 for untracked ids", () => {
			expect(tracker.getPosition("unknown")).toBe(0)
		})

		it("returns current position for tracked ids", () => {
			tracker.getDelta("msg1", "Hello")
			expect(tracker.getPosition("msg1")).toBe(5)

			tracker.getDelta("msg1", "Hello World")
			expect(tracker.getPosition("msg1")).toBe(11)
		})
	})

	describe("edge cases", () => {
		it("handles empty strings", () => {
			expect(tracker.getDelta("msg1", "")).toBe("")
			expect(tracker.getDelta("msg1", "Hello")).toBe("Hello")
		})

		it("handles unicode correctly", () => {
			tracker.getDelta("msg1", "Hello 👋")
			const delta = tracker.getDelta("msg1", "Hello 👋 World 🌍")
			expect(delta).toBe(" World 🌍")
		})

		it("handles multiline text", () => {
			tracker.getDelta("msg1", "Line 1\n")
			const delta = tracker.getDelta("msg1", "Line 1\nLine 2\n")
			expect(delta).toBe("Line 2\n")
		})
	})
})
