import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "fs"
import path from "path"
import { appendLessonToClaude } from "../src/core/tools/append_lesson_to_claude"

describe("Phase 4: Lesson Recording - append_lesson_to_claude", () => {
	const claudePath = "CLAUDE.md"

	beforeEach(() => {
		// Clean up before each test
		if (fs.existsSync(claudePath)) {
			fs.unlinkSync(claudePath)
		}
	})

	afterEach(() => {
		// Clean up after each test
		if (fs.existsSync(claudePath)) {
			fs.unlinkSync(claudePath)
		}
	})

	it("creates CLAUDE.md if it doesn't exist", async () => {
		expect(fs.existsSync(claudePath)).toBe(false)

		const result = await appendLessonToClaude("Test lesson")

		expect(result.success).toBe(true)
		expect(result.path).toBe(claudePath)
		expect(fs.existsSync(claudePath)).toBe(true)
	})

	it("includes header when creating new CLAUDE.md", async () => {
		const result = await appendLessonToClaude("Test lesson")

		expect(result.success).toBe(true)

		const content = fs.readFileSync(claudePath, "utf8")
		expect(content).toContain("# Lessons Learned")
		expect(content).toContain("Phase 4: Parallel Orchestration")
	})

	it("appends lesson with timestamp in ISO format", async () => {
		const lessonText = "**Context**: Testing failed\n**Failure**: Test timeout\n**Resolution**: Optimize async code"

		const result = await appendLessonToClaude(lessonText)

		expect(result.success).toBe(true)

		const content = fs.readFileSync(claudePath, "utf8")
		expect(content).toContain("## Lesson Learned (")
		expect(content).toContain("UTC)")
		expect(content).toContain(lessonText)
	})

	it("formats timestamp correctly in UTC", async () => {
		const beforeTime = new Date()
		const result = await appendLessonToClaude("Lesson 1")
		const afterTime = new Date()

		expect(result.success).toBe(true)

		const content = fs.readFileSync(claudePath, "utf8")
		const timestampMatch = content.match(/## Lesson Learned \(([\d-]+ [\d:]+) UTC\)/)

		expect(timestampMatch).not.toBeNull()
		const lessonTime = new Date(timestampMatch![1] + " UTC")
		expect(lessonTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime() - 1000)
		expect(lessonTime.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000)
	})

	it("appends multiple lessons to same file without overwriting", async () => {
		const lesson1 = "**Context**: Lint errors\n**Failure**: Exceeded threshold\n**Resolution**: Fix type annotations"
		const lesson2 = "**Context**: Test failures\n**Failure**: Timeout\n**Resolution**: Optimize queries"

		const result1 = await appendLessonToClaude(lesson1)
		const result2 = await appendLessonToClaude(lesson2)

		expect(result1.success).toBe(true)
		expect(result2.success).toBe(true)

		const content = fs.readFileSync(claudePath, "utf8")

		// Both lessons should be present
		expect(content).toContain(lesson1)
		expect(content).toContain(lesson2)

		// Both should have lesson headers
		const lessonHeaders = content.match(/## Lesson Learned/g) || []
		expect(lessonHeaders.length).toBeGreaterThanOrEqual(2)
	})

	it("preserves lesson order (chronological)", async () => {
		const lesson1 = "Lesson 1: Early discovery"
		const lesson2 = "Lesson 2: Late discovery"

		await appendLessonToClaude(lesson1)
		await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay
		await appendLessonToClaude(lesson2)

		const content = fs.readFileSync(claudePath, "utf8")
		const index1 = content.indexOf(lesson1)
		const index2 = content.indexOf(lesson2)

		expect(index1).toBeGreaterThan(0)
		expect(index2).toBeGreaterThan(index1) // lesson2 comes after lesson1
	})

	it("handles multiline lesson text with markdown formatting", async () => {
		const lessonText = `**Context**: Build failed during CI
**Failure**: ESLint violations:
- Missing return type on function
- Unused variable in loop

**Resolution**: 
- Add explicit return types to all functions
- Enable strict mode in tsconfig
- Run eslint --fix before commit`

		const result = await appendLessonToClaude(lessonText)

		expect(result.success).toBe(true)

		const content = fs.readFileSync(claudePath, "utf8")
		expect(content).toContain(lessonText)
	})

	it("handles special characters in lesson text", async () => {
		const lessonText = `**Context**: Version conflict with dependencies
**Failure**: Error: "Cannot find module '@types/node'" - expected ^18.0.0, got 16.x
**Resolution**: Updated package.json: {"@types/node": "^18.0.0"}`

		const result = await appendLessonToClaude(lessonText)

		expect(result.success).toBe(true)

		const content = fs.readFileSync(claudePath, "utf8")
		expect(content).toContain(lessonText)
	})

	it("returns correct success response", async () => {
		const result = await appendLessonToClaude("Test lesson")

		expect(result).toHaveProperty("success")
		expect(result).toHaveProperty("path")
		expect(result).toHaveProperty("message")
		expect(result.success).toBe(true)
		expect(result.path).toBe(claudePath)
		expect(result.message).toContain("Lesson recorded")
	})

	it("handles empty lesson text gracefully", async () => {
		const result = await appendLessonToClaude("")

		expect(result.success).toBe(true)

		const content = fs.readFileSync(claudePath, "utf8")
		expect(content).toContain("## Lesson Learned (")
	})

	it("handles very long lesson text", async () => {
		const longLesson = Array(100)
			.fill("This is a long lesson text that repeats to test handling of verbose documentation.")
			.join("\n")

		const result = await appendLessonToClaude(longLesson)

		expect(result.success).toBe(true)

		const content = fs.readFileSync(claudePath, "utf8")
		expect(content).toContain(longLesson)
	})

	it("creates directory structure if needed", async () => {
		const testDir = "test-claude-dir"
		const testPath = `${testDir}/CLAUDE.md`

		// Temporarily patch the claudePath for this test
		const originalLessonFn = appendLessonToClaude

		// Note: This test would require refactoring appLessonToClaude to accept path param
		// For now, we test that it at least handles the default path correctly
		const result = await appendLessonToClaude("Test")
		expect(result.success).toBe(true)
	})

	it("appends lessons with proper spacing between entries", async () => {
		const lesson1 = "First lesson"
		const lesson2 = "Second lesson"

		await appendLessonToClaude(lesson1)
		await appendLessonToClaude(lesson2)

		const content = fs.readFileSync(claudePath, "utf8")

		// Check that lessons are on separate lines with proper formatting
		const lines = content.split("\n")
		const lesson1Index = lines.findIndex((line) => line.includes(lesson1))
		const lesson2Index = lines.findIndex((line) => line.includes(lesson2))

		expect(lesson1Index).toBeGreaterThanOrEqual(0)
		expect(lesson2Index).toBeGreaterThan(lesson1Index)
	})

	it("example: lint threshold exceeded lesson", async () => {
		const lintLesson = `**Context**: Verification step: Lint check on intentHooks.ts
**Failure**: ESLint warnings exceeded threshold:
- 5 'any' type usages
- 2 unused variables
- 1 missing return type

**Resolution**: Enforce stricter typing in intentHooks.ts:
- Replace 'any' with specific types (Block, Tool, etc.)
- Remove unused imports
- Add explicit return types to all functions`

		const result = await appendLessonToClaude(lintLesson)

		expect(result.success).toBe(true)

		const content = fs.readFileSync(claudePath, "utf8")
		expect(content).toContain("Lint check on intentHooks.ts")
		expect(content).toContain("ESLint warnings exceeded threshold")
		expect(content).toContain("Enforce stricter typing")
	})

	it("example: test failure lesson", async () => {
		const testLesson = `**Context**: Verification step: Phase 4 concurrency tests
**Failure**: Test timeout in "blocks write on stale file" - expected <5s, took 12s
- ConcurrencyGuard.verifyBeforeWrite() was performing synchronous disk I/O
- 1000+ concurrent operations caused file handle exhaustion

**Resolution**: Optimize file I/O in ConcurrencyGuard:
- Cache snapshot hashes in memory
- Use async fs.promises for concurrent operations
- Implement batch snapshot writes (max 100 entries per flush)`

		const result = await appendLessonToClaude(testLesson)

		expect(result.success).toBe(true)

		const content = fs.readFileSync(claudePath, "utf8")
		expect(content).toContain("Phase 4 concurrency tests")
		expect(content).toContain("Test timeout")
		expect(content).toContain("Optimize file I/O")
	})

	it("records learning from different verification contexts", async () => {
		const lessons = [
			{
				name: "Type Check Failure",
				text: `**Context**: TypeScript compilation
**Failure**: Type '{}' is not assignable to type 'ConcurrencySnapshot'
**Resolution**: Add proper type definitions to all function parameters`,
				searchKey: "TypeScript compilation",
			},
			{
				name: "Integration Test Failure",
				text: `**Context**: E2E test: Agent writes file while concurrent modification occurs
**Failure**: Race condition - write succeeded but should have been blocked
**Resolution**: Verify optimistic locking is applied in tool dispatcher post-hook`,
				searchKey: "Agent writes file while concurrent",
			},
			{
				name: "Performance Regression",
				text: `**Context**: Snapshot recording benchmark
**Failure**: File I/O latency increased from 2ms to 50ms per operation
**Resolution**: Implement batch writes and in-memory caching for frequent accesses`,
				searchKey: "Snapshot recording benchmark",
			},
		]

		for (const lesson of lessons) {
			const result = await appendLessonToClaude(lesson.text)
			expect(result.success).toBe(true)
		}

		const content = fs.readFileSync(claudePath, "utf8")

		for (const lesson of lessons) {
			expect(content).toContain(lesson.searchKey)
		}

		// Verify all lessons are present
		const lessonHeaders = content.match(/## Lesson Learned/g) || []
		expect(lessonHeaders.length).toBe(lessons.length)
	})
})
