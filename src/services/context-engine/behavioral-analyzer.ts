/**
 * Behavioral Analyzer - Tracks and analyzes user behavior patterns
 *
 * Monitors cursor positions, file access, edits, and navigation
 * to build a comprehensive behavioral context.
 */

/**
 * Cursor position data
 */
export interface CursorPosition {
	line: number
	character: number
}

/**
 * File access record
 */
export interface FileAccess {
	path: string
	action: "open" | "close" | "switch"
	timestamp: number
	duration?: number
}

/**
 * Edit action record
 */
export interface EditAction {
	filePath: string
	type: "insert" | "delete" | "replace"
	line: number
	content: string
	previousContent?: string
	timestamp: number
}

/**
 * Navigation action record
 */
export interface NavigationAction {
	from: string
	to: string
	trigger: "click" | "shortcut" | "command" | "reference"
	timestamp: number
}

/**
 * Focus area information
 */
export interface FocusArea {
	file: string
	lineRange: { start: number; end: number }
	symbol?: string
	timeSpent: number
}

/**
 * Behavioral context result
 */
export interface BehavioralContext {
	focusArea: FocusArea
	recentFiles: string[]
	editingPattern: EditingPattern
	navigationPattern: NavigationPattern
	timeDistribution: TimeDistribution
	inferredTask: InferredTask
}

/**
 * Pattern of editing behavior
 */
export interface EditingPattern {
	averageSessionLength: number
	editsPerMinute: number
	mostEditedFiles: string[]
	editingTempo: "slow" | "moderate" | "fast"
	preferredInsertionAreas: ("start" | "middle" | "end" | "scattered")[]
}

/**
 * Pattern of navigation behavior
 */
export interface NavigationPattern {
	averageFileSwitches: number
	preferredNavigationMethods: string[]
	deepestDirectory: string
	explorationStyle: "focused" | "breadth-first" | "random"
}

/**
 * Time distribution of activities
 */
export interface TimeDistribution {
	byHour: number[]
	byDayOfWeek: number[]
	peakActivityHours: number[]
}

/**
 * Inferred task from behavior
 */
export interface InferredTask {
	type: "coding" | "debugging" | "reviewing" | "reading" | "planning"
	confidence: number
	indicators: string[]
	relatedFiles: string[]
}

/**
 * Behavioral Analyzer Interface
 */
export interface IBehavioralAnalyzer {
	/**
	 * Track cursor position
	 */
	trackCursorPosition(position: CursorPosition, file: string): void

	/**
	 * Track file access
	 */
	trackFileAccess(filePath: string, action: "open" | "close" | "switch", duration?: number): void

	/**
	 * Track edit action
	 */
	trackEdit(action: Omit<EditAction, "timestamp">): void

	/**
	 * Track navigation
	 */
	trackNavigation(from: string, to: string, trigger: "click" | "shortcut" | "command" | "reference"): void

	/**
	 * Get current behavioral context
	 */
	getCurrentContext(): Promise<BehavioralContext>

	/**
	 * Clear old history
	 */
	cleanupHistory(): void

	/**
	 * Get behavior statistics
	 */
	getStatistics(): BehavioralStatistics
}

/**
 * Behavioral statistics
 */
export interface BehavioralStatistics {
	totalSessions: number
	totalEdits: number
	totalFileSwitches: number
	averageSessionDuration: number
	topFilesEdited: { file: string; count: number }[]
	topNavigationPaths: { from: string; to: string; count: number }[]
}

/**
 * Behavioral Analyzer Implementation
 */
export class BehavioralAnalyzer implements IBehavioralAnalyzer {
	private cursorHistory: { position: CursorPosition; file: string; timestamp: number }[]
	private fileAccessHistory: FileAccess[]
	private editHistory: EditAction[]
	private navigationHistory: NavigationAction[]
	private readonly MAX_HISTORY_SIZE = 1000
	private readonly HISTORY_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

	constructor() {
		this.cursorHistory = []
		this.fileAccessHistory = []
		this.editHistory = []
		this.navigationHistory = []
	}

	trackCursorPosition(position: CursorPosition, file: string): void {
		this.cursorHistory.push({
			position,
			file,
			timestamp: Date.now(),
		})

		// Trim history if too large
		if (this.cursorHistory.length > this.MAX_HISTORY_SIZE) {
			this.cursorHistory = this.cursorHistory.slice(-this.MAX_HISTORY_SIZE)
		}
	}

	trackFileAccess(filePath: string, action: "open" | "close" | "switch", duration?: number): void {
		this.fileAccessHistory.push({
			path: filePath,
			action,
			timestamp: Date.now(),
			duration,
		})

		this.trimHistory(this.fileAccessHistory)
	}

	trackEdit(action: Omit<EditAction, "timestamp">): void {
		this.editHistory.push({
			...action,
			timestamp: Date.now(),
		})

		this.trimHistory(this.editHistory)
	}

	trackNavigation(from: string, to: string, trigger: "click" | "shortcut" | "command" | "reference"): void {
		this.navigationHistory.push({
			from,
			to,
			trigger,
			timestamp: Date.now(),
		})

		this.trimHistory(this.navigationHistory)
	}

	async getCurrentContext(): Promise<BehavioralContext> {
		const now = Date.now()
		const recentHistory = this.HISTORY_WINDOW_MS

		const recentCursors = this.cursorHistory.filter((c) => now - c.timestamp < recentHistory)
		const recentFiles = this.fileAccessHistory.filter((f) => now - f.timestamp < recentHistory)
		const recentEdits = this.editHistory.filter((e) => now - e.timestamp < recentHistory)
		const recentNav = this.navigationHistory.filter((n) => now - n.timestamp < recentHistory)

		return {
			focusArea: this.detectFocusArea(recentCursors),
			recentFiles: this.getRecentFiles(recentFiles),
			editingPattern: this.analyzeEditingPattern(recentEdits),
			navigationPattern: this.analyzeNavigationPattern(recentNav),
			timeDistribution: this.analyzeTimeDistribution(),
			inferredTask: this.inferCurrentTask(recentEdits, recentFiles),
		}
	}

	private detectFocusArea(
		recentCursors: { position: CursorPosition; file: string; timestamp: number }[],
	): FocusArea {
		if (recentCursors.length === 0) {
			return {
				file: "",
				lineRange: { start: 0, end: 0 },
				timeSpent: 0,
			}
		}

		const currentFile = recentCursors[recentCursors.length - 1].file

		// Calculate line range from recent positions
		const lines = recentCursors.filter((c) => c.file === currentFile).map((c) => c.position.line)
		const lineRange =
			lines.length > 0
				? { start: Math.min(...lines), end: Math.max(...lines) }
				: { start: 0, end: 0 }

		// Calculate time spent
		const timestamps = recentCursors.filter((c) => c.file === currentFile).map((c) => c.timestamp)
		const timeSpent =
			timestamps.length > 0 ? timestamps[timestamps.length - 1] - timestamps[0] : 0

		return {
			file: currentFile,
			lineRange,
			timeSpent,
		}
	}

	private getRecentFiles(recentFiles: FileAccess[]): string[] {
		const fileSet = new Set<string>()
		const sorted = [...recentFiles].sort((a, b) => b.timestamp - a.timestamp)

		for (const access of sorted) {
			if (!fileSet.has(access.path)) {
				fileSet.add(access.path)
				if (fileSet.size >= 10) {
					break
				}
			}
		}

		return Array.from(fileSet)
	}

	private analyzeEditingPattern(recentEdits: EditAction[]): EditingPattern {
		const now = Date.now()

		// Calculate edits per minute
		const timeSpanMinutes = Math.max(1, (now - (recentEdits[0]?.timestamp || now)) / 60000)
		const editsPerMinute = recentEdits.length / timeSpanMinutes

		// Get most edited files
		const fileCounts = new Map<string, number>()
		for (const edit of recentEdits) {
			fileCounts.set(edit.filePath, (fileCounts.get(edit.filePath) || 0) + 1)
		}
		const mostEditedFiles = [...fileCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([file]) => file)

		// Determine editing tempo
		let editingTempo: "slow" | "moderate" | "fast"
		if (editsPerMinute < 2) {
			editingTempo = "slow"
		} else if (editsPerMinute < 10) {
			editingTempo = "moderate"
		} else {
			editingTempo = "fast"
		}

		// Analyze insertion areas
		const insertionAreas = this.analyzeInsertionAreas(recentEdits)

		// Calculate average session length (mock for now)
		const averageSessionLength = 30 // minutes

		return {
			averageSessionLength,
			editsPerMinute,
			mostEditedFiles,
			editingTempo,
			preferredInsertionAreas: insertionAreas,
		}
	}

	private analyzeInsertionAreas(edits: EditAction[]): ("start" | "middle" | "end" | "scattered")[] {
		if (edits.length === 0) {
			return ["scattered"]
		}

		const linePositions = edits.map((e) => e.line)
		const avgLine = linePositions.reduce((a, b) => a + b, 0) / linePositions.length

		// This is a simplified analysis
		return ["middle"]
	}

	private analyzeNavigationPattern(recentNav: NavigationAction[]): NavigationPattern {
		// Count file switches
		const fileSwitches = recentNav.filter((n) => n.from !== n.to).length

		// Get preferred navigation methods
		const methodCounts = new Map<string, number>()
		for (const nav of recentNav) {
			methodCounts.set(nav.trigger, (methodCounts.get(nav.trigger) || 0) + 1)
		}
		const preferredNavigationMethods = [...methodCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([method]) => method)

		// Find deepest directory
		let deepestDirectory = ""
		for (const nav of recentNav) {
			const depth = nav.to.split("/").length
			const currentDepth = deepestDirectory.split("/").length
			if (depth > currentDepth) {
				deepestDirectory = nav.to
			}
		}

		// Determine exploration style
		const explorationStyle = this.determineExplorationStyle(recentNav)

		return {
			averageFileSwitches: recentNav.length > 0 ? fileSwitches / (recentNav.length / 60) : 0,
			preferredNavigationMethods,
			deepestDirectory,
			explorationStyle,
		}
	}

	private determineExplorationStyle(nav: NavigationAction[]): "focused" | "breadth-first" | "random" {
		if (nav.length < 5) {
			return "focused"
		}

		// Check if visiting same directories (focused)
		const directoryChanges = new Set<string>()
		for (const n of nav) {
			directoryChanges.add(n.to.split("/").slice(0, -1).join("/"))
		}

		if (directoryChanges.size <= 2) {
			return "focused"
		}

		// Check for breadth-first pattern
		const uniqueTargets = new Set(nav.map((n) => n.to))
		if (uniqueTargets.size > nav.length * 0.7) {
			return "breadth-first"
		}

		return "random"
	}

	private analyzeTimeDistribution(): TimeDistribution {
		const now = new Date()
		const currentHour = now.getHours()
		const currentDayOfWeek = now.getDay()

		// Mock time distribution (in production, this would use historical data)
		const byHour = new Array(24).fill(0)
		byHour[currentHour] = 10

		const byDayOfWeek = new Array(7).fill(0)
		byDayOfWeek[currentDayOfWeek] = 50

		// Peak activity hours
		const peakActivityHours = [currentHour]

		return {
			byHour,
			byDayOfWeek,
			peakActivityHours,
		}
	}

	private inferCurrentTask(recentEdits: EditAction[], recentFiles: FileAccess[]): InferredTask {
		const indicators: string[] = []
		let maxConfidence = 0
		let inferredType: "coding" | "debugging" | "reviewing" | "reading" | "planning" = "coding"

		// Check for debugging indicators
		const debugEdits = recentEdits.filter((e) =>
			e.content.toLowerCase().includes("if") || e.content.toLowerCase().includes("console"),
		)
		if (debugEdits.length > 0) {
			indicators.push("Conditional logic edits detected")
			maxConfidence = Math.max(maxConfidence, 0.7)
			inferredType = "debugging"
		}

		// Check for review indicators
		if (recentFiles.length > 3 && recentEdits.length < 2) {
			indicators.push("Multiple files accessed with minimal edits")
			maxConfidence = Math.max(maxConfidence, 0.6)
			inferredType = "reviewing"
		}

		// Check for reading indicators
		if (recentEdits.length === 0) {
			indicators.push("No edits made recently")
			maxConfidence = Math.max(maxConfidence, 0.5)
			inferredType = "reading"
		}

		// Default to coding
		if (indicators.length === 0 && recentEdits.length > 0) {
			indicators.push("Active editing detected")
			maxConfidence = 0.8
			inferredType = "coding"
		}

		return {
			type: inferredType,
			confidence: maxConfidence || 0.3,
			indicators,
			relatedFiles: recentFiles.map((f) => f.path),
		}
	}

	cleanupHistory(): void {
		const cutoff = Date.now() - this.HISTORY_WINDOW_MS

		this.cursorHistory = this.cursorHistory.filter((c) => c.timestamp > cutoff)
		this.fileAccessHistory = this.fileAccessHistory.filter((f) => f.timestamp > cutoff)
		this.editHistory = this.editHistory.filter((e) => e.timestamp > cutoff)
		this.navigationHistory = this.navigationHistory.filter((n) => n.timestamp > cutoff)
	}

	private trimHistory<T extends { timestamp: number }>(history: T[]): void {
		if (history.length > this.MAX_HISTORY_SIZE) {
			history.splice(0, history.length - this.MAX_HISTORY_SIZE)
		}
	}

	getStatistics(): BehavioralStatistics {
		// Get top files edited
		const fileCounts = new Map<string, number>()
		for (const edit of this.editHistory) {
			fileCounts.set(edit.filePath, (fileCounts.get(edit.filePath) || 0) + 1)
		}
		const topFilesEdited = [...fileCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([file, count]) => ({ file, count }))

		// Get top navigation paths
		const navCounts = new Map<string, number>()
		for (const nav of this.navigationHistory) {
			const key = `${nav.from}->${nav.to}`
			navCounts.set(key, (navCounts.get(key) || 0) + 1)
		}
		const topNavigationPaths = [...navCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([path, count]) => {
				const [from, to] = path.split("->")
				return { from, to, count }
			})

		return {
			totalSessions: 1,
			totalEdits: this.editHistory.length,
			totalFileSwitches: this.navigationHistory.filter((n) => n.from !== n.to).length,
			averageSessionDuration: 30,
			topFilesEdited,
			topNavigationPaths,
		}
	}
}

/**
 * Factory function to create BehavioralAnalyzer
 */
export function createBehavioralAnalyzer(): BehavioralAnalyzer {
	return new BehavioralAnalyzer()
}
