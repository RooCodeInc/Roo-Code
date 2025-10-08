import { describe, it, expect, beforeEach, vi, type Mock } from "vitest"
import path from "path"

// Under test
import * as ripgrepMod from "../index"
import { regexSearchFiles } from "../index"
import { GitIgnoreController } from "../../../core/ignore/GitIgnoreController"

// Mocks
import * as fsPromises from "fs/promises"
import type { Dirent } from "fs"
import * as fileUtils from "../../../utils/fs"

// Mock vscode (env + watchers used by controllers)
vi.mock("vscode", () => {
	const mockDisposable = { dispose: vi.fn() }
	return {
		env: { appRoot: "/fake/vscode" },
		workspace: {
			createFileSystemWatcher: vi.fn(() => ({
				onDidCreate: vi.fn(() => mockDisposable),
				onDidChange: vi.fn(() => mockDisposable),
				onDidDelete: vi.fn(() => mockDisposable),
				dispose: vi.fn(),
			})),
		},
		RelativePattern: vi.fn().mockImplementation((base: string, pattern: string) => ({ base, pattern })),
	}
})

// Mock child_process.spawn to simulate ripgrep JSON line output
vi.mock("child_process", () => {
	const { PassThrough } = require("stream")
	const { EventEmitter } = require("events")

	return {
		spawn: (_bin: string, _args: string[]) => {
			const proc = new EventEmitter()
			const stdout = new PassThrough()
			const stderr = new PassThrough()
			// Expose stdout/stderr streams
			;(proc as any).stdout = stdout
			;(proc as any).stderr = stderr
			;(proc as any).kill = vi.fn(() => {
				stdout.end()
				stderr.end()
			})

			// Defer writing until next tick to simulate async process output
			setImmediate(() => {
				const lines: string[] = (globalThis as any).__RG_LINES__ ?? []
				for (const ln of lines) {
					stdout.write(ln + "\n")
				}
				stdout.end()
			})

			return proc
		},
	}
})

// Ensure fs/promises and file utils are mockable from tests
// Provide explicit mock factory so readdir/readFile are defined vi.fn()
vi.mock("fs/promises", () => {
	const mockReaddir = vi.fn()
	const mockReadFile = vi.fn()
	return {
		readdir: mockReaddir,
		readFile: mockReadFile,
		default: {
			readdir: mockReaddir,
			readFile: mockReadFile,
		},
	}
})
vi.mock("../../../utils/fs")
// Mock fs so BaseIgnoreController's realpathSync won't touch the real filesystem
vi.mock("fs", () => ({
	realpathSync: vi.fn((filePath: any) => filePath.toString()),
}))

describe("regexSearchFiles + GitIgnoreController integration (nested .gitignore filtering)", () => {
	const REPO = "/tmp/repo" // test workspace root
	let mockReaddir: Mock<typeof fsPromises.readdir>
	let mockReadFile: Mock<typeof fsPromises.readFile>
	let mockFileExists: Mock<typeof fileUtils.fileExistsAtPath>

	beforeEach(() => {
		vi.clearAllMocks()

		// Obtain mocked fs/promises fns from mock factory
		const anyFs = fsPromises as any
		mockReaddir = anyFs.readdir as unknown as Mock<typeof fsPromises.readdir>
		mockReadFile = anyFs.readFile as unknown as Mock<typeof fsPromises.readFile>

		mockFileExists = fileUtils.fileExistsAtPath as unknown as Mock<typeof fileUtils.fileExistsAtPath>

		// Provide a fake ripgrep path so getBinPath succeeds regardless of VSCode layout
		vi.spyOn(ripgrepMod, "getBinPath").mockResolvedValue("/fake/rg")

		// realpathSync handled by vi.mock("fs") factory above

		// Default: no files exist
		mockFileExists.mockResolvedValue(false)

		// Default dirents helper
		const dirent = (name: string, isDir: boolean): Dirent =>
			({
				name,
				isDirectory: () => isDir,
				isFile: () => !isDir,
				isSymbolicLink: () => false,
			}) as unknown as Dirent
		// Default readdir: empty
		mockReaddir.mockImplementation(async (_p: any, _opts?: any) => {
			return [] as any
		})

		// Default readFile: empty
		mockReadFile.mockResolvedValue("")
	})

	it("excludes matches from files ignored by nested src/.gitignore patterns while keeping allowed files", async () => {
		// Arrange a nested .gitignore structure:
		// REPO/
		//   src/.gitignore  => '*.tmp' (ignore), '!keep.tmp' (negation)
		//   src/ignored.tmp (should be filtered)
		//   src/keep.tmp    (should be kept due to negation)
		//   README.md       (not under src, unaffected)
		//
		// GitIgnoreController recursively discovers src/.gitignore and adjusts patterns relative to REPO.

		// File existence for .gitignore files AND ripgrep binary resolution
		mockFileExists.mockImplementation(async (p: string) => {
			// Make getBinPath succeed by faking rg binary under VSCode appRoot
			const binName = process.platform.startsWith("win") ? "rg.exe" : "rg"
			const rgCandidate = path.join("/fake/vscode", "node_modules/@vscode/ripgrep/bin/", binName)
			if (p === rgCandidate) return true

			if (p === path.join(REPO, "src", ".gitignore")) return true
			// root .gitignore does not exist for this test
			if (p === path.join(REPO, ".gitignore")) return false
			return false
		})

		// Directory tree: REPO has 'src' subdir
		const dirent = (name: string, isDir: boolean): Dirent =>
			({
				name,
				isDirectory: () => isDir,
				isFile: () => !isDir,
				isSymbolicLink: () => false,
			}) as unknown as Dirent

		mockReaddir.mockImplementation(async (p: any, _opts?: any) => {
			if (p === REPO) {
				return [dirent("src", true)] as any
			}
			if (p === path.join(REPO, "src")) {
				// No further subdirectories required for this test
				return [] as any
			}
			return [] as any
		})

		// src/.gitignore content
		mockReadFile.mockImplementation(async (p: any, _enc?: any) => {
			if (p === path.join(REPO, "src", ".gitignore")) {
				return "*.tmp\n!keep.tmp\n"
			}
			return ""
		})

		// Prepare ripgrep JSON lines for three files: ignored.tmp, keep.tmp, README.md
		const rgLines = [
			// src/ignored.tmp
			JSON.stringify({ type: "begin", data: { path: { text: "src/ignored.tmp" } } }),
			JSON.stringify({
				type: "match",
				data: { line_number: 1, lines: { text: "foo" }, absolute_offset: 1 },
			}),
			JSON.stringify({ type: "end", data: {} }),

			// src/keep.tmp
			JSON.stringify({ type: "begin", data: { path: { text: "src/keep.tmp" } } }),
			JSON.stringify({
				type: "match",
				data: { line_number: 2, lines: { text: "foo" }, absolute_offset: 10 },
			}),
			JSON.stringify({ type: "end", data: {} }),

			// README.md (outside src, unaffected)
			JSON.stringify({ type: "begin", data: { path: { text: "README.md" } } }),
			JSON.stringify({
				type: "match",
				data: { line_number: 3, lines: { text: "foo" }, absolute_offset: 20 },
			}),
			JSON.stringify({ type: "end", data: {} }),
		]
		;(globalThis as any).__RG_LINES__ = rgLines

		// Initialize controller with nested .gitignore
		const git = new GitIgnoreController(REPO)
		await git.initialize()
		// Sanity-check controller behavior before invoking ripgrep filter
		expect(git.hasGitignoreFiles()).toBe(true)
		expect(git.validateAccess("src/ignored.tmp")).toBe(false)
		expect(git.validateAccess("src/keep.tmp")).toBe(true)

		// Act
		const out = await regexSearchFiles(REPO, REPO, "foo", "*", undefined, git)

		// Assert: filtered summary and per-file sections
		// - src/ignored.tmp must be filtered out
		// - src/keep.tmp must be present (negation)
		// - README.md must be present
		expect(out).not.toContain("# src/ignored.tmp")
		expect(out).toContain("# src/keep.tmp")
		expect(out).toContain("# README.md")
	})
})
