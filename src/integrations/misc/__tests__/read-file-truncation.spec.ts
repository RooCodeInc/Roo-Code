import { promises as fs } from "fs"
import path from "path"
import { readIndentationBlock } from "../read-file-content"

describe("readIndentationBlock truncation", () => {
	const testDir = __dirname

	async function withTempFile(filename: string, content: string, testFn: (filepath: string) => Promise<void>) {
		const filepath = path.join(testDir, filename)
		await fs.writeFile(filepath, content)
		try {
			await testFn(filepath)
		} finally {
			await fs.unlink(filepath)
		}
	}

	it("should NOT be truncated when block size equals limit and no content remains", async () => {
		// Use indentation to ensure lines are treated as content block, not siblings
		const content = "  Line 1\n  Line 2\n  Line 3"
		await withTempFile("truncation-exact-test.txt", content, async (filepath) => {
			const result = await readIndentationBlock(filepath, 1, 3)
			// Should get all 3 lines
			expect(result.lineCount).toBe(3)
			expect(result.metadata.truncatedByLimit).toBe(false)
		})
	})

	it("should be truncated when block size exceeds limit", async () => {
		// Use indentation to ensure lines are treated as content block, not siblings
		const content = "  Line 1\n  Line 2\n  Line 3\n  Line 4"
		await withTempFile("truncation-exceeds-test.txt", content, async (filepath) => {
			const result = await readIndentationBlock(filepath, 1, 3)
			// Should get 3 lines
			expect(result.lineCount).toBe(3)
			expect(result.metadata.truncatedByLimit).toBe(true)
		})
	})

	it("should NOT be truncated when block ends naturally before limit (with maxLevels)", async () => {
		// Block: lines 1-2 (indent 8). File has lines 3-4 (indent 0). Limit 10.
		// maxLevels: 1 => minIndent = 8 - 4 = 4.
		const content = "        Line 1\n        Line 2\nLine 3\nLine 4"
		await withTempFile("truncation-natural-end-levels-test.txt", content, async (filepath) => {
			const result = await readIndentationBlock(filepath, 1, 10, {
				anchorLine: 1,
				maxLevels: 1,
			})
			// Should get 2 lines (Line 1, Line 2)
			expect(result.lineCount).toBe(2)
			expect(result.metadata.truncatedByLimit).toBe(false)
		})
	})

	it("should be truncated when block continues but limit reached", async () => {
		// Block: lines 1-4. Limit 3.
		const content = "  Line 1\n  Line 2\n  Line 3\n  Line 4"
		await withTempFile("truncation-limit-reached-test.txt", content, async (filepath) => {
			const result = await readIndentationBlock(filepath, 1, 3, { anchorLine: 1 })
			expect(result.lineCount).toBe(3)
			expect(result.metadata.truncatedByLimit).toBe(true)
		})
	})
})
