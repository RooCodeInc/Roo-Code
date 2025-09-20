// Test for JSON file truncation issue #8149
// npx vitest run integrations/misc/__tests__/extract-text-json-truncation.spec.ts

import * as fs from "fs/promises"
import { extractTextFromFile } from "../extract-text"
import { countFileLines } from "../line-counter"
import { readLines } from "../read-lines"
import { isBinaryFile } from "isbinaryfile"

// Mock all dependencies
vi.mock("fs/promises")
vi.mock("../line-counter")
vi.mock("../read-lines")
vi.mock("isbinaryfile")

describe("extractTextFromFile - JSON File Truncation (Issue #8149)", () => {
	// Type the mocks
	const mockedFs = vi.mocked(fs)
	const mockedCountFileLines = vi.mocked(countFileLines)
	const mockedReadLines = vi.mocked(readLines)
	const mockedIsBinaryFile = vi.mocked(isBinaryFile)

	beforeEach(() => {
		vi.clearAllMocks()
		// Set default mock behavior
		mockedFs.access.mockResolvedValue(undefined)
		mockedIsBinaryFile.mockResolvedValue(false)
	})

	it("should truncate large JSON files that exceed maxReadFileLine limit", async () => {
		// Create a large JSON file content with 150 lines
		const largeJsonLines = [
			"{",
			'  "name": "test-package",',
			'  "version": "1.0.0",',
			'  "description": "A test package with many dependencies",',
			'  "dependencies": {',
		]

		// Add 140 dependency lines to make it exceed 50 lines
		for (let i = 1; i <= 140; i++) {
			const comma = i < 140 ? "," : ""
			largeJsonLines.push(`    "package-${i}": "^1.0.0"${comma}`)
		}

		largeJsonLines.push("  },")
		largeJsonLines.push('  "devDependencies": {}')
		largeJsonLines.push("}")

		const largeJsonContent = largeJsonLines.join("\n")

		// Mock that the file has 148 lines total
		mockedCountFileLines.mockResolvedValue(148)

		// Mock reading only the first 50 lines
		const first50Lines = largeJsonLines.slice(0, 50).join("\n")
		mockedReadLines.mockResolvedValue(first50Lines)

		// Test with maxReadFileLine = 50 (as mentioned in the issue)
		const result = await extractTextFromFile("/test/large-package.json", 50)

		// Should only include first 50 lines with line numbers
		expect(result).toContain(" 1 | {")
		expect(result).toContain(' 2 |   "name": "test-package",')
		expect(result).toContain('50 |     "package-45": "^1.0.0",')

		// Should NOT include lines beyond 50
		expect(result).not.toContain("51 |")
		expect(result).not.toContain("package-46")

		// Should include truncation message
		expect(result).toContain(
			"[File truncated: showing 50 of 148 total lines. The file is too large and may exhaust the context window if read in full.]",
		)

		// Verify that readLines was called with correct parameters
		expect(mockedReadLines).toHaveBeenCalledWith("/test/large-package.json", 49, 0) // 0-indexed, so 49 for line 50
	})

	it("should not truncate small JSON files within the maxReadFileLine limit", async () => {
		const smallJsonContent = JSON.stringify(
			{
				name: "small-package",
				version: "1.0.0",
				dependencies: {
					"package-1": "^1.0.0",
					"package-2": "^2.0.0",
				},
			},
			null,
			2,
		)

		const lineCount = smallJsonContent.split("\n").length

		mockedCountFileLines.mockResolvedValue(lineCount)
		mockedFs.readFile.mockResolvedValue(smallJsonContent as any)

		const result = await extractTextFromFile("/test/small-package.json", 50)

		// Should include all content with line numbers
		expect(result).toContain("1 | {")
		expect(result).toContain('"name": "small-package"')
		expect(result).toContain('"dependencies": {')

		// Should NOT include truncation message
		expect(result).not.toContain("[File truncated:")

		// Should use fs.readFile for small files, not readLines
		expect(mockedFs.readFile).toHaveBeenCalledWith("/test/small-package.json", "utf8")
		expect(mockedReadLines).not.toHaveBeenCalled()
	})

	it("should handle very large JSON files (>2MB) with proper truncation", async () => {
		// Simulate a very large JSON file with thousands of lines
		const veryLargeJsonLines = ["{"]

		// Create a JSON with 10,000 items
		for (let i = 1; i <= 10000; i++) {
			const comma = i < 10000 ? "," : ""
			veryLargeJsonLines.push(`  "item_${i}": "value_${i}"${comma}`)
		}
		veryLargeJsonLines.push("}")

		mockedCountFileLines.mockResolvedValue(10002) // 10,000 items + opening and closing braces

		// Mock reading only the first 50 lines
		const first50Lines = veryLargeJsonLines.slice(0, 50).join("\n")
		mockedReadLines.mockResolvedValue(first50Lines)

		const result = await extractTextFromFile("/test/very-large.json", 50)

		// Should only include first 50 lines
		expect(result).toContain(" 1 | {")
		expect(result).toContain('50 |   "item_49": "value_49",')

		// Should NOT include lines beyond 50
		expect(result).not.toContain("51 |")
		expect(result).not.toContain("item_50")

		// Should include truncation message with correct counts
		expect(result).toContain(
			"[File truncated: showing 50 of 10002 total lines. The file is too large and may exhaust the context window if read in full.]",
		)
	})

	it("should handle JSON files with complex nested structures and truncate correctly", async () => {
		// Create a complex nested JSON structure
		const complexJsonLines = [
			"{",
			'  "config": {',
			'    "database": {',
			'      "host": "localhost",',
			'      "port": 5432,',
			'      "credentials": {',
			'        "username": "admin",',
			'        "password": "secret"',
			"      },",
			'      "options": {',
			'        "ssl": true,',
			'        "poolSize": 10,',
			'        "timeout": 30000,',
			'        "retryAttempts": 3,',
			'        "retryDelay": 1000',
			"      }",
			"    },",
			'    "server": {',
			'      "port": 3000,',
			'      "host": "0.0.0.0",',
			'      "middleware": [',
		]

		// Add many middleware entries to exceed 50 lines
		for (let i = 1; i <= 50; i++) {
			const comma = i < 50 ? "," : ""
			complexJsonLines.push(`        "middleware-${i}"${comma}`)
		}

		complexJsonLines.push("      ],")
		complexJsonLines.push('      "routes": [')

		// Add more routes
		for (let i = 1; i <= 30; i++) {
			const comma = i < 30 ? "," : ""
			complexJsonLines.push(`        "/route-${i}"${comma}`)
		}

		complexJsonLines.push("      ]")
		complexJsonLines.push("    }")
		complexJsonLines.push("  }")
		complexJsonLines.push("}")

		const totalLines = complexJsonLines.length
		mockedCountFileLines.mockResolvedValue(totalLines)

		// Mock reading only the first 50 lines
		const first50Lines = complexJsonLines.slice(0, 50).join("\n")
		mockedReadLines.mockResolvedValue(first50Lines)

		const result = await extractTextFromFile("/test/complex-config.json", 50)

		// Should truncate at line 50
		expect(result).toContain(" 1 | {")
		expect(result).toContain(' 2 |   "config": {')
		expect(result).toContain('50 |         "middleware-29",')

		// Should NOT include lines beyond 50
		expect(result).not.toContain("51 |")
		expect(result).not.toContain("middleware-31")

		// Should include truncation message
		expect(result).toContain(`[File truncated: showing 50 of ${totalLines} total lines`)
	})

	it("should handle JSON files with exactly maxReadFileLine lines", async () => {
		// Create a JSON with exactly 50 lines
		const exactJsonLines = ["{"]

		for (let i = 1; i <= 48; i++) {
			const comma = i < 48 ? "," : ""
			exactJsonLines.push(`  "field_${i}": "value_${i}"${comma}`)
		}
		exactJsonLines.push("}")

		const exactJsonContent = exactJsonLines.join("\n")

		mockedCountFileLines.mockResolvedValue(50)
		mockedFs.readFile.mockResolvedValue(exactJsonContent as any)

		const result = await extractTextFromFile("/test/exact-50-lines.json", 50)

		// Should include all 50 lines
		expect(result).toContain(" 1 | {")
		expect(result).toContain("50 | }")

		// Should NOT include truncation message since it's exactly at the limit
		expect(result).not.toContain("[File truncated:")

		// Should use fs.readFile since it's within the limit
		expect(mockedFs.readFile).toHaveBeenCalledWith("/test/exact-50-lines.json", "utf8")
		expect(mockedReadLines).not.toHaveBeenCalled()
	})
})
