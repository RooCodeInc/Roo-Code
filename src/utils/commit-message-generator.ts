import * as vscode from "vscode"
import { exec } from "child_process"
import { promisify } from "util"

import type { ProviderSettings } from "@roo-code/types"

import { singleCompletionHandler } from "./single-completion-handler"

const execAsync = promisify(exec)

const MAX_DIFF_LENGTH = 10000

const COMMIT_MESSAGE_PROMPT = `You are a commit message generator. Given the following git diff, generate a concise and descriptive commit message following the Conventional Commits format.

Rules:
- Use one of these types: feat, fix, refactor, docs, style, test, chore, perf, ci, build
- The first line should be the type, optional scope in parentheses, and a short description (max 72 chars)
- If the changes are complex, add a blank line followed by a more detailed description
- Focus on WHAT changed and WHY, not HOW
- Do NOT include any markdown formatting, code blocks, or extra explanation
- Output ONLY the commit message text

Git diff:
`

/**
 * Gets the staged diff from the git repository. Falls back to unstaged diff
 * if nothing is staged.
 */
export async function getGitDiff(workspaceRoot: string): Promise<string> {
	try {
		// Try staged changes first
		const { stdout: stagedDiff } = await execAsync("git diff --cached", {
			cwd: workspaceRoot,
			maxBuffer: 1024 * 1024,
		})

		if (stagedDiff.trim()) {
			return stagedDiff
		}

		// Fall back to unstaged changes
		const { stdout: unstagedDiff } = await execAsync("git diff", {
			cwd: workspaceRoot,
			maxBuffer: 1024 * 1024,
		})

		return unstagedDiff
	} catch (error) {
		throw new Error(`Failed to get git diff: ${error instanceof Error ? error.message : String(error)}`)
	}
}

/**
 * Generates a commit message from the given diff using the AI provider.
 */
export async function generateCommitMessageFromDiff(apiConfiguration: ProviderSettings, diff: string): Promise<string> {
	// Truncate very large diffs to avoid token limits
	const truncatedDiff = diff.length > MAX_DIFF_LENGTH ? diff.substring(0, MAX_DIFF_LENGTH) + "\n...(truncated)" : diff

	const prompt = COMMIT_MESSAGE_PROMPT + truncatedDiff

	const result = await singleCompletionHandler(apiConfiguration, prompt)

	// Clean up the result - remove any markdown formatting the model might add
	return result
		.replace(/^```[\s\S]*?\n/, "")
		.replace(/\n```$/, "")
		.trim()
}

/**
 * Gets the workspace root for git operations.
 */
export function getWorkspaceRoot(): string | undefined {
	const workspaceFolders = vscode.workspace.workspaceFolders
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return undefined
	}
	return workspaceFolders[0].uri.fsPath
}

/**
 * Sets the SCM input box value with the generated commit message.
 */
export async function setScmInputBoxMessage(message: string): Promise<boolean> {
	const gitExtension = vscode.extensions.getExtension("vscode.git")

	if (!gitExtension) {
		vscode.window.showErrorMessage("Git extension is not available.")
		return false
	}

	const git = gitExtension.isActive ? gitExtension.exports : await gitExtension.activate()
	const api = git.getAPI(1)

	if (!api || api.repositories.length === 0) {
		vscode.window.showErrorMessage("No git repository found.")
		return false
	}

	// Use the first repository (or the one matching the workspace)
	const repo = api.repositories[0]
	repo.inputBox.value = message
	return true
}
