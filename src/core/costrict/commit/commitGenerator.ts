import * as vscode from "vscode"
import { exec } from "child_process"
import { promisify } from "util"
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
			})

			// Get unstaged changes
			const { stdout: unstagedDiff } = await execAsync("git diff --name-status", {
				cwd: this.workspaceRoot,
			})

			// Get full diff content for analysis
			const { stdout: fullDiff } = await execAsync("git diff HEAD", {
				cwd: this.workspaceRoot,
			})

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
		// if (!tokens?.access_token) {
		// 	throw new Error(t("commit:commit.error.authRequired"))
		// }
		let lang = vscode.env.language
		// Get API configuration
		let apiConfiguration: ProviderSettings | undefined
		if (this.provider) {
			const state = await this.provider.getState()
			apiConfiguration = state.apiConfiguration
			lang = state.language || lang
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
			},
		)
		if (!aiMessage) {
			throw new Error(t("commit:commit.error.aiFailed"))
		}

		// Parse AI response into structured format
		return this.parseAIResponse(aiMessage, diffInfo)
	}

	/**
	 * Build prompt for AI commit generation
	 */
	private buildAIPrompt(diffInfo: GitDiffInfo, options: CommitGenerationOptions): string {
		const { useConventionalCommits = true } = options

		let prompt = `Generate a commit message based on the following git changes:\n\n`

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

		prompt += `Diff content:\n${diffInfo.diffContent}\n\n`

		if (useConventionalCommits) {
			prompt += `Please generate a commit message following conventional commit format (type(scope): description).`
		} else {
			prompt += `Please generate a concise commit message.`
		}

		prompt += ` Return only the commit message, no explanations.`

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
		const { useConventionalCommits = true, includeFileChanges = true } = options

		// Determine commit type based on file changes
		const commitType = this.determineCommitType(diffInfo)

		// Generate subject line
		const subject = this.generateSubjectLine(diffInfo, commitType, useConventionalCommits)

		// Generate body if needed
		const body = includeFileChanges ? this.generateBody(diffInfo) : undefined

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
		// Check for specific file patterns to determine commit type
		const hasTestFiles = this.hasFilePattern(diffInfo, /\.test\.|\.spec\.|test\/|spec\//)
		const hasDocFiles = this.hasFilePattern(diffInfo, /\.md$|docs?\//)
		const hasConfigFiles = this.hasFilePattern(diffInfo, /package\.json|tsconfig\.json|\.config\./)

		if (hasTestFiles) return "test"
		if (hasDocFiles) return "docs"
		if (hasConfigFiles) return "chore"

		// Default to feat for new files, fix for modifications
		if (diffInfo.added.length > 0) return "feat"
		if (diffInfo.modified.length > 0) return "fix"

		return "chore"
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

		// Try to find common directory or file type
		const dirs = allFiles
			.map((file) => {
				const parts = file.split("/")
				return parts.length > 1 ? parts[0] : undefined
			})
			.filter(Boolean) as string[]

		if (dirs.length > 0) {
			const mostCommonDir = this.getMostCommon(dirs)
			return mostCommonDir
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
		const changeCount = this.getTotalChanges(diffInfo)

		if (changeCount === 1) {
			const file = [
				...diffInfo.added,
				...diffInfo.modified,
				...diffInfo.deleted,
				...diffInfo.renamed.map((r) => r.split(" -> ")[0]),
			][0]

			const fileName = file.split("/").pop() || file

			switch (commitType) {
				case "feat":
					return `add ${fileName}`
				case "fix":
					return `fix issue in ${fileName}`
				case "docs":
					return `update documentation for ${fileName}`
				case "test":
					return `add tests for ${fileName}`
				default:
					return `update ${fileName}`
			}
		} else {
			switch (commitType) {
				case "feat":
					return `add ${changeCount} files`
				case "fix":
					return `fix issues in ${changeCount} files`
				case "docs":
					return `update documentation`
				case "test":
					return `add tests`
				default:
					return `update ${changeCount} files`
			}
		}
	}

	/**
	 * Generate body for commit message
	 */
	private generateBody(diffInfo: GitDiffInfo): string {
		const lines: string[] = []

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
}
