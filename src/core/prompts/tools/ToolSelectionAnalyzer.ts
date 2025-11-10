import type { ToolName, ToolGroup, ModeConfig } from "@roo-code/types"
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "../../../shared/tools"
import { getGroupName } from "../../../shared/modes"

/**
 * Configuration for smart tool selection
 */
export interface SmartToolSelectionConfig {
	enabled?: boolean
	minTools?: number
	maxTools?: number
	defaultComplexityThreshold?: number
}

/**
 * Result of query analysis
 */
interface QueryAnalysis {
	complexity: "simple" | "moderate" | "complex"
	mentionedTools: Set<ToolName>
	mentionedGroups: Set<ToolGroup>
	isReadOnly: boolean
	needsEditing: boolean
	needsCommandExecution: boolean
	needsBrowser: boolean
	needsMcp: boolean
	confidence: number
}

/**
 * Tool relevance score
 */
interface ToolScore {
	tool: ToolName
	score: number
	reason: string
}

/**
 * Patterns for detecting tool mentions in queries
 */
const TOOL_MENTION_PATTERNS: Record<string, { groups: ToolGroup[]; tools?: ToolName[]; keywords: RegExp }> = {
	mcp: {
		groups: ["mcp"],
		keywords: /\b(mcp|server|github\s+mcp|database\s+mcp|use\s+mcp)\b/i,
	},
	browser: {
		groups: ["browser"],
		keywords:
			/\b(browser|website|web\s+page|localhost|chrome|firefox|test\s+in\s+browser|check\s+the\s+(website|browser))\b/i,
	},
	command: {
		groups: ["command"],
		keywords: /\b(run|execute|npm|yarn|pnpm|test|install|dependencies|cli|command|terminal|shell)\b/i,
	},
	edit: {
		groups: ["edit"],
		keywords: /\b(fix|refactor|modify|change|update|write|create|add|remove|delete|implement|code)\b/i,
	},
	read: {
		groups: ["read"],
		keywords: /\b(explain|what\s+does|understand|analyze|show|describe|look\s+at|read|view|check)\b/i,
	},
}

/**
 * Complexity indicators in queries
 */
const COMPLEXITY_INDICATORS = {
	simple: [
		/^(what|how|why|when|where|who)\s+/i,
		/\b(explain|describe|show|tell\s+me)\b/i,
		/\b(typo|spelling|rename)\b/i,
		/\b(single|one|this)\s+\w+/i,
	],
	complex: [
		/\b(entire|whole|all|complete|full|system|architecture|refactor)\b/i,
		/\b(multiple|several|many|various)\b/i,
		/\b(and|also|then|after|before|while)\b.*\b(and|also|then|after|before|while)\b/i, // Multiple conjunctions
		/\b(implement|create|build|design|develop)\s+\w+\s+(system|module|feature)/i,
	],
}

/**
 * Analyzer for smart tool selection based on query context
 */
export class ToolSelectionAnalyzer {
	private config: SmartToolSelectionConfig
	private recentMessages: string[] = []
	private maxMessageHistory = 5

	constructor(config: SmartToolSelectionConfig = {}) {
		this.config = {
			enabled: config.enabled ?? true,
			minTools: config.minTools ?? 6,
			maxTools: config.maxTools ?? 12,
			defaultComplexityThreshold: config.defaultComplexityThreshold ?? 0.7,
		}
	}

	/**
	 * Add a message to the conversation history
	 */
	public addMessage(message: string): void {
		this.recentMessages.push(message)
		if (this.recentMessages.length > this.maxMessageHistory) {
			this.recentMessages.shift()
		}
	}

	/**
	 * Clear the conversation history
	 */
	public clearHistory(): void {
		this.recentMessages = []
	}

	/**
	 * Analyze a query to determine its characteristics
	 */
	private analyzeQuery(query: string): QueryAnalysis {
		const lowerQuery = query.toLowerCase()
		const analysis: QueryAnalysis = {
			complexity: "moderate",
			mentionedTools: new Set(),
			mentionedGroups: new Set(),
			isReadOnly: false,
			needsEditing: false,
			needsCommandExecution: false,
			needsBrowser: false,
			needsMcp: false,
			confidence: 0.5,
		}

		// Check for explicit tool/group mentions
		for (const [key, pattern] of Object.entries(TOOL_MENTION_PATTERNS)) {
			if (pattern.keywords.test(query)) {
				pattern.groups.forEach((group) => analysis.mentionedGroups.add(group))
				if (pattern.tools) {
					pattern.tools.forEach((tool) => analysis.mentionedTools.add(tool))
				}

				// Set specific needs based on mentions
				switch (key) {
					case "mcp":
						analysis.needsMcp = true
						break
					case "browser":
						analysis.needsBrowser = true
						break
					case "command":
						analysis.needsCommandExecution = true
						break
					case "edit":
						analysis.needsEditing = true
						break
					case "read":
						analysis.isReadOnly = !analysis.needsEditing // Only read-only if not also editing
						break
				}
			}
		}

		// Determine complexity
		const simpleCount = COMPLEXITY_INDICATORS.simple.filter((pattern) => pattern.test(query)).length
		const complexCount = COMPLEXITY_INDICATORS.complex.filter((pattern) => pattern.test(query)).length

		if (complexCount > 1 || query.length > 500) {
			analysis.complexity = "complex"
			analysis.confidence = Math.min(0.9, 0.6 + complexCount * 0.1)
		} else if (simpleCount > 1 && complexCount === 0 && query.length < 100) {
			analysis.complexity = "simple"
			analysis.confidence = Math.min(0.9, 0.6 + simpleCount * 0.1)
		} else {
			analysis.complexity = "moderate"
			analysis.confidence = 0.7
		}

		// If no editing keywords found but query seems to be about making changes
		if (!analysis.needsEditing && /\b(fix|update|change|modify|add|remove)\b/i.test(query)) {
			analysis.needsEditing = true
			analysis.isReadOnly = false
		}

		// Adjust based on conversation history
		if (this.recentMessages.length > 0) {
			const recentContext = this.recentMessages.join(" ").toLowerCase()
			if (/\b(debug|error|issue|problem|bug)\b/i.test(recentContext)) {
				// In debugging context, likely need read and command tools
				analysis.needsCommandExecution = true
				analysis.confidence = Math.min(0.95, analysis.confidence + 0.1)
			}
			if (/\b(implement|create|build|write)\b/i.test(recentContext)) {
				// In implementation context, likely need editing tools
				analysis.needsEditing = true
				analysis.isReadOnly = false
			}
		}

		return analysis
	}

	/**
	 * Score tools based on query analysis
	 */
	private scoreTools(availableTools: Set<ToolName>, analysis: QueryAnalysis, modeConfig: ModeConfig): ToolScore[] {
		const scores: ToolScore[] = []

		for (const tool of availableTools) {
			let score = 0
			let reason = ""

			// Always include essential tools with high score
			if (ALWAYS_AVAILABLE_TOOLS.includes(tool)) {
				score = 0.9
				reason = "essential tool"
			}
			// Explicitly mentioned tools get highest score
			else if (analysis.mentionedTools.has(tool)) {
				score = 1.0
				reason = "explicitly mentioned"
			}
			// Tools in mentioned groups get high score
			else {
				// Find which group this tool belongs to
				let toolGroup: ToolGroup | undefined
				for (const [groupName, groupConfig] of Object.entries(TOOL_GROUPS)) {
					if (groupConfig.tools.includes(tool)) {
						toolGroup = groupName as ToolGroup
						break
					}
				}

				if (toolGroup && analysis.mentionedGroups.has(toolGroup)) {
					score = 0.85
					reason = `part of mentioned ${toolGroup} group`
				} else {
					// Score based on query characteristics
					switch (tool) {
						case "read_file":
						case "list_files":
						case "search_files":
						case "list_code_definition_names":
							score = analysis.isReadOnly ? 0.8 : 0.6
							reason = analysis.isReadOnly ? "read-only query" : "may need to read files"
							break

						case "write_to_file":
						case "apply_diff":
						case "insert_content":
							score = analysis.needsEditing ? 0.8 : analysis.isReadOnly ? 0.1 : 0.3
							reason = analysis.needsEditing ? "editing needed" : "editing tool"
							break

						case "execute_command":
							score = analysis.needsCommandExecution ? 0.85 : 0.2
							reason = analysis.needsCommandExecution ? "command execution needed" : "command tool"
							break

						case "browser_action":
							score = analysis.needsBrowser ? 0.9 : 0.1
							reason = analysis.needsBrowser ? "browser interaction needed" : "browser tool"
							break

						case "use_mcp_tool":
						case "access_mcp_resource":
							score = analysis.needsMcp ? 0.9 : 0.1
							reason = analysis.needsMcp ? "MCP needed" : "MCP tool"
							break

						case "codebase_search":
							score = analysis.complexity === "complex" ? 0.7 : 0.4
							reason = "codebase search"
							break

						case "fetch_instructions":
							score = 0.3 // Lower priority unless specifically needed
							reason = "instruction fetcher"
							break

						default:
							score = 0.5
							reason = "general tool"
					}
				}
			}

			// Adjust score based on complexity
			if (score > 0.1 && score < 0.9) {
				if (analysis.complexity === "simple") {
					score *= 0.8 // Reduce score for non-essential tools in simple queries
				} else if (analysis.complexity === "complex") {
					score *= 1.1 // Boost score for complex queries
				}
				score = Math.min(1.0, score)
			}

			scores.push({ tool, score, reason })
		}

		return scores
	}

	/**
	 * Select tools based on query context
	 */
	public selectTools(
		query: string,
		modeConfig: ModeConfig,
		availableTools: Set<ToolName>,
		customModes?: ModeConfig[],
	): ToolName[] {
		// If feature is disabled, return all available tools
		if (!this.config.enabled) {
			return Array.from(availableTools)
		}

		// Add query to history
		this.addMessage(query)

		// Analyze the query
		const analysis = this.analyzeQuery(query)

		// Score all available tools
		const scores = this.scoreTools(availableTools, analysis, modeConfig)

		// Sort by score (descending)
		scores.sort((a, b) => b.score - a.score)

		// Determine how many tools to include
		let targetCount = this.config.minTools!
		if (analysis.complexity === "simple") {
			targetCount = this.config.minTools!
		} else if (analysis.complexity === "moderate") {
			targetCount = Math.floor((this.config.minTools! + this.config.maxTools!) / 2)
		} else {
			targetCount = this.config.maxTools!
		}

		// Always include tools with score >= threshold
		const threshold = this.config.defaultComplexityThreshold!
		const selectedTools = new Set<ToolName>()
		const highScoreTools = scores.filter((s) => s.score >= threshold)

		for (const { tool } of highScoreTools) {
			selectedTools.add(tool)
		}

		// If we have fewer tools than minimum, add more based on score
		let i = highScoreTools.length
		while (selectedTools.size < targetCount && i < scores.length) {
			selectedTools.add(scores[i].tool)
			i++
		}

		// Ensure we always have essential tools
		for (const tool of ALWAYS_AVAILABLE_TOOLS) {
			if (availableTools.has(tool)) {
				selectedTools.add(tool)
			}
		}

		// Log selection for debugging (in development)
		if (process.env.NODE_ENV === "development") {
			console.log("Smart Tool Selection:", {
				query: query.substring(0, 100),
				analysis,
				selectedCount: selectedTools.size,
				totalAvailable: availableTools.size,
				topScores: scores
					.slice(0, 10)
					.map((s) => ({ tool: s.tool, score: s.score.toFixed(2), reason: s.reason })),
			})
		}

		return Array.from(selectedTools)
	}
}

// Singleton instance
let analyzerInstance: ToolSelectionAnalyzer | undefined

/**
 * Get or create the singleton ToolSelectionAnalyzer instance
 */
export function getToolSelectionAnalyzer(config?: SmartToolSelectionConfig): ToolSelectionAnalyzer {
	if (!analyzerInstance) {
		analyzerInstance = new ToolSelectionAnalyzer(config)
	} else if (config) {
		// Update config if provided
		analyzerInstance = new ToolSelectionAnalyzer(config)
	}
	return analyzerInstance
}
