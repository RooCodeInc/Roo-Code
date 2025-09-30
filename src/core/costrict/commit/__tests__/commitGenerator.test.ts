import { describe, it, expect, vi, beforeEach } from "vitest"
import { CommitMessageGenerator } from "../commitGenerator"
import type { GitDiffInfo } from "../types"

// Mock child_process exec
vi.mock("child_process", () => ({
	exec: vi.fn(),
}))

describe("CommitMessageGenerator", () => {
	let generator: CommitMessageGenerator

	beforeEach(() => {
		generator = new CommitMessageGenerator("/test/workspace")
	})

	describe("determineCommitType", () => {
		it("should return 'test' for test files", () => {
			const diffInfo: GitDiffInfo = {
				added: ["src/test/file.test.ts"],
				modified: [],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			// Use private method via any type
			const result = (generator as any).determineCommitType(diffInfo)
			expect(result).toBe("test")
		})

		it("should return 'docs' for documentation files", () => {
			const diffInfo: GitDiffInfo = {
				added: ["README.md"],
				modified: ["docs/api.md"],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			const result = (generator as any).determineCommitType(diffInfo)
			expect(result).toBe("docs")
		})

		it("should return 'chore' for config files", () => {
			const diffInfo: GitDiffInfo = {
				added: ["package.json"],
				modified: ["tsconfig.json"],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			const result = (generator as any).determineCommitType(diffInfo)
			expect(result).toBe("chore")
		})

		it("should return 'feat' for new files", () => {
			const diffInfo: GitDiffInfo = {
				added: ["src/new-feature.ts"],
				modified: [],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			const result = (generator as any).determineCommitType(diffInfo)
			expect(result).toBe("feat")
		})

		it("should return 'fix' for modified files", () => {
			const diffInfo: GitDiffInfo = {
				added: [],
				modified: ["src/existing-file.ts"],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			const result = (generator as any).determineCommitType(diffInfo)
			expect(result).toBe("fix")
		})
	})

	describe("generateSubjectLine", () => {
		it("should generate conventional commit format", () => {
			const diffInfo: GitDiffInfo = {
				added: ["src/feature/new-file.ts"],
				modified: [],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			const result = (generator as any).generateSubjectLine(diffInfo, "feat", true)
			expect(result).toMatch(/^feat\(.*\): .*/)
		})

		it("should generate simple format when conventional commits disabled", () => {
			const diffInfo: GitDiffInfo = {
				added: ["src/feature/new-file.ts"],
				modified: [],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			const result = (generator as any).generateSubjectLine(diffInfo, "feat", false)
			expect(result).not.toMatch(/^feat\(.*\): .*/)
		})
	})

	describe("hasChanges", () => {
		it("should return true when there are changes", () => {
			const diffInfo: GitDiffInfo = {
				added: ["file1.ts"],
				modified: [],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			const result = (generator as any).hasChanges(diffInfo)
			expect(result).toBe(true)
		})

		it("should return false when there are no changes", () => {
			const diffInfo: GitDiffInfo = {
				added: [],
				modified: [],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			const result = (generator as any).hasChanges(diffInfo)
			expect(result).toBe(false)
		})
	})
})
