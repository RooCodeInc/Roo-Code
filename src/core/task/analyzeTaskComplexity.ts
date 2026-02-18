/**
 * Analyzes a task prompt to determine complexity and whether planning file should be created
 */

interface ComplexityAnalysis {
	isComplex: boolean
	score: number
	factors: string[]
}

/**
 * Extracts the original user request from a delegation format message
 * Returns the original request if found, otherwise returns the original prompt
 */
function extractOriginalRequest(prompt: string): string {
	const originalRequestMatch = prompt.match(/\*\*ORIGINAL USER REQUEST:\*\*\s*(.+?)(?=\n\n\*\*|$)/is)
	if (originalRequestMatch && originalRequestMatch[1]) {
		return originalRequestMatch[1].trim()
	}
	return prompt
}

/**
 * Analyzes task/prompt text to determine if it's complex enough to warrant a planning file
 * Returns true if the task is complex and would benefit from a planning file
 */
export function analyzeTaskComplexity(prompt?: string): ComplexityAnalysis {
	if (!prompt || prompt.trim().length === 0) {
		return {
			isComplex: false,
			score: 0,
			factors: ["No prompt provided"],
		}
	}

	// Extract original request if this is a delegation format message
	const originalRequest = extractOriginalRequest(prompt)

	let score = 0
	const factors: string[] = []
	const lowerPrompt = originalRequest.toLowerCase()

	// Length check - longer prompts are usually more complex
	if (originalRequest.length > 500) {
		score += 2
		factors.push("Lengthy prompt (>500 chars)")
	} else if (originalRequest.length > 200) {
		score += 1
		factors.push("Medium-length prompt (>200 chars)")
	}

	// Check for multi-phase keywords
	const multiPhaseKeywords = [
		"phase",
		"step",
		"then",
		"after that",
		"next",
		"finally",
		"first",
		"second",
		"third",
		"multiple",
		"several",
		"complex",
		"large",
		"comprehensive",
	]
	const phaseMatches = multiPhaseKeywords.filter((kw) => lowerPrompt.includes(kw))
	if (phaseMatches.length >= 2) {
		score += 3
		factors.push(`Multiple phases/sequential keywords (${phaseMatches.length})`)
	} else if (phaseMatches.length >= 1) {
		score += 1
		factors.push(`Sequential keywords found (${phaseMatches.length})`)
	}

	// Check for integration/coordination keywords
	const integrationKeywords = [
		"integrate",
		"connect",
		"sync",
		"coordinate",
		"orchestrate",
		"workflow",
		"pipeline",
		"chain",
	]
	const integrationMatches = integrationKeywords.filter((kw) => lowerPrompt.includes(kw))
	if (integrationMatches.length > 0) {
		score += 2
		factors.push("Integration/coordination required")
	}

	// Check for multiple components
	const componentKeywords = [
		"apex",
		"lwc",
		"trigger",
		"flow",
		"process",
		"object",
		"field",
		"page",
		"component",
		"api",
		"service",
		"class",
		"test",
	]
	const componentMatches = componentKeywords.filter((kw) => lowerPrompt.includes(kw))
	if (componentMatches.length >= 3) {
		score += 3
		factors.push(`Multiple components mentioned (${componentMatches.length})`)
	} else if (componentMatches.length >= 2) {
		score += 2
		factors.push(`Multiple components mentioned (${componentMatches.length})`)
	}

	// Check for dependency indicators
	const dependencyKeywords = ["depend", "require", "prerequisite", "before", "after", "only after", "must have"]
	const dependencyMatches = dependencyKeywords.filter((kw) => lowerPrompt.includes(kw))
	if (dependencyMatches.length > 0) {
		score += 2
		factors.push("Dependencies/prerequisites mentioned")
	}

	// Check for request analysis indicators
	const analysisKeywords = ["analyze", "plan", "design", "architecture", "structure", "organize"]
	const analysisMatches = analysisKeywords.filter((kw) => lowerPrompt.includes(kw))
	if (analysisMatches.length > 0) {
		score += 1
		factors.push("Analysis/planning keywords found")
	}

	// Check for testing/validation requirements
	if (lowerPrompt.includes("test") || lowerPrompt.includes("validate") || lowerPrompt.includes("verify")) {
		score += 1
		factors.push("Testing/validation required")
	}

	// Complexity threshold: score >= 4 means complex task that needs planning
	const isComplex = score >= 4

	return {
		isComplex,
		score,
		factors,
	}
}
