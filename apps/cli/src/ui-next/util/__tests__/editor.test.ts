/**
 * Tests for external editor support.
 */

import { execSync } from "child_process"
import { writeFileSync, readFileSync, unlinkSync } from "fs"
import { openEditor } from "../editor.js"

vi.mock("child_process")
vi.mock("fs")

describe("openEditor", () => {
	const mockExecSync = execSync as unknown as ReturnType<typeof vi.fn>
	const mockWriteFileSync = writeFileSync as unknown as ReturnType<typeof vi.fn>
	const mockReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>
	const mockUnlinkSync = unlinkSync as unknown as ReturnType<typeof vi.fn>

	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		originalEnv = { ...process.env }
		vi.clearAllMocks()
		mockReadFileSync.mockReturnValue("edited content")
	})

	afterEach(() => {
		process.env = originalEnv
	})

	it("opens $EDITOR with initial content", () => {
		process.env.EDITOR = "nano"
		const result = openEditor("initial text")

		expect(mockWriteFileSync).toHaveBeenCalledWith(
			expect.stringMatching(/roo-edit-\d+\.md$/),
			"initial text",
			"utf-8",
		)
		expect(mockExecSync).toHaveBeenCalledWith(expect.stringMatching(/^nano .*roo-edit-\d+\.md$/), {
			stdio: "inherit",
		})
		expect(result).toBe("edited content")
	})

	it("opens $VISUAL if $EDITOR not set", () => {
		delete process.env.EDITOR
		process.env.VISUAL = "vim"
		openEditor()

		expect(mockExecSync).toHaveBeenCalledWith(expect.stringMatching(/^vim .*roo-edit-\d+\.md$/), {
			stdio: "inherit",
		})
	})

	it("defaults to 'vi' if no editor is set", () => {
		delete process.env.EDITOR
		delete process.env.VISUAL
		openEditor()

		expect(mockExecSync).toHaveBeenCalledWith(expect.stringMatching(/^vi .*roo-edit-\d+\.md$/), {
			stdio: "inherit",
		})
	})

	it("uses empty string as initial content if not provided", () => {
		process.env.EDITOR = "nano"
		openEditor()

		expect(mockWriteFileSync).toHaveBeenCalledWith(expect.any(String), "", "utf-8")
	})

	it("returns edited content from file", () => {
		process.env.EDITOR = "nano"
		mockReadFileSync.mockReturnValue("new edited text")

		const result = openEditor()
		expect(result).toBe("new edited text")
	})

	it("cleans up temporary file after success", () => {
		process.env.EDITOR = "nano"
		openEditor()

		expect(mockUnlinkSync).toHaveBeenCalledWith(expect.stringMatching(/roo-edit-\d+\.md$/))
	})

	it("returns null if editor execution fails", () => {
		process.env.EDITOR = "nano"
		mockExecSync.mockImplementation(() => {
			throw new Error("Editor failed")
		})

		const result = openEditor()
		expect(result).toBeNull()
	})

	it("still attempts cleanup if editor fails", () => {
		process.env.EDITOR = "nano"
		mockExecSync.mockImplementation(() => {
			throw new Error("Editor failed")
		})

		openEditor()
		expect(mockUnlinkSync).toHaveBeenCalled()
	})

	it("handles cleanup errors gracefully", () => {
		process.env.EDITOR = "nano"
		mockUnlinkSync.mockImplementation(() => {
			throw new Error("Cannot delete file")
		})

		// Should not throw
		expect(() => openEditor()).not.toThrow()
	})

	it("creates temp file with timestamp in name", () => {
		process.env.EDITOR = "nano"
		const beforeTime = Date.now()
		openEditor()
		const afterTime = Date.now()

		const writeCall = mockWriteFileSync.mock.calls[0]
		const filePath = writeCall![0] as string
		const timestampMatch = filePath.match(/roo-edit-(\d+)\.md$/)
		expect(timestampMatch).toBeTruthy()

		const timestamp = parseInt(timestampMatch![1]!, 10)
		expect(timestamp).toBeGreaterThanOrEqual(beforeTime)
		expect(timestamp).toBeLessThanOrEqual(afterTime)
	})
})
