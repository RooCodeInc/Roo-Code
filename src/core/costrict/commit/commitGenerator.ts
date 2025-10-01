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

const execAsync = promisify(exec)

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
			const git = spawn("git", ["diff", "HEAD"], { cwd: this.workspaceRoot })
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

		// Try AI generation first, fallback to rule-based if AI fails
		try {
			const aiSuggestion = await this.generateCommitMessageWithAI(diffInfo, options)
			return aiSuggestion
		} catch (error) {
			this.provider?.log("AI generation failed, falling back to rule-based: " + error?.message)
			// Fallback to rule-based analysis
			const suggestion = this.analyzeChanges(diffInfo, options)
			return suggestion
		}
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
		const aiMessage = await singleCompletionHandler(
			apiConfiguration!,
			this.buildAIPrompt(diffInfo, options),
			systemPrompt,
			{
				language: lang,
				maxLength: options.maxLength,
			},
		)
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
		const { useConventionalCommits = true, language } = options
		const lang = this.getCommitLanguage(options)

		// Build language-specific prompt
		let prompt = this.getLocalizedPromptPrefix(lang)

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
		prompt += `Diff content:\n${filteredDiffContent}\n\n`

		if (useConventionalCommits) {
			prompt += this.getLocalizedConventionalPrompt(lang)
		} else {
			prompt += this.getLocalizedSimplePrompt(lang)
		}

		prompt += this.getLocalizedReturnPrompt(lang)

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
	 * Analyze git changes and generate commit message
	 */
	private analyzeChanges(diffInfo: GitDiffInfo, options: CommitGenerationOptions): CommitMessageSuggestion {
		const { useConventionalCommits = true, includeFileChanges = true, maxLength } = options

		// Determine commit type based on file changes
		const commitType = this.determineCommitType(diffInfo)

		// Generate subject line
		let subject = this.generateSubjectLine(diffInfo, commitType, useConventionalCommits)
		// Respect maxLength for subject if provided
		if (typeof maxLength === "number" && maxLength > 0 && subject.length > maxLength) {
			subject = subject.slice(0, Math.max(1, maxLength)).trim()
		}

		// Generate body if needed
		let body = includeFileChanges ? this.generateBody(diffInfo) : undefined
		if (body && typeof maxLength === "number" && maxLength > 0 && body.length > maxLength) {
			body = body.slice(0, Math.max(1, maxLength)).trim()
		}

		return {
			subject,
			body,
			type: commitType,
		}
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
	 * Generate subject line for commit message
	 */
	private generateSubjectLine(
		diffInfo: GitDiffInfo,
		commitType: CommitMessageSuggestion["type"],
		useConventionalCommits: boolean,
	): string {
		const changeCount = this.getTotalChanges(diffInfo)

		if (useConventionalCommits) {
			const scope = this.determineScope(diffInfo)
			const scopePart = scope ? `(${scope})` : ""

			const action = this.getActionDescription(diffInfo, commitType)

			return `${commitType}${scopePart}: ${action}`
		} else {
			const action = this.getActionDescription(diffInfo, commitType)
			return `${action}`
		}
	}

	/**
	 * Get total number of changes
	 */
	private getTotalChanges(diffInfo: GitDiffInfo): number {
		return diffInfo.added.length + diffInfo.modified.length + diffInfo.deleted.length + diffInfo.renamed.length
	}

	/**
	 * Determine scope based on file changes
	 */
	private determineScope(diffInfo: GitDiffInfo): string | undefined {
		const allFiles = [
			...diffInfo.added,
			...diffInfo.modified,
			...diffInfo.deleted,
			...diffInfo.renamed.map((r) => r.split(" -> ")[0]),
		]

		// Prefer monorepo package scopes like packages/* or apps/*
		const monorepoScopeCandidates = allFiles
			.map((file) => {
				const parts = file.split("/")
				if (parts.length >= 2 && (parts[0] === "packages" || parts[0] === "apps")) {
					return `${parts[0]}/${parts[1]}`
				}
				return undefined
			})
			.filter(Boolean) as string[]
		if (monorepoScopeCandidates.length > 0) {
			return this.getMostCommon(monorepoScopeCandidates)
		}

		// Fallback to top-level directory
		const topDirs = allFiles
			.map((file) => {
				const parts = file.split("/")
				return parts.length > 1 ? parts[0] : undefined
			})
			.filter(Boolean) as string[]
		if (topDirs.length > 0) {
			return this.getMostCommon(topDirs)
		}

		// As a last resort, try second-level directory to avoid empty scope
		const secondLevelDirs = allFiles
			.map((file) => {
				const parts = file.split("/")
				return parts.length > 2 ? `${parts[0]}/${parts[1]}` : undefined
			})
			.filter(Boolean) as string[]
		if (secondLevelDirs.length > 0) {
			return this.getMostCommon(secondLevelDirs)
		}

		return undefined
	}

	/**
	 * Get the most common element in an array
	 */
	private getMostCommon(arr: string[]): string {
		const frequency: Record<string, number> = {}
		let maxCount = 0
		let mostCommon = arr[0]

		for (const item of arr) {
			frequency[item] = (frequency[item] || 0) + 1
			if (frequency[item] > maxCount) {
				maxCount = frequency[item]
				mostCommon = item
			}
		}

		return mostCommon
	}

	/**
	 * Get action description based on changes
	 */
	private getActionDescription(diffInfo: GitDiffInfo, commitType: CommitMessageSuggestion["type"]): string {
		const added = diffInfo.added.length
		const modified = diffInfo.modified.length
		const deleted = diffInfo.deleted.length
		const renamed = diffInfo.renamed.length
		const changeCount = added + modified + deleted + renamed

		const verb = (() => {
			if (added > 0 && modified === 0 && deleted === 0 && renamed === 0) return "add"
			if (deleted > 0 && added === 0 && modified === 0 && renamed === 0) return "remove"
			if (renamed > 0 && added === 0 && modified === 0 && deleted === 0) return "rename"
			if (commitType === "refactor") return "refactor"
			if (commitType === "style") return "style"
			if (commitType === "perf") return "optimize"
			if (commitType === "fix") return modified > 0 ? "fix" : "update"
			return added > 0 ? "implement" : "update"
		})()

		if (changeCount === 1) {
			const file = [
				...diffInfo.added,
				...diffInfo.modified,
				...diffInfo.deleted,
				...diffInfo.renamed.map((r) => r.split(" -> ")[0]),
			][0]
			const fileName = file.split("/").pop() || file
			return `${verb} ${fileName}`
		}

		// multi-file changes
		if (commitType === "docs") return "update documentation"
		if (commitType === "test") return "add tests"
		if (commitType === "style") return "style changes"
		if (commitType === "refactor") return "refactor code"
		if (commitType === "perf") return "optimize performance"
		if (commitType === "fix") return `fix issues in ${changeCount} files`
		if (commitType === "feat") return `implement changes in ${changeCount} files`
		return `update ${changeCount} files`
	}

	/**
	 * Generate body for commit message
	 */
	private generateBody(diffInfo: GitDiffInfo): string {
		const lines: string[] = []

		// const summary = `Added: ${diffInfo.added.length}, Modified: ${diffInfo.modified.length}, Deleted: ${diffInfo.deleted.length}, Renamed: ${diffInfo.renamed.length}`
		// lines.push(summary)
		// if (lines.length > 0) lines.push("")

		if (diffInfo.added.length > 0) {
			lines.push(t("commit:commit.files.added"))
			diffInfo.added.forEach((file) => lines.push(`- ${file}`))
		}

		if (diffInfo.modified.length > 0) {
			if (lines.length > 0) lines.push("")
			lines.push(t("commit:commit.files.modified"))
			diffInfo.modified.forEach((file) => lines.push(`- ${file}`))
		}

		if (diffInfo.deleted.length > 0) {
			if (lines.length > 0) lines.push("")
			lines.push(t("commit:commit.files.deleted"))
			diffInfo.deleted.forEach((file) => lines.push(`- ${file}`))
		}

		if (diffInfo.renamed.length > 0) {
			if (lines.length > 0) lines.push("")
			lines.push(t("commit:commit.files.renamed"))
			diffInfo.renamed.forEach((rename) => lines.push(`- ${rename}`))
		}

		return lines.join("\n")
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

	/**
	 * Get localized prompt prefix based on language
	 */
	private getLocalizedPromptPrefix(lang: string): string {
		switch (lang) {
			case "zh-CN":
				return `根据以下 git 变更生成提交信息：\n\n`
			case "zh-TW":
				return `根據以下 git 變更生成提交訊息：\n\n`
			default:
				return `Generate a commit message based on the following git changes:\n\n`
		}
	}

	/**
	 * Get localized conventional commit prompt
	 */
	private getLocalizedConventionalPrompt(lang: string): string {
		switch (lang) {
			case "zh-CN":
				return `请生成遵循约定式提交格式的提交信息 (type(scope): description)。`
			case "zh-TW":
				return `請生成遵循約定式提交格式的提交訊息 (type(scope): description)。`
			default:
				return `Please generate a commit message following conventional commit format (type(scope): description).`
		}
	}

	/**
	 * Get localized simple commit prompt
	 */
	private getLocalizedSimplePrompt(lang: string): string {
		switch (lang) {
			case "zh-CN":
				return `请生成简洁的提交信息。`
			case "zh-TW":
				return `請生成簡潔的提交訊息。`
			default:
				return `Please generate a concise commit message.`
		}
	}

	/**
	 * Get localized return instruction
	 */
	private getLocalizedReturnPrompt(lang: string): string {
		switch (lang) {
			case "zh-CN":
				return ` 只返回提交信息，不要解释。`
			case "zh-TW":
				return ` 只返回提交訊息，不要解釋。`
			default:
				return ` Return only the commit message, no explanations.`
		}
	}
}
