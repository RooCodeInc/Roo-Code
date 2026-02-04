/**
 * Intent Detector - Analyzes user intent from queries and context
 *
 * Uses keyword matching, context signals, and historical patterns
 * to determine what the user is trying to accomplish.
 */

/**
 * Intent types
 */
export enum IntentType {
	CODE_GENERATION = "code_generation",
	DEBUGGING = "debugging",
	REFACTORING = "refactoring",
	CODE_REVIEW = "code_review",
	EXPLANATION = "explanation",
	TESTING = "testing",
	DOCUMENTATION = "documentation",
	NAVIGATION = "navigation",
	SEARCH = "search",
	UNKNOWN = "unknown",
}

/**
 * Intent pattern definition
 */
export interface IntentPattern {
	type: IntentType
	keywords: string[]
	contextSignals: string[]
	weight: number
}

/**
 * Detected intent result
 */
export interface Intent {
	type: IntentType
	confidence: number
	suggestedActions: string[]
	requiredContext: string[]
	reasoning: string
}

/**
 * User context for intent analysis
 */
export interface UserContext {
	currentFile?: string
	openFiles?: string[]
	selection?: string
	projectType?: string
	language?: string
	recentErrors?: string[]
	userId?: string
}

/**
 * Action history for prediction
 */
export interface ActionHistory {
	actions: Action[]
	currentState: Record<string, unknown>
}

/**
 * Individual action in history
 */
export interface Action {
	type: string
	timestamp: number
	target: string
	result: "success" | "failure" | "partial"
}

/**
 * Action prediction result
 */
export interface ActionPrediction {
	action: string
	probability: number
	requiredContext: string[]
}

/**
 * Intent Detector Interface
 */
export interface IIntentDetector {
	/**
	 * Analyze user intent from query and context
	 */
	analyzeIntent(query: string, context: UserContext): Promise<Intent>

	/**
	 * Predict next action based on history
	 */
	predictNextAction(history: ActionHistory): Promise<ActionPrediction | null>

	/**
	 * Add custom intent pattern
	 */
	addPattern(pattern: IntentPattern): void

	/**
	 * Get all supported intent types
	 */
	getSupportedIntents(): IntentType[]
}

/**
 * Intent Detector Implementation
 */
export class IntentDetector implements IIntentDetector {
	private intentPatterns: IntentPattern[]
	private initialized: boolean = false

	constructor() {
		this.intentPatterns = this.getDefaultPatterns()
	}

	private getDefaultPatterns(): IntentPattern[] {
		return [
			{
				type: IntentType.CODE_GENERATION,
				keywords: [
					"create",
					"make",
					"add",
					"implement",
					"write",
					"new",
					"build",
					"develop",
					"generate",
				],
				contextSignals: [
					"empty file",
					"new function",
					"new file",
					"no existing code",
					"missing implementation",
				],
				weight: 1.0,
			},
			{
				type: IntentType.DEBUGGING,
				keywords: [
					"fix",
					"bug",
					"error",
					"issue",
					"not working",
					"broken",
					"failed",
					"crash",
					"exception",
					"wrong",
					"problem",
				],
				contextSignals: [
					"error message",
					"stack trace",
					"test failure",
					"runtime error",
					"compilation error",
				],
				weight: 1.0,
			},
			{
				type: IntentType.REFACTORING,
				keywords: [
					"refactor",
					"improve",
					"clean",
					"optimize",
					"restructure",
					"simplify",
					"modernize",
					"update",
				],
				contextSignals: [
					"complex function",
					"duplicate code",
					"legacy code",
					"code smell",
					"technical debt",
				],
				weight: 1.0,
			},
			{
				type: IntentType.CODE_REVIEW,
				keywords: [
					"review",
					"check",
					"analyze",
					"assess",
					"evaluate",
					"critique",
					"feedback",
				],
				contextSignals: [
					"recent changes",
					"pull request",
					"code changes",
					"modified files",
				],
				weight: 1.0,
			},
			{
				type: IntentType.EXPLANATION,
				keywords: [
					"explain",
					"how does",
					"what is",
					"why",
					"understand",
					"describe",
					"tell me about",
				],
				contextSignals: [
					"documentation request",
					"learning context",
					"complex code",
					"unfamiliar pattern",
				],
				weight: 1.0,
			},
			{
				type: IntentType.TESTING,
				keywords: [
					"test",
					"spec",
					"verify",
					"validate",
					"check",
					"ensure",
					"assert",
				],
				contextSignals: [
					"no test coverage",
					"new feature",
					"bug fix",
					"integration test",
					"unit test",
				],
				weight: 1.0,
			},
			{
				type: IntentType.DOCUMENTATION,
				keywords: [
					"document",
					"docs",
					"comment",
					"readme",
					"guide",
					"explain",
				],
				contextSignals: [
					"missing documentation",
					"public API",
					"complex function",
					"new feature",
				],
				weight: 1.0,
			},
			{
				type: IntentType.NAVIGATION,
				keywords: [
					"find",
					"locate",
					"search",
					"go to",
					"open",
					"show",
					"navigate",
				],
				contextSignals: [
					"file reference",
					"function call",
					"class usage",
					"import statement",
				],
				weight: 1.0,
			},
			{
				type: IntentType.SEARCH,
				keywords: [
					"search",
					"find",
					"lookup",
					"query",
					"list",
					"show all",
				],
				contextSignals: [
					"codebase search",
					"grep",
					"find references",
					"symbol lookup",
				],
				weight: 1.0,
			},
		]
	}

	async initialize(): Promise<void> {
		if (this.initialized) return
		this.initialized = true
	}

	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error("IntentDetector not initialized. Call initialize() first.")
		}
	}

	async analyzeIntent(query: string, context: UserContext): Promise<Intent> {
		this.ensureInitialized()

		const queryLower = query.toLowerCase()

		// Score by keywords
		const keywordScores = this.scoreByKeywords(queryLower)

		// Score by context signals
		const contextScores = this.scoreByContext(context)

		// Combine scores
		const combinedScores = this.combineScores([keywordScores, contextScores])

		// Get best match with low threshold for better detection
		const bestMatch = this.getBestMatch(combinedScores, 0.05)

		// Generate suggested actions
		const suggestedActions = this.getSuggestedActions(bestMatch.type, context)

		// Get required context
		const requiredContext = this.getRequiredContext(bestMatch.type)

		return {
			type: bestMatch.type,
			confidence: bestMatch.score,
			suggestedActions,
			requiredContext,
			reasoning: this.generateReasoning(bestMatch, query),
		}
	}

	private scoreByKeywords(query: string): Map<IntentType, number> {
		const scores = new Map<IntentType, number>()

		for (const pattern of this.intentPatterns) {
			let score = 0
			const matches: string[] = []

			for (const keyword of pattern.keywords) {
				if (query.includes(keyword.toLowerCase())) {
					score += 1
					matches.push(keyword)
				}
			}

			// Boost if multiple keywords match
			if (matches.length > 1) {
				score *= 1.5
			}

			// Add bonus for exact phrase matches
			for (const keyword of matches) {
				if (query.includes(keyword)) {
					score += 0.5
				}
			}

			scores.set(pattern.type, score * pattern.weight)
		}

		return scores
	}

	private scoreByContext(context: UserContext): Map<IntentType, number> {
		const scores = new Map<IntentType, number>()

		const contextString = [
			context.currentFile || "",
			context.language || "",
			context.projectType || "",
			...(context.recentErrors || []),
		].join(" ").toLowerCase()

		for (const pattern of this.intentPatterns) {
			let score = 0
			const matches: string[] = []

			for (const signal of pattern.contextSignals) {
				if (contextString.includes(signal.toLowerCase())) {
					score += 0.5
					matches.push(signal)
				}
			}

			scores.set(pattern.type, score)
		}

		return scores
	}

	private combineScores(
		scoreMaps: Map<IntentType, number>[],
	): Map<IntentType, number> {
		const combined = new Map<IntentType, number>()

		for (const scoreMap of scoreMaps) {
			for (const [type, score] of scoreMap) {
				const current = combined.get(type) || 0
				combined.set(type, current + score)
			}
		}

		return combined
	}

	private getBestMatch(
		scores: Map<IntentType, number>,
		threshold: number = 0.1,
	): { type: IntentType; score: number } {
		let bestType = IntentType.UNKNOWN
		let bestScore = threshold

		for (const [type, score] of scores) {
			if (score > bestScore) {
				bestScore = score
				bestType = type
			}
		}

		// Normalize score to 0-1 range
		const normalizedScore = Math.min(bestScore, 1)

		return { type: bestType, score: normalizedScore }
	}

	private getSuggestedActions(intentType: IntentType, context: UserContext): string[] {
		const suggestions: Record<IntentType, string[]> = {
			[IntentType.CODE_GENERATION]: [
				"Read existing code for patterns",
				"Check project structure",
				"Review similar implementations",
			],
			[IntentType.DEBUGGING]: [
				"Analyze error messages",
				"Review recent changes",
				"Check test output",
				"Examine stack trace",
			],
			[IntentType.REFACTORING]: [
				"Identify code smells",
				"Check for duplicates",
				"Review complexity metrics",
				"Plan incremental changes",
			],
			[IntentType.CODE_REVIEW]: [
				"Check coding standards",
				"Review for security issues",
				"Assess performance impact",
				"Verify test coverage",
			],
			[IntentType.EXPLANATION]: [
				"Explain the code structure",
				"Provide examples",
				"Link to documentation",
				"Describe trade-offs",
			],
			[IntentType.TESTING]: [
				"Review existing tests",
				"Check coverage reports",
				"Identify edge cases",
				"Write test cases",
			],
			[IntentType.DOCUMENTATION]: [
				"Review code structure",
				"Identify public APIs",
				"Check for inline comments",
				"Update related docs",
			],
			[IntentType.NAVIGATION]: [
				"Find relevant files",
				"Show code structure",
				"Display call hierarchy",
				"Open referenced files",
			],
			[IntentType.SEARCH]: [
				"Search codebase",
				"Filter results",
				"Show context",
				"List occurrences",
			],
			[IntentType.UNKNOWN]: [
				"Ask for clarification",
				"Suggest common actions",
				"Provide general help",
			],
		}

		return suggestions[intentType] || suggestions[IntentType.UNKNOWN]
	}

	private getRequiredContext(intentType: IntentType): string[] {
		const requiredContext: Record<IntentType, string[]> = {
			[IntentType.CODE_GENERATION]: [
				"Current file content",
				"Project structure",
				"Language settings",
			],
			[IntentType.DEBUGGING]: [
				"Error messages",
				"Recent changes",
				"Test output",
			],
			[IntentType.REFACTORING]: [
				"Target code",
				"Dependencies",
				"Test coverage",
			],
			[IntentType.CODE_REVIEW]: [
				"Changes to review",
				"Coding standards",
				"Security guidelines",
			],
			[IntentType.EXPLANATION]: [
				"Target code",
				"Related files",
				"Documentation",
			],
			[IntentType.TESTING]: [
				"Code to test",
				"Existing tests",
				"Test requirements",
			],
			[IntentType.DOCUMENTATION]: [
				"Code to document",
				"API surface",
				"Existing docs",
			],
			[IntentType.NAVIGATION]: [
				"Target location",
				"Current context",
				"Navigation history",
			],
			[IntentType.SEARCH]: [
				"Search query",
				"Search scope",
				"Filter criteria",
			],
			[IntentType.UNKNOWN]: [],
		}

		return requiredContext[intentType] || []
	}

	private generateReasoning(
		bestMatch: { type: IntentType; score: number },
		query: string,
	): string {
		const pattern = this.intentPatterns.find((p) => p.type === bestMatch.type)
		if (!pattern) {
			return "Could not determine user intent from query."
		}

		const matchedKeywords = pattern.keywords.filter((k) =>
			query.toLowerCase().includes(k.toLowerCase()),
		)

		if (matchedKeywords.length > 0) {
			return `Detected ${bestMatch.type} intent with ${matchedKeywords.length} matching keywords: "${matchedKeywords.join(", ")}". Confidence: ${Math.round(bestMatch.score * 100)}%`
		}

		return `Detected ${bestMatch.type} intent based on query patterns. Confidence: ${Math.round(bestMatch.score * 100)}%`
	}

	async predictNextAction(history: ActionHistory): Promise<ActionPrediction | null> {
		this.ensureInitialized()

		const patterns = this.analyzeActionSequences(history)

		for (const pattern of patterns) {
			if (this.matchesCurrentState(pattern, history.currentState)) {
				return {
					action: pattern.nextAction,
					probability: pattern.confidence,
					requiredContext: pattern.requiredContext,
				}
			}
		}

		return null
	}

	private analyzeActionSequences(
		history: ActionHistory,
	): ActionSequencePattern[] {
		// Simple pattern detection - in production, this would use ML
		const patterns: ActionSequencePattern[] = []

		if (history.actions.length < 2) {
			return patterns
		}

		// Detect common sequences
		const lastAction = history.actions[history.actions.length - 1]
		const secondLastAction = history.actions[history.actions.length - 2]

		// Pattern: error -> fix
		if (
			secondLastAction.result === "failure" &&
			lastAction.type === "fix"
		) {
			patterns.push({
				nextAction: "test",
				confidence: 0.8,
				requiredContext: ["test output", "error message"],
			})
		}

		// Pattern: test -> review
		if (secondLastAction.type === "test" && lastAction.result === "success") {
			patterns.push({
				nextAction: "commit",
				confidence: 0.6,
				requiredContext: ["test results", "code changes"],
			})
		}

		// Pattern: search -> open
		if (secondLastAction.type === "search" && lastAction.type === "open") {
			patterns.push({
				nextAction: "edit",
				confidence: 0.7,
				requiredContext: ["file content", "selection"],
			})
		}

		return patterns
	}

	private matchesCurrentState(
		pattern: ActionSequencePattern,
		currentState: Record<string, unknown>,
	): boolean {
		// Simple matching - in production, this would be more sophisticated
		return true
	}

	addPattern(pattern: IntentPattern): void {
		this.intentPatterns.push(pattern)
	}

	getSupportedIntents(): IntentType[] {
		return Object.values(IntentType).filter(
			(v) => v !== IntentType.UNKNOWN,
		)
	}
}

/**
 * Action sequence pattern for prediction
 */
interface ActionSequencePattern {
	nextAction: string
	confidence: number
	requiredContext: string[]
}

/**
 * Factory function to create IntentDetector
 */
export function createIntentDetector(): IntentDetector {
	const detector = new IntentDetector()
	detector.initialize()
	return detector
}
