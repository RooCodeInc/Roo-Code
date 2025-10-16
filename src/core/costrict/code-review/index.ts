import * as vscode from "vscode"

import { ClineProvider } from "../../webview/ClineProvider"
import { getCommand } from "../../../utils/commands"
import { toRelativePath } from "../../../utils/path"
import { CostrictCommandId, RooCodeEventName } from "@roo-code/types"
import { IssueStatus, ReviewTarget, ReviewTargetType, TaskStatus } from "../../../shared/codeReview"
import { getVisibleProviderOrLog } from "../../../activate/registerCommands"

import { CodeReviewService } from "./codeReviewService"
import { CommentService } from "../../../integrations/comment"
import type { ReviewComment } from "./reviewComment"
import { supportPrompt } from "../../../shared/support-prompt"
export function initCodeReview(
	context: vscode.ExtensionContext,
	provider: ClineProvider,
	outputChannel: vscode.OutputChannel,
) {
	const reviewInstance = CodeReviewService.getInstance()
	const commentService = CommentService.getInstance()
	reviewInstance.setProvider(provider)
	reviewInstance.setCommentService(commentService)
	const commandMap: Partial<Record<CostrictCommandId, any>> = {
		codeReviewButtonClicked: async () => {
			let visibleProvider = getVisibleProviderOrLog(outputChannel)

			if (!visibleProvider) {
				visibleProvider = await ClineProvider.getInstance()
			}

			visibleProvider?.postMessageToWebview({ type: "action", action: "codeReviewButtonClicked" })
		},
		codeReview: async () => {
			const visibleProvider = await ClineProvider.getInstance()
			const editor = vscode.window.activeTextEditor
			if (!visibleProvider || !editor) {
				return
			}
			const fileUri = editor.document.uri
			const range = editor.selection
			const cwd = visibleProvider.cwd.toPosix()
			reviewInstance.setProvider(visibleProvider)
			const filePath = toRelativePath(fileUri.fsPath.toPosix(), cwd)
			const params = {
				filePath,
				endLine: range.end.line + 1 + "",
				startLine: range.start.line + 1 + "",
				selectedText: editor.document.getText(range),
			}
			const prompt = supportPrompt.create("ADD_TO_CONTEXT", params)
			reviewInstance.createReviewTask(prompt, [
				{
					type: ReviewTargetType.CODE,
					file_path: filePath,
					line_range: [range.start.line, range.end.line],
				},
			])
		},
		reviewFilesAndFolders: async (_: vscode.Uri, selectedUris: vscode.Uri[]) => {
			const visibleProvider = await ClineProvider.getInstance()
			if (!visibleProvider) {
				return
			}
			const cwd = visibleProvider.cwd.toPosix()
			const targets: ReviewTarget[] = await Promise.all(
				selectedUris.map(async (uri) => {
					const stat = await vscode.workspace.fs.stat(uri)
					return {
						type: stat.type === vscode.FileType.Directory ? ReviewTargetType.FOLDER : ReviewTargetType.FILE,
						file_path: toRelativePath(uri.fsPath.toPosix(), cwd),
					}
				}),
			)
			reviewInstance.setProvider(visibleProvider)
			reviewInstance.startReview(targets)
		},
		reviewRepo: async () => {
			const visibleProvider = await ClineProvider.getInstance()
			if (!visibleProvider) {
				return
			}
			reviewInstance.setProvider(visibleProvider)
			reviewInstance.startReview(
				[
					{
						type: ReviewTargetType.FOLDER,
						file_path: "",
					},
				],
				true,
			)
		},
		acceptIssue: async (thread: vscode.CommentThread) => {
			const visibleProvider = await ClineProvider.getInstance()
			if (!visibleProvider) {
				return
			}
			reviewInstance.setProvider(visibleProvider)
			const comments = thread.comments as ReviewComment[]
			comments.forEach(async (comment) => {
				reviewInstance.updateIssueStatus(comment.id, IssueStatus.ACCEPT)
			})
		},
		rejectIssue: async (thread: vscode.CommentThread) => {
			const visibleProvider = await ClineProvider.getInstance()
			if (!visibleProvider) {
				return
			}
			reviewInstance.setProvider(visibleProvider)
			const comments = thread.comments as ReviewComment[]
			comments.forEach(async (comment) => {
				reviewInstance.updateIssueStatus(comment.id, IssueStatus.REJECT)
			})
		},
		askReviewSuggestionWithAI: async (thread: vscode.CommentThread) => {
			const visibleProvider = await ClineProvider.getInstance()
			if (!visibleProvider) {
				return
			}
			reviewInstance.setProvider(visibleProvider)
			const comment = thread.comments[0] as ReviewComment
			if (comment) {
				reviewInstance.askWithAI(comment.id)
			}
		},
	}
	for (const [id, callback] of Object.entries(commandMap)) {
		const command = getCommand(id as CostrictCommandId)
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

export { CodeReviewService, ReviewTargetType }
