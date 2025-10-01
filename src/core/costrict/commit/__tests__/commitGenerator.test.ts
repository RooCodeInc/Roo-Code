import { describe, it, expect, vi, beforeEach } from "vitest"
import { CommitMessageGenerator } from "../commitGenerator"
import type { GitDiffInfo, CommitGenerationOptions } from "../types"

// Mock child_process exec
vi.mock("child_process", () => ({
	exec: vi.fn(),
}))

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn((key: string, defaultValue: any) => defaultValue),
		})),
		createFileSystemWatcher: vi.fn(() => ({
			onDidChange: vi.fn(),
			onDidCreate: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
		workspaceFolders: [],
	},
	env: {
		language: "en",
		clipboard: {
			writeText: vi.fn(),
		},
	},
	RelativePattern: vi.fn(),
	window: {
		withProgress: vi.fn(),
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
	},
	ProgressLocation: {
		Notification: 15,
	},
	extensions: {
		getExtension: vi.fn(),
	},
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

	describe("getCommitLanguage", () => {
		it("should return language from options when specified", () => {
			const options: CommitGenerationOptions = {
				language: "zh-CN",
			}

			const result = (generator as any).getCommitLanguage(options)
			expect(result).toBe("zh-CN")
		})

		it("should return 'en' when language is 'auto' and no VSCode language", () => {
			const options: CommitGenerationOptions = {
				language: "auto",
			}

			const result = (generator as any).getCommitLanguage(options)
			expect(result).toBe("en")
		})

		it("should return default language when no language specified", () => {
			const options: CommitGenerationOptions = {}

			const result = (generator as any).getCommitLanguage(options)
			expect(result).toBe("en")
		})
	})

	describe("getLocalizedPromptPrefix", () => {
		it("should return Chinese prompt for zh-CN", () => {
			const result = (generator as any).getLocalizedPromptPrefix("zh-CN")
			expect(result).toContain("根据以下 git 变更生成提交信息")
		})

		it("should return Traditional Chinese prompt for zh-TW", () => {
			const result = (generator as any).getLocalizedPromptPrefix("zh-TW")
			expect(result).toContain("根據以下 git 變更生成提交訊息")
		})

		it("should return English prompt for other languages", () => {
			const result = (generator as any).getLocalizedPromptPrefix("en")
			expect(result).toContain("Generate a commit message based on the following git changes")
		})
	})

	describe("getLocalizedConventionalPrompt", () => {
		it("should return Chinese conventional prompt for zh-CN", () => {
			const result = (generator as any).getLocalizedConventionalPrompt("zh-CN")
			expect(result).toContain("约定式提交格式")
		})

		it("should return Traditional Chinese conventional prompt for zh-TW", () => {
			const result = (generator as any).getLocalizedConventionalPrompt("zh-TW")
			expect(result).toContain("約定式提交格式")
		})

		it("should return English conventional prompt for other languages", () => {
			const result = (generator as any).getLocalizedConventionalPrompt("en")
			expect(result).toContain("conventional commit format")
		})
	})

	describe("getLocalizedSimplePrompt", () => {
		it("should return Chinese simple prompt for zh-CN", () => {
			const result = (generator as any).getLocalizedSimplePrompt("zh-CN")
			expect(result).toContain("简洁的提交信息")
		})

		it("should return Traditional Chinese simple prompt for zh-TW", () => {
			const result = (generator as any).getLocalizedSimplePrompt("zh-TW")
			expect(result).toContain("簡潔的提交訊息")
		})

		it("should return English simple prompt for other languages", () => {
			const result = (generator as any).getLocalizedSimplePrompt("en")
			expect(result).toContain("concise commit message")
		})
	})

	describe("getLocalizedReturnPrompt", () => {
		it("should return Chinese return prompt for zh-CN", () => {
			const result = (generator as any).getLocalizedReturnPrompt("zh-CN")
			expect(result).toContain("只返回提交信息")
		})

		it("should return Traditional Chinese return prompt for zh-TW", () => {
			const result = (generator as any).getLocalizedReturnPrompt("zh-TW")
			expect(result).toContain("只返回提交訊息")
		})

		it("should return English return prompt for other languages", () => {
			const result = (generator as any).getLocalizedReturnPrompt("en")
			expect(result).toContain("Return only the commit message")
		})
	})

	describe("shouldFilterFileContent", () => {
		it("should return true for image files", () => {
			const result = (generator as any).shouldFilterFileContent("image.png")
			expect(result).toBe(true)

			const result2 = (generator as any).shouldFilterFileContent("photo.jpg")
			expect(result2).toBe(true)

			const result3 = (generator as any).shouldFilterFileContent("logo.svg")
			expect(result3).toBe(true)
		})

		it("should return true for lock files", () => {
			const result = (generator as any).shouldFilterFileContent("package-lock.json")
			expect(result).toBe(true)

			const result2 = (generator as any).shouldFilterFileContent("yarn.lock")
			expect(result2).toBe(true)

			const result3 = (generator as any).shouldFilterFileContent("pnpm-lock.yaml")
			expect(result3).toBe(true)
		})

		it("should return true for binary files", () => {
			const result = (generator as any).shouldFilterFileContent("program.exe")
			expect(result).toBe(true)

			const result2 = (generator as any).shouldFilterFileContent("library.so")
			expect(result2).toBe(true)
		})

		it("should return false for regular source files", () => {
			const result = (generator as any).shouldFilterFileContent("index.ts")
			expect(result).toBe(false)

			const result2 = (generator as any).shouldFilterFileContent("styles.css")
			expect(result2).toBe(false)

			const result3 = (generator as any).shouldFilterFileContent("README.md")
			expect(result3).toBe(false)
		})
	})

	describe("filterDiffContent", () => {
		it("should filter content for image files", () => {
			const diffContent = `diff --git a/image.png b/image.png
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/image.png
@@ -0,0 +1 @@
+binary content here
diff --git a/src/index.ts b/src/index.ts
index 1234567..89abcde 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,1 +1,2 @@
	console.log("hello")
+console.log("world")`

			const diffInfo: GitDiffInfo = {
				added: ["image.png", "src/index.ts"],
				modified: [],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			const result = (generator as any).filterDiffContent(diffContent, diffInfo)
			expect(result).toContain("diff --git a/image.png b/image.png")
			expect(result).not.toContain("binary content here")
			expect(result).toContain('console.log("world")')
		})

		it("should filter content for lock files", () => {
			const diffContent = `diff --git a/package-lock.json b/package-lock.json
index 1234567..89abcde 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,5 +1,5 @@
	{
-  "name": "test"
+  "name": "test-updated"
	}
diff --git a/src/app.ts b/src/app.ts
index 1234567..89abcde 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,1 +1,2 @@
	const app = "test"
+const version = "1.0.0"`

			const diffInfo: GitDiffInfo = {
				added: [],
				modified: ["package-lock.json", "src/app.ts"],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			const result = (generator as any).filterDiffContent(diffContent, diffInfo)
			expect(result).toContain("diff --git a/package-lock.json b/package-lock.json")
			expect(result).not.toContain('"name": "test-updated"')
			expect(result).toContain('const version = "1.0.0"')
		})

		it("should not filter content for regular files", () => {
			const diffContent = `diff --git a/src/index.ts b/src/index.ts
index 1234567..89abcde 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,1 +1,2 @@
	console.log("hello")
+console.log("world")`

			const diffInfo: GitDiffInfo = {
				added: [],
				modified: ["src/index.ts"],
				deleted: [],
				renamed: [],
				diffContent: "",
			}

			const result = (generator as any).filterDiffContent(diffContent, diffInfo)
			expect(result).toContain('console.log("hello")')
			expect(result).toContain('console.log("world")')
		})
	})
})
