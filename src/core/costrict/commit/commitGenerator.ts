import * as vscode from "vscode"
import { exec } from "child_process"
import { promisify } from "util"
import { spawn } from "child_process"
import type { GitDiffInfo, CommitMessageSuggestion, CommitGenerationOptions } from "./types"
import { ZgsmAuthStorage } from "../auth"
import { ProviderSettings } from "@roo-code/types"
import type { ClineProvider } from "../../webview/ClineProvider"
import { t } from "../../../i18n"
import { singleCompletionHandler } from "../../../utils/single-completion-handler"
import { truncateOutput } from "../../../integrations/misc/extract-text"

const execAsync = promisify(exec)

const GIT_OUTPUT_CHAR_LIMIT = 50_000
/**
 * Commit message generator service
 */
export class CommitMessageGenerator {
	private workspaceRoot: string
	private provider: ClineProvider | undefined

	constructor(workspaceRoot: string, provider?: ClineProvider) {
		this.workspaceRoot = workspaceRoot
		this.provider = provider
	}

	/**
	 * Get git diff information from the current workspace
	 */
	async getGitDiff(): Promise<GitDiffInfo> {
		try {
			// Get staged changes
			const { stdout: stagedDiff } = await execAsync("git diff --cached --name-status", {
				cwd: this.workspaceRoot,
				maxBuffer: 1024 * 1024 * 2, // 2MB buffer for file names
			})

			// Get unstaged changes
			const { stdout: unstagedDiff } = await execAsync("git diff --name-status", {
				cwd: this.workspaceRoot,
				maxBuffer: 1024 * 1024 * 2, // 2MB buffer for file names
			})

			// Get full diff content for analysis using streaming approach
			const fullDiff = await this.getGitDiffStreaming()

			const diffInfo: GitDiffInfo = {
				added: [],
				modified: [],
				deleted: [],
				renamed: [],
				diffContent: fullDiff,
			}

			// Parse staged changes
			this.parseDiffOutput(stagedDiff, diffInfo)

			// Parse unstaged changes
			this.parseDiffOutput(unstagedDiff, diffInfo)

			return diffInfo
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			throw new Error(t("commit:commit.error.failedToGetGitDiff", { 0: errorMessage }))
		}
	}

	/**
	 * Get git diff content using streaming approach to handle large diffs
	 */
	private async getGitDiffStreaming(): Promise<string> {
		return new Promise((resolve, reject) => {
			// 首先检查是否有任何提交
			execAsync("git rev-parse --verify HEAD", { cwd: this.workspaceRoot })
				.then(() => {
					// 有提交，使用 git diff HEAD
					this.runGitDiff(["diff", "HEAD"], resolve, reject)
				})
				.catch(() => {
					// 没有提交，使用 git diff 获取所有更改
					this.runGitDiff(["diff"], resolve, reject)
				})
		})
	}

	/**
	 * Run git diff command with specified arguments
	 */
	private runGitDiff(args: string[], resolve: (value: string) => void, reject: (reason?: any) => void): void {
		const git = spawn("git", args, { cwd: this.workspaceRoot })
		let output = ""
		let outputSize = 0
		const MAX_OUTPUT_SIZE = 1024 * 1024 * 10 // 10MB limit

		git.stdout.on("data", (data) => {
			const chunk = data.toString()
			outputSize += chunk.length

			// Check if we're approaching the size limit
			if (outputSize > MAX_OUTPUT_SIZE) {
				git.kill()
				reject(new Error(`Git diff output exceeds size limit of ${MAX_OUTPUT_SIZE} bytes`))
				return
			}

			output += chunk
		})

		git.stderr.on("data", (data) => {
			console.error("Git diff stderr:", data.toString())
		})

		git.on("close", (code) => {
			if (code === 0) {
				resolve(output)
			} else {
				reject(new Error(`Git diff process exited with code ${code}`))
			}
		})

		git.on("error", (error) => {
			reject(error)
		})
	}

	/**
	 * Parse git diff output and populate diff info
	 */
	private parseDiffOutput(diffOutput: string, diffInfo: GitDiffInfo): void {
		const lines = diffOutput.trim().split("\n")

		for (const line of lines) {
			if (!line.trim()) continue

			const parts = line.split("\t")
			if (parts.length < 2) continue

			const status = parts[0]
			const filePath = parts[1]

			switch (status) {
				case "A": // Added
					diffInfo.added.push(filePath)
					break
				case "M": // Modified
					diffInfo.modified.push(filePath)
					break
				case "D": // Deleted
					diffInfo.deleted.push(filePath)
					break
				case "R": // Renamed
					if (parts.length >= 3) {
						diffInfo.renamed.push(`${parts[1]} -> ${parts[2]}`)
					}
					break
			}
		}
	}

	/**
	 * Generate commit message based on diff analysis
	 */
	async generateCommitMessage(options: CommitGenerationOptions = {}): Promise<CommitMessageSuggestion> {
		const diffInfo = await this.getGitDiff()

		if (!this.hasChanges(diffInfo)) {
			throw new Error(t("commit:commit.error.noChanges"))
		}

		const aiSuggestion = await this.generateCommitMessageWithAI(diffInfo, options)
		console.log("commit meta:" + JSON.stringify(aiSuggestion))
		return aiSuggestion
	}

	/**
	 * Generate commit message using AI
	 */
	private async generateCommitMessageWithAI(
		diffInfo: GitDiffInfo,
		options: CommitGenerationOptions,
	): Promise<CommitMessageSuggestion> {
		// Get authentication tokens
		const tokens = await ZgsmAuthStorage.getInstance().getTokens()

		// Get language configuration
		let lang = this.getCommitLanguage(options)

		// Get API configuration
		let apiConfiguration: ProviderSettings | undefined
		if (this.provider) {
			const state = await this.provider.getState()
			apiConfiguration = state.apiConfiguration
			// Only use provider language if no specific commit language is configured
			if (!options.language || options.language === "auto") {
				lang = state.language || lang
			}
		}

		// Prepare prompt for AI
		const systemPrompt =
			"You are an expert at generating concise, meaningful commit messages based on git diff information. Follow conventional commit format when appropriate."
		let aiMessage = await singleCompletionHandler(
			apiConfiguration!,
			this.buildAIPrompt(diffInfo, options),
			systemPrompt,
			{
				language: lang,
				maxLength: options.maxLength,
				modelId: options.commitModelId,
			},
		)

		if (aiMessage.includes("</think>")) {
			// Remove the <think> tag
			aiMessage = (aiMessage.split("</think>")[1] || "").trim()
		}

		if (!aiMessage) {
			throw new Error(t("commit:commit.error.aiFailed"))
		}

		// Parse AI response into structured format
		return this.parseAIResponse(aiMessage, diffInfo)
	}

	/**
	 * Check if a file should only show filename without content in the prompt
	 */
	private shouldFilterFileContent(filePath: string): boolean {
		const fileExtensions = [
			// Image files
			".png",
			".jpg",
			".jpeg",
			".gif",
			".bmp",
			".svg",
			".webp",
			".ico",
			// Lock files
			".lock",
			".lock.json",
			"package-lock.json",
			"yarn.lock",
			"pnpm-lock.yaml",
			// Binary files
			".bin",
			".exe",
			".dll",
			".so",
			".dylib",
			".a",
			".lib",
			".o",
			// Archive files
			".zip",
			".tar",
			".gz",
			".bz2",
			".xz",
			".7z",
			".rar",
			".deb",
			".rpm",
			// Font files
			".ttf",
			".otf",
			".woff",
			".woff2",
			".eot",
			// Video files
			".mp4",
			".avi",
			".mov",
			".wmv",
			".flv",
			".webm",
			".mkv",
			// Audio files
			".mp3",
			".wav",
			".flac",
			".aac",
			".ogg",
			".wma",
			// Database files
			".db",
			".sqlite",
			".sqlite3",
			".mdb",
			".accdb",
			// Certificate files
			".pem",
			".crt",
			".cer",
			".key",
			".p12",
			".pfx",
			// Compiled files
			".class",
			".pyc",
			".pyo",
			".pyd",
			".dll",
			".exe",
			".so",
			// Large data files
			".dat",
			".data",
			".log",
			".tmp",
			".temp",
		]

		const fileName = filePath.toLowerCase()
		return (
			fileExtensions.some((ext) => fileName.endsWith(ext)) ||
			fileName.includes("package-lock.json") ||
			fileName.includes("yarn.lock") ||
			fileName.includes("pnpm-lock.yaml") ||
			fileName.includes(".lock")
		)
	}

	/**
	 * Filter diff content to exclude content from files that should only show filenames
	 */
	private filterDiffContent(diffContent: string, diffInfo: GitDiffInfo): string {
		const lines = diffContent.split("\n")
		const filteredLines: string[] = []
		let currentFile = ""
		let skipContent = false

		for (const line of lines) {
			// Check if this line starts a new file diff
			if (line.startsWith("diff --git")) {
				// Extract file path from diff line
				const match = line.match(/diff --git a\/(.+?) b\/(.+?)$/)
				if (match) {
					currentFile = match[1] // or match[2], they should be the same
					skipContent = this.shouldFilterFileContent(currentFile)
				}
				filteredLines.push(line)
			}
			// Skip file content for filtered files, but keep headers
			else if (
				skipContent &&
				(line.startsWith("+++") ||
					line.startsWith("---") ||
					line.startsWith("index") ||
					line.startsWith("new file") ||
					line.startsWith("deleted file"))
			) {
				filteredLines.push(line)
			}
			// Skip content lines (@@ lines and actual diff content) for filtered files
			else if (
				skipContent &&
				(line.startsWith("@@") || line.startsWith("+") || line.startsWith("-") || line.startsWith(" "))
			) {
				// Skip these lines for filtered files
				continue
			} else {
				filteredLines.push(line)
			}
		}

		return filteredLines.join("\n")
	}

	/**
	 * Build prompt for AI commit generation
	 */
	private buildAIPrompt(diffInfo: GitDiffInfo, options: CommitGenerationOptions): string {
		const { useConventionalCommits = true } = options
		const lang = this.getCommitLanguage(options)
		// Build language-specific prompt
		let prompt = t("commit:commit.prompt.prefix", { lng: lang })

		if (diffInfo.added.length > 0) {
			prompt += `Added files:\n${diffInfo.added.map((f) => `- ${f}`).join("\n")}\n\n`
		}

		if (diffInfo.modified.length > 0) {
			prompt += `Modified files:\n${diffInfo.modified.map((f) => `- ${f}`).join("\n")}\n\n`
		}

		if (diffInfo.deleted.length > 0) {
			prompt += `Deleted files:\n${diffInfo.deleted.map((f) => `- ${f}`).join("\n")}\n\n`
		}

		if (diffInfo.renamed.length > 0) {
			prompt += `Renamed files:\n${diffInfo.renamed.map((f) => `- ${f}`).join("\n")}\n\n`
		}

		// Filter diff content to exclude content from files that should only show filenames
		const filteredDiffContent = this.filterDiffContent(diffInfo.diffContent, diffInfo)

		prompt += `Diff content:\n${truncateOutput(filteredDiffContent, undefined, GIT_OUTPUT_CHAR_LIMIT)}\n\n`

		if (useConventionalCommits) {
			prompt += t("commit:commit.prompt.conventional", { lng: lang })
		} else {
			prompt += t("commit:commit.prompt.simple", { lng: lang })
		}

		prompt += t("commit:commit.prompt.return", { lng: lang })

		return prompt
	}

	/**
	 * Parse AI response into structured commit message
	 */
	private parseAIResponse(aiMessage: string, diffInfo: GitDiffInfo): CommitMessageSuggestion {
		// Extract subject and body from AI response
		const lines = aiMessage.split("\n").filter((line) => line.trim())
		const subject = lines[0]?.trim() || "Update files"

		let body: string | undefined
		if (lines.length > 1) {
			body = lines.slice(1).join("\n").trim()
			if (body === "") body = undefined
		}

		// Determine type based on AI response or fallback to analysis
		let type: CommitMessageSuggestion["type"] = "chore"
		const subjectLower = subject.toLowerCase()

		if (subjectLower.startsWith("feat") || subjectLower.includes("add") || subjectLower.includes("new")) {
			type = "feat"
		} else if (subjectLower.startsWith("fix") || subjectLower.includes("bug") || subjectLower.includes("issue")) {
			type = "fix"
		} else if (subjectLower.startsWith("docs")) {
			type = "docs"
		} else if (subjectLower.startsWith("test")) {
			type = "test"
		} else {
			// Fallback to rule-based type detection
			type = this.determineCommitType(diffInfo)
		}

		return {
			subject,
			body,
			type,
		}
	}

	/**
	 * Check if there are any changes
	 */
	private hasChanges(diffInfo: GitDiffInfo): boolean {
		return (
			diffInfo.added.length > 0 ||
			diffInfo.modified.length > 0 ||
			diffInfo.deleted.length > 0 ||
			diffInfo.renamed.length > 0
		)
	}

	/**
	 * Determine the type of commit based on file changes
	 */
	private determineCommitType(diffInfo: GitDiffInfo): CommitMessageSuggestion["type"] {
		// Enhanced file pattern matching with more precise rules
		const hasTestFiles = this.hasFilePattern(
			diffInfo,
			/\.(test|spec)\.(ts|js|tsx|jsx|py|java|go|rs|cpp|c)$|(^|\/)(__tests__|tests?|spec)\//i,
		)
		const hasDocFiles = this.hasFilePattern(diffInfo, /\.(md|rst|txt|adoc)$|(^|\/)docs?\//i)
		const hasStyleFiles = this.hasFilePattern(
			diffInfo,
			/\.(css|scss|sass|less|styl|stylus)(\.(d\.ts|map))?$|tailwind\.config\.(js|ts)$/i,
		)

		// More comprehensive config file patterns
		const hasConfigFiles = this.hasFilePattern(
			diffInfo,
			/^(package\.json|tsconfig.*\.json|\..*rc(\.(js|ts|json|yaml|yml))?|.*\.config\.(js|ts|json|yaml|yml)|webpack\..*\.(js|ts)|vite\.config\.(js|ts)|rollup\.config\.(js|ts))$|(^|\/)\.vscode\//i,
		)
		const hasLockFiles = this.hasFilePattern(
			diffInfo,
			/^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Pipfile\.lock|poetry\.lock|Cargo\.lock)$/i,
		)
		const hasWorkflowFiles = this.hasFilePattern(diffInfo, /(^|\/)\.github\/(workflows|actions)\//i)
		const hasDockerFiles = this.hasFilePattern(
			diffInfo,
			/(^|\/)(Dockerfile|docker-compose\.ya?ml|\.dockerignore)$|(^|\/)docker\//i,
		)
		const hasBuildFiles = this.hasFilePattern(diffInfo, /(^|\/)Makefile$|(^|\/)(build|scripts?)\//i)

		// Priority 1: Test files (highest priority)
		if (hasTestFiles) return "test"

		// Priority 2: Documentation files
		if (hasDocFiles) return "docs"

		// Priority 3: Style-only changes
		if (hasStyleFiles && this.isOnlyStyleChanges(diffInfo)) return "style"

		// Priority 4: Configuration and infrastructure changes
		if (hasWorkflowFiles || hasDockerFiles || hasLockFiles || hasConfigFiles || hasBuildFiles) return "chore"

		// Enhanced content analysis for performance and refactoring
		const diffContent = diffInfo.diffContent.toLowerCase()
		const perfKeywords =
			/(optimiz|performance|perf|cache|memo|throttle|debounce|lazy|async|await|promise|concurrent|parallel|batch|index|query|algorithm|complexity|memory|cpu|speed|fast|efficient)/i
		const refactorKeywords =
			/(refactor|rename|extract|inline|restructure|reorganize|cleanup|simplify|consolidate|split|merge|move|relocate)/i
		const fixKeywords = /(fix|bug|issue|error|exception|crash|fail|broken|incorrect|wrong|patch|hotfix)/i

		// Analyze change patterns
		const onlyModified =
			diffInfo.modified.length > 0 && diffInfo.added.length === 0 && diffInfo.deleted.length === 0
		const onlyAdded = diffInfo.added.length > 0 && diffInfo.modified.length === 0 && diffInfo.deleted.length === 0
		const hasDeleted = diffInfo.deleted.length > 0
		const hasRenamed = diffInfo.renamed.length > 0

		// Priority 5: Performance optimizations
		if (perfKeywords.test(diffContent)) {
			// Performance changes can be in modified files or new optimized implementations
			if (onlyModified || (diffInfo.modified.length > 0 && diffInfo.added.length <= diffInfo.modified.length)) {
				return "perf"
			}
		}

		// Priority 6: Refactoring (structural changes without new features)
		if (refactorKeywords.test(diffContent) || hasRenamed) {
			// Refactoring typically involves modifications and possibly renames
			if (onlyModified || hasRenamed || (diffInfo.modified.length > 0 && !onlyAdded)) {
				return "refactor"
			}
		}

		// Priority 7: Bug fixes (look for fix keywords or modification patterns suggesting fixes)
		if (fixKeywords.test(diffContent) || (onlyModified && diffInfo.modified.length <= 3)) {
			return "fix"
		}

		// Priority 8: Feature additions (new files or significant additions)
		if (onlyAdded || (diffInfo.added.length > 0 && diffInfo.added.length >= diffInfo.modified.length)) {
			return "feat"
		}

		// Priority 9: Mixed changes - determine by dominant pattern
		if (diffInfo.added.length > 0 && diffInfo.modified.length > 0) {
			// If more files added than modified, likely a feature
			if (diffInfo.added.length > diffInfo.modified.length) {
				return "feat"
			}
			// If more files modified than added, likely a fix or improvement
			if (diffInfo.modified.length > diffInfo.added.length) {
				return "fix"
			}
			// Equal amounts - default to feat for new functionality
			return "feat"
		}

		// Priority 10: Deletions (cleanup or removal)
		if (hasDeleted && diffInfo.added.length === 0 && diffInfo.modified.length === 0) {
			return "chore"
		}

		// Default fallback
		if (diffInfo.modified.length > 0) return "fix"
		if (diffInfo.added.length > 0) return "feat"

		return "chore"
	}

	/**
	 * Check if changes are only style-related
	 */
	private isOnlyStyleChanges(diffInfo: GitDiffInfo): boolean {
		const allFiles = [
			...diffInfo.added,
			...diffInfo.modified,
			...diffInfo.deleted,
			...diffInfo.renamed.map((r) => r.split(" -> ")[0]),
		]

		// Check if all files are style-related
		const stylePattern = /\.(css|scss|sass|less|styl|stylus)(\.(d\.ts|map))?$|tailwind\.config\.(js|ts)$/i
		return allFiles.length > 0 && allFiles.every((file) => stylePattern.test(file))
	}
	/**
	 * Check if any files match the given pattern
	 */
	private hasFilePattern(diffInfo: GitDiffInfo, pattern: RegExp): boolean {
		const allFiles = [
			...diffInfo.added,
			...diffInfo.modified,
			...diffInfo.deleted,
			...diffInfo.renamed.map((r) => r.split(" -> ")[0]),
		]

		return allFiles.some((file) => pattern.test(file))
	}

	/**
	 * Get commit language from options or configuration
	 */
	private getCommitLanguage(options: CommitGenerationOptions): string {
		// If language is specified in options, use it
		if (options.language && options.language !== "auto") {
			return options.language
		}

		// Get from VSCode configuration
		const config = vscode.workspace.getConfiguration("zgsm.commit")
		const configuredLanguage = config.get<string>("language", "auto")

		if (configuredLanguage !== "auto") {
			return configuredLanguage
		}

		// Fallback to VSCode environment language
		return vscode.env.language || "en"
	}
}
