import { describe, it, expect, beforeEach } from "vitest"
import {
	BehavioralAnalyzer,
	CursorPosition,
	createBehavioralAnalyzer,
} from "../behavioral-analyzer"

describe("BehavioralAnalyzer", () => {
	let analyzer: BehavioralAnalyzer

	beforeEach(() => {
		analyzer = createBehavioralAnalyzer()
	})

	describe("trackCursorPosition", () => {
		it("should track cursor position", () => {
			const position: CursorPosition = { line: 10, character: 5 }
			analyzer.trackCursorPosition(position, "/test/file.ts")

			// No error means success
		})

		it("should track multiple cursor positions", () => {
			analyzer.trackCursorPosition({ line: 1, character: 0 }, "/test/file1.ts")
			analyzer.trackCursorPosition({ line: 5, character: 10 }, "/test/file2.ts")
			analyzer.trackCursorPosition({ line: 10, character: 20 }, "/test/file3.ts")
		})
	})

	describe("trackFileAccess", () => {
		it("should track file open", () => {
			analyzer.trackFileAccess("/test/file.ts", "open")
		})

		it("should track file close", () => {
			analyzer.trackFileAccess("/test/file.ts", "close")
		})

		it("should track file switch", () => {
			analyzer.trackFileAccess("/test/file.ts", "switch")
		})

		it("should track file access with duration", () => {
			analyzer.trackFileAccess("/test/file.ts", "open", 30000)
		})
	})

	describe("trackEdit", () => {
		it("should track insert edit", () => {
			analyzer.trackEdit({
				filePath: "/test/file.ts",
				type: "insert",
				line: 10,
				content: "new code",
			})
		})

		it("should track delete edit", () => {
			analyzer.trackEdit({
				filePath: "/test/file.ts",
				type: "delete",
				line: 10,
				content: "deleted code",
				previousContent: "old code",
			})
		})

		it("should track replace edit", () => {
			analyzer.trackEdit({
				filePath: "/test/file.ts",
				type: "replace",
				line: 10,
				content: "new code",
				previousContent: "old code",
			})
		})
	})

	describe("trackNavigation", () => {
		it("should track navigation by click", () => {
			analyzer.trackNavigation("/file1.ts", "/file2.ts", "click")
		})

		it("should track navigation by shortcut", () => {
			analyzer.trackNavigation("/file1.ts", "/file2.ts", "shortcut")
		})

		it("should track navigation by command", () => {
			analyzer.trackNavigation("/file1.ts", "/file2.ts", "command")
		})

		it("should track navigation by reference", () => {
			analyzer.trackNavigation("/file1.ts", "/file2.ts", "reference")
		})
	})

	describe("getCurrentContext", () => {
		it("should return context with empty focus area when no history", async () => {
			const context = await analyzer.getCurrentContext()

			expect(context.focusArea).toBeDefined()
			expect(context.focusArea.file).toBe("")
		})

		it("should return context with recent files", async () => {
			analyzer.trackFileAccess("/file1.ts", "open")
			analyzer.trackFileAccess("/file2.ts", "open")
			analyzer.trackFileAccess("/file3.ts", "open")

			const context = await analyzer.getCurrentContext()

			expect(context.recentFiles.length).toBeGreaterThanOrEqual(1)
		})

		it("should return editing pattern", async () => {
			const context = await analyzer.getCurrentContext()

			expect(context.editingPattern).toBeDefined()
			expect(typeof context.editingPattern.editsPerMinute).toBe("number")
			expect(context.editingPattern.editingTempo).toMatch(/slow|moderate|fast/)
		})

		it("should return navigation pattern", async () => {
			const context = await analyzer.getCurrentContext()

			expect(context.navigationPattern).toBeDefined()
			expect(context.navigationPattern.explorationStyle).toMatch(/focused|breadth-first|random/)
		})

		it("should return time distribution", async () => {
			const context = await analyzer.getCurrentContext()

			expect(context.timeDistribution).toBeDefined()
			expect(context.timeDistribution.byHour).toBeInstanceOf(Array)
			expect(context.timeDistribution.byDayOfWeek).toBeInstanceOf(Array)
		})

		it("should return inferred task", async () => {
			const context = await analyzer.getCurrentContext()

			expect(context.inferredTask).toBeDefined()
			expect(context.inferredTask.type).toMatch(/coding|debugging|reviewing|reading|planning/)
			expect(typeof context.inferredTask.confidence).toBe("number")
			expect(context.inferredTask.indicators).toBeInstanceOf(Array)
		})

		it("should detect coding task after edits", async () => {
			analyzer.trackEdit({
				filePath: "/test.ts",
				type: "insert",
				line: 10,
				content: "const x = 1",
			})
			analyzer.trackEdit({
				filePath: "/test.ts",
				type: "insert",
				line: 11,
				content: "const y = 2",
			})

			const context = await analyzer.getCurrentContext()

			expect(context.inferredTask.indicators.some((i) => i.includes("editing"))).toBe(true)
		})

		it("should detect debugging from conditional edits", async () => {
			analyzer.trackEdit({
				filePath: "/test.ts",
				type: "insert",
				line: 10,
				content: "if (condition) { console.log(error) }",
			})

			const context = await analyzer.getCurrentContext()

			expect(context.inferredTask.type).toBe("debugging")
		})

		it("should detect reading from file access without edits", async () => {
			analyzer.trackFileAccess("/file1.ts", "open")
			analyzer.trackFileAccess("/file2.ts", "open")
			analyzer.trackFileAccess("/file3.ts", "open")

			const context = await analyzer.getCurrentContext()

			expect(context.inferredTask.type).toBe("reading")
		})
	})

	describe("cleanupHistory", () => {
		it("should cleanup old history", () => {
			analyzer.trackCursorPosition({ line: 1, character: 0 }, "/test.ts")
			analyzer.trackFileAccess("/test.ts", "open")

			analyzer.cleanupHistory()

			// No error means success
		})
	})

	describe("getStatistics", () => {
		it("should return statistics object", () => {
			const stats = analyzer.getStatistics()

			expect(stats).toBeDefined()
			expect(typeof stats.totalEdits).toBe("number")
			expect(typeof stats.totalFileSwitches).toBe("number")
			expect(stats.topFilesEdited).toBeInstanceOf(Array)
			expect(stats.topNavigationPaths).toBeInstanceOf(Array)
		})

		it("should track edit statistics", () => {
			analyzer.trackEdit({
				filePath: "/file1.ts",
				type: "insert",
				line: 10,
				content: "code1",
			})
			analyzer.trackEdit({
				filePath: "/file1.ts",
				type: "insert",
				line: 11,
				content: "code2",
			})
			analyzer.trackEdit({
				filePath: "/file2.ts",
				type: "insert",
				line: 5,
				content: "code3",
			})

			const stats = analyzer.getStatistics()

			expect(stats.totalEdits).toBe(3)
			expect(stats.topFilesEdited.length).toBeGreaterThan(0)
		})

		it("should track navigation statistics", () => {
			analyzer.trackNavigation("/file1.ts", "/file2.ts", "click")
			analyzer.trackNavigation("/file2.ts", "/file3.ts", "shortcut")
			analyzer.trackNavigation("/file3.ts", "/file4.ts", "reference")

			const stats = analyzer.getStatistics()

			expect(stats.totalFileSwitches).toBeGreaterThanOrEqual(2)
		})
	})

	describe("editing pattern analysis", () => {
		it("should detect slow editing tempo", async () => {
			// Add one edit
			analyzer.trackEdit({
				filePath: "/test.ts",
				type: "insert",
				line: 10,
				content: "code",
			})

			const context = await analyzer.getCurrentContext()

			expect(context.editingPattern.editingTempo).toBe("slow")
		})

		it("should track most edited files", async () => {
			analyzer.trackEdit({
				filePath: "/main.ts",
				type: "insert",
				line: 10,
				content: "code",
			})
			analyzer.trackEdit({
				filePath: "/main.ts",
				type: "insert",
				line: 11,
				content: "code",
			})
			analyzer.trackEdit({
				filePath: "/utils.ts",
				type: "insert",
				line: 5,
				content: "code",
			})

			const context = await analyzer.getCurrentContext()

			expect(context.editingPattern.mostEditedFiles).toContain("/main.ts")
		})
	})

	describe("navigation pattern analysis", () => {
		it("should track preferred navigation methods", async () => {
			analyzer.trackNavigation("/file1.ts", "/file2.ts", "click")
			analyzer.trackNavigation("/file2.ts", "/file3.ts", "click")
			analyzer.trackNavigation("/file3.ts", "/file4.ts", "click")

			const context = await analyzer.getCurrentContext()

			expect(context.navigationPattern.preferredNavigationMethods).toContain("click")
		})

		it("should detect focused exploration style", async () => {
			analyzer.trackNavigation("/dir1/file1.ts", "/dir1/file2.ts", "click")
			analyzer.trackNavigation("/dir1/file2.ts", "/dir1/file3.ts", "click")
			analyzer.trackNavigation("/dir1/file3.ts", "/dir1/file4.ts", "click")

			const context = await analyzer.getCurrentContext()

			expect(context.navigationPattern.explorationStyle).toBe("focused")
		})
	})

	describe("focus area detection", () => {
		it("should detect focus area from cursor positions", async () => {
			analyzer.trackCursorPosition({ line: 10, character: 5 }, "/test.ts")
			analyzer.trackCursorPosition({ line: 15, character: 10 }, "/test.ts")
			analyzer.trackCursorPosition({ line: 20, character: 15 }, "/test.ts")

			const context = await analyzer.getCurrentContext()

			expect(context.focusArea.file).toBe("/test.ts")
			expect(context.focusArea.lineRange.start).toBe(10)
			expect(context.focusArea.lineRange.end).toBe(20)
		})

		it("should track time spent in focus area", async () => {
			analyzer.trackCursorPosition({ line: 10, character: 5 }, "/test.ts")

			const context = await analyzer.getCurrentContext()

			expect(context.focusArea.timeSpent).toBeGreaterThanOrEqual(0)
		})
	})
})
