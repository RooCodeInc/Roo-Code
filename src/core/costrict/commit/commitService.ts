import * as vscode from "vscode"
import { CommitMessageGenerator } from "./commitGenerator"
import type { CommitMessageSuggestion } from "./types"
import type { ClineProvider } from "../../webview/ClineProvider"
import { t } from "../../../i18n"

/**
 * Service for handling commit-related operations in VSCode SCM
 */
export class CommitService {
	private generator: CommitMessageGenerator | null = null
	private provider: ClineProvider | undefined

	/**
	 * Initialize the commit service with workspace root and provider
	 */
	initialize(workspaceRoot: string, provider?: ClineProvider): void {
		this.generator = new CommitMessageGenerator(workspaceRoot, provider)
		this.provider = provider
	}

	/**
	 * Check if the service is properly initialized
	 */
	isInitialized(): boolean {
		return this.generator !== null
	}

	/**
	 * Generate commit message and populate it in SCM input
	 */
	async generateAndPopulateCommitMessage(): Promise<void> {
		if (!this.generator) {
			throw new Error(t("commit:commit.error.notInitialized"))
		}

		try {
			// Show progress indicator
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: t("commit:commit.progress.generating"),
					cancellable: false,
				},
				async (progress) => {
					progress.report({ increment: 20 })

					// Generate commit message
					const suggestion = await this.generator!.generateCommitMessage({
						useConventionalCommits: true,
						includeFileChanges: true,
					})

					progress.report({ increment: 50 })

					// Populate the commit message in SCM input
					await this.populateCommitMessage(suggestion)

					progress.report({ increment: 100 })
				},
			)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(t("commit:commit.message.generationFailed", { error: errorMessage }))
		}
	}

	/**
	 * Populate the generated commit message in SCM input
	 */
	private async populateCommitMessage(suggestion: CommitMessageSuggestion): Promise<void> {
		// Build the full commit message
		let commitMessage = suggestion.subject

		if (suggestion.body) {
			commitMessage += `\n\n${suggestion.body}`
		}
		try {
			const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports
			const api = gitExtension.getAPI(1)
			const repo = api.repositories[0]
			repo.inputBox.value = commitMessage
		} catch (error) {
			await vscode.env.clipboard.writeText(commitMessage)
			vscode.window.showInformationMessage(t("commit:commit.message.copiedToClipboard"))
		}
	}

	/**
	 * Get the current workspace root
	 */
	static getWorkspaceRoot(): string | null {
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return null
		}

		// Use the first workspace folder
		return workspaceFolders[0].uri.fsPath
	}

	/**
	 * Check if the current workspace is a git repository
	 */
	static async isGitRepository(workspaceRoot: string): Promise<boolean> {
		try {
			const { exec } = require("child_process")
			const { promisify } = require("util")
			const execAsync = promisify(exec)

			await execAsync("git rev-parse --git-dir", { cwd: workspaceRoot })
			return true
		} catch {
			return false
		}
	}
}
