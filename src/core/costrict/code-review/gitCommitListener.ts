import * as vscode from "vscode"
import { API as GitAPI, Repository, GitExtension } from "./git"
import type { CodeReviewService } from "./codeReviewService"
import { t } from "../../../i18n"

export class GitCommitListener {
	private lastSeenCommitHash: string | undefined
	private disposables: vscode.Disposable[] = []
	private context: vscode.ExtensionContext
	private reviewService: CodeReviewService

	constructor(context: vscode.ExtensionContext, reviewService: CodeReviewService) {
		this.context = context
		this.reviewService = reviewService
		this.lastSeenCommitHash = context.globalState.get<string>("lastSeenCommitHash")
	}

	getDisposables(): vscode.Disposable[] {
		return this.disposables
	}

	async startListening(): Promise<void> {
		const gitAPI = await this.getGitAPI()
		if (!gitAPI) {
			console.warn("Git extension not available")
			return
		}

		// Setup listeners for existing repositories
		gitAPI.repositories.forEach((repo) => {
			this.setupRepositoryListener(repo)
		})

		// Setup listener for new repositories
		const newRepoDisposable = gitAPI.onDidOpenRepository((repo) => {
			this.setupRepositoryListener(repo)
		})
		this.disposables.push(newRepoDisposable)
	}

	private async getGitAPI(): Promise<GitAPI | undefined> {
		const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git")
		if (!gitExtension) {
			return undefined
		}

		const git = gitExtension.exports
		if (!git.enabled) {
			return undefined
		}

		return git.getAPI(1)
	}

	private setupRepositoryListener(repo: Repository): void {
		const disposable = repo.onDidCommit(() => {
			this.handleNewCommit(repo)
		})
		this.disposables.push(disposable)
	}

	private async handleNewCommit(repo: Repository): Promise<void> {
		try {
			const commit = await repo.getCommit("HEAD")
			await this.processNewCommit(commit)
		} catch (error) {
			console.error("Failed to handle new commit:", error)
		}
	}

	private async processNewCommit(commit: any): Promise<void> {
		if (commit.hash === this.lastSeenCommitHash) {
			return
		}

		this.lastSeenCommitHash = commit.hash
		await this.context.globalState.update("lastSeenCommitHash", commit.hash)

		const message = t("common:review.tip.new_commit_notification", { commitMessage: commit.message })
		const confirmText = "Review"
		const result = await vscode.window.showInformationMessage(message, confirmText)
		if (result === confirmText) {
			const prompt = `@${commit.hash}`
			if (!(await this.reviewService.checkApiProviderSupport())) {
				return
			}
			this.reviewService.createReviewTask(prompt, [])
		}
	}
}
