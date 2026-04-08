import { ReasoningRepetitionDetector } from "../ReasoningRepetitionDetector"

describe("ReasoningRepetitionDetector", () => {
	describe("addChunk", () => {
		it("should not flag non-repetitive reasoning", () => {
			const detector = new ReasoningRepetitionDetector()

			expect(detector.addChunk("I need to analyze the code.\n")).toBe(false)
			expect(detector.addChunk("Let me look at the file structure.\n")).toBe(false)
			expect(detector.addChunk("The function needs to be refactored.\n")).toBe(false)
			expect(detector.addChunk("I'll use the read_file tool.\n")).toBe(false)
		})

		it("should detect repetitive lines when threshold is reached", () => {
			const detector = new ReasoningRepetitionDetector(3) // threshold of 3

			expect(detector.addChunk("I'll mention that I verified with tests.\n")).toBe(false)
			expect(detector.addChunk("I'll mention that I verified with tests.\n")).toBe(false)
			expect(detector.addChunk("I'll mention that I verified with tests.\n")).toBe(true)
		})

		it("should detect the pattern from the original issue report", () => {
			const detector = new ReasoningRepetitionDetector(5)

			const lines = [
				"The code is correct.\n",
				"I'll complete the task.\n",
				"I'll mention that I verified with tests.\n",
				"I'll mention that I reverted the tests.\n",
				"I'll mention that the fix is in packages/rev18/envar/src/env-runner.js.\n",
				"I'll mention that it injects arguments immediately after the command.\n",
				"I'll mention that this handles both explicit -- and implicit command starts.\n",
				"I'll mention that this supports get command as well.\n",
				"I'll mention that I verified with tests.\n",
				"I'll mention that I reverted the tests.\n",
				"I'll mention that I verified with tests.\n",
				"I'll mention that I reverted the tests.\n",
				"I'll mention that I verified with tests.\n",
				"I'll mention that I reverted the tests.\n",
				"I'll mention that I verified with tests.\n",
				"I'll mention that I reverted the tests.\n",
			]

			let detected = false
			for (const line of lines) {
				if (detector.addChunk(line)) {
					detected = true
					break
				}
			}

			expect(detected).toBe(true)
		})

		it("should handle chunks that span multiple lines", () => {
			const detector = new ReasoningRepetitionDetector(3)

			// Feed a chunk containing multiple lines at once
			const chunk =
				"I'll use attempt_completion.\nSome other text here.\nI'll use attempt_completion.\nAnother line.\nI'll use attempt_completion.\n"
			expect(detector.addChunk(chunk)).toBe(true)
		})

		it("should handle chunks that split lines across calls", () => {
			const detector = new ReasoningRepetitionDetector(3)

			// Line split across chunks
			expect(detector.addChunk("I'll mention that I ver")).toBe(false)
			expect(detector.addChunk("ified with tests.\n")).toBe(false)
			expect(detector.addChunk("I'll mention that I verified with tests.\n")).toBe(false)
			expect(detector.addChunk("I'll mention that I verified with tests.\n")).toBe(true)
		})

		it("should ignore short lines", () => {
			const detector = new ReasoningRepetitionDetector(3, 20)

			// Short lines should not trigger detection
			expect(detector.addChunk("Yes.\n")).toBe(false)
			expect(detector.addChunk("Yes.\n")).toBe(false)
			expect(detector.addChunk("Yes.\n")).toBe(false)
			expect(detector.addChunk("Yes.\n")).toBe(false)
			expect(detector.addChunk("Yes.\n")).toBe(false)
		})

		it("should normalize whitespace when comparing lines", () => {
			const detector = new ReasoningRepetitionDetector(3)

			expect(detector.addChunk("  I'll mention that I verified with tests.  \n")).toBe(false)
			expect(detector.addChunk("I'll mention that I verified with tests.\n")).toBe(false)
			expect(detector.addChunk("I'll  mention  that  I  verified  with  tests.\n")).toBe(true)
		})

		it("should be case-insensitive when comparing lines", () => {
			const detector = new ReasoningRepetitionDetector(3)

			expect(detector.addChunk("I'll mention that I verified with tests.\n")).toBe(false)
			expect(detector.addChunk("I'LL MENTION THAT I VERIFIED WITH TESTS.\n")).toBe(false)
			expect(detector.addChunk("i'll Mention That I Verified With Tests.\n")).toBe(true)
		})
	})

	describe("isRepetitive", () => {
		it("should return false for non-repetitive content", () => {
			const detector = new ReasoningRepetitionDetector(3)

			detector.addChunk("Line one is unique and long enough.\n")
			detector.addChunk("Line two is also unique and long.\n")
			detector.addChunk("Line three is different from others.\n")

			expect(detector.isRepetitive()).toBe(false)
		})

		it("should return true when repetition threshold is met", () => {
			const detector = new ReasoningRepetitionDetector(3)

			detector.addChunk("This line repeats a lot of times.\n")
			detector.addChunk("This line repeats a lot of times.\n")
			detector.addChunk("This line repeats a lot of times.\n")

			expect(detector.isRepetitive()).toBe(true)
		})

		it("should process remaining buffer content", () => {
			const detector = new ReasoningRepetitionDetector(3)

			// Feed content without trailing newline - it stays in buffer
			detector.addChunk("This line repeats a lot of times.\n")
			detector.addChunk("This line repeats a lot of times.\n")
			detector.addChunk("This line repeats a lot of times.") // No trailing newline

			// The buffer hasn't been processed by addChunk, but isRepetitive should check it
			expect(detector.isRepetitive()).toBe(true)
		})
	})

	describe("getMostRepeatedLine", () => {
		it("should return undefined when no lines have been processed", () => {
			const detector = new ReasoningRepetitionDetector()
			expect(detector.getMostRepeatedLine()).toBeUndefined()
		})

		it("should return the most repeated line", () => {
			const detector = new ReasoningRepetitionDetector()

			detector.addChunk("I'll mention that I verified with tests.\n")
			detector.addChunk("I'll mention that I reverted the tests.\n")
			detector.addChunk("I'll mention that I verified with tests.\n")
			detector.addChunk("I'll mention that I verified with tests.\n")
			detector.addChunk("I'll mention that I reverted the tests.\n")

			const result = detector.getMostRepeatedLine()
			expect(result).toBeDefined()
			expect(result!.line).toBe("i'll mention that i verified with tests.")
			expect(result!.count).toBe(3)
		})
	})

	describe("reset", () => {
		it("should clear all state", () => {
			const detector = new ReasoningRepetitionDetector(3)

			// Add some repetitive content
			detector.addChunk("I'll mention that I verified with tests.\n")
			detector.addChunk("I'll mention that I verified with tests.\n")

			// Reset
			detector.reset()

			// Should start fresh - previous counts should be gone
			expect(detector.isRepetitive()).toBe(false)
			expect(detector.getMostRepeatedLine()).toBeUndefined()

			// Should need full threshold again
			expect(detector.addChunk("I'll mention that I verified with tests.\n")).toBe(false)
			expect(detector.addChunk("I'll mention that I verified with tests.\n")).toBe(false)
			expect(detector.addChunk("I'll mention that I verified with tests.\n")).toBe(true)
		})
	})

	describe("default threshold", () => {
		it("should use default threshold of 5", () => {
			const detector = new ReasoningRepetitionDetector()

			expect(detector.addChunk("I'll use attempt_completion to finish.\n")).toBe(false)
			expect(detector.addChunk("I'll use attempt_completion to finish.\n")).toBe(false)
			expect(detector.addChunk("I'll use attempt_completion to finish.\n")).toBe(false)
			expect(detector.addChunk("I'll use attempt_completion to finish.\n")).toBe(false)
			// 5th time should trigger
			expect(detector.addChunk("I'll use attempt_completion to finish.\n")).toBe(true)
		})
	})

	describe("mixed content patterns", () => {
		it("should detect alternating repetitive lines (A-B-A-B pattern)", () => {
			const detector = new ReasoningRepetitionDetector(4)

			const lines = [
				"I'll mention that I verified with tests.\n",
				"I'll mention that I reverted the tests.\n",
				"I'll mention that I verified with tests.\n",
				"I'll mention that I reverted the tests.\n",
				"I'll mention that I verified with tests.\n",
				"I'll mention that I reverted the tests.\n",
				"I'll mention that I verified with tests.\n",
			]

			let detected = false
			for (const line of lines) {
				if (detector.addChunk(line)) {
					detected = true
					break
				}
			}

			expect(detected).toBe(true)
		})

		it("should not flag lines that appear below threshold among varied content", () => {
			const detector = new ReasoningRepetitionDetector(5)

			const lines = [
				"I need to analyze the codebase structure.\n",
				"Let me check the implementation details.\n",
				"I'll look at the test coverage next.\n",
				"I need to analyze the codebase structure.\n", // 2nd
				"The function signature looks correct to me.\n",
				"Let me verify the error handling path.\n",
				"I need to analyze the codebase structure.\n", // 3rd
				"The return type should be Promise<void>.\n",
				"I need to analyze the codebase structure.\n", // 4th - still below threshold of 5
			]

			let detected = false
			for (const line of lines) {
				if (detector.addChunk(line)) {
					detected = true
					break
				}
			}

			expect(detected).toBe(false)
		})

		it("should handle streaming chunks of varying sizes", () => {
			const detector = new ReasoningRepetitionDetector(3)

			// Simulate realistic streaming with small and large chunks
			expect(detector.addChunk("I'll")).toBe(false)
			expect(detector.addChunk(" use attempt_completion")).toBe(false)
			expect(detector.addChunk(" to finish the task.\nI'll use attempt_completion to finish the task.\nI")).toBe(
				false,
			)
			expect(detector.addChunk("'ll use attempt_completion to finish the task.\n")).toBe(true)
		})
	})
})
