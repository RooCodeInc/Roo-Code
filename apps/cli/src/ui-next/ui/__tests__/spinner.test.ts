/**
 * Tests for spinner animation utilities.
 */

import { getSpinnerFrame, SPINNER_FRAMES } from "../spinner.js"

describe("getSpinnerFrame", () => {
	it("returns the first frame for tick 0", () => {
		expect(getSpinnerFrame(0)).toBe(SPINNER_FRAMES[0])
	})

	it("returns the correct frame for valid tick", () => {
		expect(getSpinnerFrame(3)).toBe(SPINNER_FRAMES[3])
	})

	it("wraps around when tick exceeds frame count", () => {
		const frameCount = SPINNER_FRAMES.length
		expect(getSpinnerFrame(frameCount)).toBe(SPINNER_FRAMES[0])
		expect(getSpinnerFrame(frameCount + 1)).toBe(SPINNER_FRAMES[1])
		expect(getSpinnerFrame(frameCount + 5)).toBe(SPINNER_FRAMES[5])
	})

	it("handles large tick numbers", () => {
		const largeTick = 1234567
		const expectedIndex = largeTick % SPINNER_FRAMES.length
		expect(getSpinnerFrame(largeTick)).toBe(SPINNER_FRAMES[expectedIndex])
	})

	it("always returns a non-empty string", () => {
		for (let i = 0; i < 100; i++) {
			const frame = getSpinnerFrame(i)
			expect(frame).toBeTruthy()
			expect(typeof frame).toBe("string")
		}
	})

	it("cycles through all frames correctly", () => {
		const frames: string[] = []
		for (let i = 0; i < SPINNER_FRAMES.length; i++) {
			frames.push(getSpinnerFrame(i))
		}
		expect(frames).toEqual(SPINNER_FRAMES)
	})
})
