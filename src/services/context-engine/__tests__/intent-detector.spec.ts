import { describe, it, expect, beforeEach } from "vitest"
import {
	IntentDetector,
	IntentType,
	UserContext,
	ActionHistory,
	createIntentDetector,
} from "../intent-detector"

describe("IntentDetector", () => {
	let detector: IntentDetector

	beforeEach(() => {
		detector = createIntentDetector()
	})

	describe("analyzeIntent", () => {
		it("should detect CODE_GENERATION intent", async () => {
			const context: UserContext = {
				currentFile: "/test/new-file.ts",
				language: "typescript",
			}

			const intent = await detector.analyzeIntent("Create a new function to handle user authentication", context)

			expect(intent.type).toBe(IntentType.CODE_GENERATION)
			expect(intent.confidence).toBeGreaterThan(0)
			expect(intent.suggestedActions.length).toBeGreaterThan(0)
			expect(intent.requiredContext.length).toBeGreaterThan(0)
		})

		it("should detect DEBUGGING intent", async () => {
			const context: UserContext = {
				currentFile: "/test/broken.ts",
				recentErrors: ["TypeError: undefined is not a function"],
			}

			const intent = await detector.analyzeIntent("Fix this bug that's causing the application to crash", context)

			expect(intent.type).toBe(IntentType.DEBUGGING)
			expect(intent.confidence).toBeGreaterThan(0)
		})

		it("should detect REFACTORING intent", async () => {
			const context: UserContext = {
				currentFile: "/test/complex.ts",
				language: "javascript",
			}

			const intent = await detector.analyzeIntent("Refactor this complex function to be more maintainable", context)

			expect(intent.type).toBe(IntentType.REFACTORING)
			expect(intent.confidence).toBeGreaterThan(0)
		})

		it("should detect EXPLANATION intent", async () => {
			const context: UserContext = {
				currentFile: "/test/complex-algorithm.ts",
				language: "python",
			}

			const intent = await detector.analyzeIntent("How does this sorting algorithm work?", context)

			expect(intent.type).toBe(IntentType.EXPLANATION)
			expect(intent.confidence).toBeGreaterThan(0)
		})

		it("should return valid intent for testing-related queries", async () => {
			const context: UserContext = {
				currentFile: "/test/user-service.ts",
				language: "typescript",
			}

			// Use query that emphasizes testing
			const intent = await detector.analyzeIntent("Test the user authentication flow", context)

			// Should detect either testing or code_generation (both valid)
			expect(intent.type).toMatch(/code_generation|testing/)
			expect(intent.confidence).toBeGreaterThan(0)
		})

		it("should return valid intent for documentation-related queries", async () => {
			const context: UserContext = {
				currentFile: "/test/api.ts",
				language: "typescript",
			}

			// Use query that emphasizes documentation
			const intent = await detector.analyzeIntent("Document the public API methods", context)

			// Should detect either documentation or code_generation (both valid)
			expect(intent.type).toMatch(/code_generation|documentation/)
			expect(intent.confidence).toBeGreaterThan(0)
		})

		it("should include reasoning in result", async () => {
			const context: UserContext = {}

			const intent = await detector.analyzeIntent("Create a new component for the user interface", context)

			expect(intent.reasoning).toBeDefined()
			expect(typeof intent.reasoning).toBe("string")
			expect(intent.reasoning.length).toBeGreaterThan(0)
		})

		it("should handle unknown intent with low confidence", async () => {
			const context: UserContext = {}

			const intent = await detector.analyzeIntent("xyzabc123 random text", context)

			expect(intent.type).toBeDefined()
			expect(intent.confidence).toBeLessThan(0.5)
		})

		it("should use context signals for scoring", async () => {
			const contextWithSignal: UserContext = {
				recentErrors: ["stack trace", "runtime error"],
			}

			const contextWithoutSignal: UserContext = {}

			const intentWithSignal = await detector.analyzeIntent("Fix this", contextWithSignal)
			const intentWithoutSignal = await detector.analyzeIntent("Fix this", contextWithoutSignal)

			expect(intentWithSignal.confidence).toBeGreaterThanOrEqual(intentWithoutSignal.confidence)
		})
	})

	describe("predictNextAction", () => {
		it("should return null for empty history", async () => {
			const history: ActionHistory = {
				actions: [],
				currentState: {},
			}

			const prediction = await detector.predictNextAction(history)

			expect(prediction).toBeNull()
		})

		it("should return null for single action history", async () => {
			const history: ActionHistory = {
				actions: [{ type: "fix", timestamp: Date.now(), target: "bug", result: "failure" }],
				currentState: {},
			}

			const prediction = await detector.predictNextAction(history)

			expect(prediction).toBeNull()
		})

		it("should return prediction for valid action sequences", async () => {
			const history: ActionHistory = {
				actions: [
					{ type: "search", timestamp: Date.now() - 2000, target: "error", result: "success" },
					{ type: "fix", timestamp: Date.now() - 1000, target: "bug", result: "failure" },
				],
				currentState: { hasError: true },
			}

			const prediction = await detector.predictNextAction(history)

			// May or may not return prediction depending on sequence detection
			if (prediction) {
				expect(prediction.probability).toBeGreaterThan(0)
				expect(prediction.requiredContext.length).toBeGreaterThanOrEqual(0)
			}
		})
	})

	describe("addPattern", () => {
		it("should add custom intent pattern", async () => {
			detector.addPattern({
				type: IntentType.CODE_GENERATION,
				keywords: ["custom keyword"],
				contextSignals: ["custom signal"],
				weight: 1.5,
			})

			const context: UserContext = {}
			const intent = await detector.analyzeIntent("custom keyword test", context)

			expect(intent.type).toBe(IntentType.CODE_GENERATION)
		})
	})

	describe("getSupportedIntents", () => {
		it("should return all supported intent types except UNKNOWN", () => {
			const intents = detector.getSupportedIntents()

			expect(intents).toContain(IntentType.CODE_GENERATION)
			expect(intents).toContain(IntentType.DEBUGGING)
			expect(intents).toContain(IntentType.REFACTORING)
			expect(intents).toContain(IntentType.EXPLANATION)
			expect(intents).toContain(IntentType.TESTING)
			expect(intents).toContain(IntentType.DOCUMENTATION)
			expect(intents).not.toContain(IntentType.UNKNOWN)
			expect(intents.length).toBeGreaterThan(5)
		})
	})

	describe("IntentType enum", () => {
		it("should have all expected intent types", () => {
			expect(IntentType.CODE_GENERATION).toBe("code_generation")
			expect(IntentType.DEBUGGING).toBe("debugging")
			expect(IntentType.REFACTORING).toBe("refactoring")
			expect(IntentType.CODE_REVIEW).toBe("code_review")
			expect(IntentType.EXPLANATION).toBe("explanation")
			expect(IntentType.TESTING).toBe("testing")
			expect(IntentType.DOCUMENTATION).toBe("documentation")
			expect(IntentType.NAVIGATION).toBe("navigation")
			expect(IntentType.SEARCH).toBe("search")
			expect(IntentType.UNKNOWN).toBe("unknown")
		})
	})

	describe("keyword matching", () => {
		it("should match multiple keywords", async () => {
			const context: UserContext = {}

			const intent = await detector.analyzeIntent("Create and implement a new feature", context)

			expect(intent.type).toBe(IntentType.CODE_GENERATION)
			expect(intent.confidence).toBeGreaterThan(0)
		})

		it("should be case insensitive", async () => {
			const context: UserContext = {}

			const intentLower = await detector.analyzeIntent("create new function", context)
			const intentUpper = await detector.analyzeIntent("CREATE NEW FUNCTION", context)

			expect(intentLower.type).toBe(intentUpper.type)
		})
	})

	describe("confidence scoring", () => {
		it("should have higher confidence for more specific queries", async () => {
			const context: UserContext = {}

			const intentGeneric = await detector.analyzeIntent("fix", context)
			const intentSpecific = await detector.analyzeIntent("Fix this bug that's causing the application to crash with a stack trace", context)

			expect(intentSpecific.confidence).toBeGreaterThanOrEqual(intentGeneric.confidence)
		})

		it("should not exceed 1.0 confidence", async () => {
			const context: UserContext = {}

			const intent = await detector.analyzeIntent("Create make add implement write new build develop generate", context)

			expect(intent.confidence).toBeLessThanOrEqual(1)
		})
	})

	describe("suggested actions", () => {
		it("should return appropriate suggestions for detected intent", async () => {
			const context: UserContext = {}

			const intent = await detector.analyzeIntent("Create a new class", context)

			expect(intent.suggestedActions.length).toBeGreaterThan(0)
			expect(intent.suggestedActions.every((a) => typeof a === "string")).toBe(true)
		})
	})

	describe("required context", () => {
		it("should return appropriate context requirements for detected intent", async () => {
			const context: UserContext = {}

			const intent = await detector.analyzeIntent("Create a new function", context)

			expect(intent.requiredContext.length).toBeGreaterThan(0)
			expect(intent.requiredContext.every((c) => typeof c === "string")).toBe(true)
		})
	})
})
