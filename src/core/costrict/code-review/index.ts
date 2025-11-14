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
import { t } from "../../../i18n"
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
			reviewInstance.setProvider(visibleProvider)
			if (!(await reviewInstance.checkApiProviderSupport())) {
				return
			}
			const fileUri = editor.document.uri
			const range = editor.selection
			const cwd = visibleProvider.cwd.toPosix()
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
			reviewInstance.setProvider(visibleProvider)
			if (!(await reviewInstance.checkApiProviderSupport())) {
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
			reviewInstance.startReview(targets)
		},
		reviewRepo: async () => {
			const visibleProvider = await ClineProvider.getInstance()
			if (!visibleProvider) {
				return
			}
			reviewInstance.setProvider(visibleProvider)
			if (!(await reviewInstance.checkApiProviderSupport())) {
				return
			}
			reviewInstance.startReview([
				{
					type: ReviewTargetType.FOLDER,
					file_path: "",
				},
			])
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
		codeReviewJetbrains: async (args: any) => {
			const visibleProvider = await ClineProvider.getInstance()
			if (!visibleProvider) {
				return
			}
			reviewInstance.setProvider(visibleProvider)
			if (!(await reviewInstance.checkApiProviderSupport())) {
				return
			}
			visibleProvider.log(`[CodeReview] start review ${args}`)

			const data = args?.[0]?.[0]
			if (!data) {
				visibleProvider.log("[CodeReview] Invalid args structure")
				return
			}

			const { startLine, endLine, filePath, selectedText } = data
			visibleProvider.log(
				`[CodeReview] extracted data: filePath=${filePath}, startLine=${startLine}, endLine=${endLine}`,
			)

			const cwd = visibleProvider.cwd.toPosix()
			const params = {
				filePath,
				endLine: endLine + "",
				startLine: startLine + "",
				selectedText: selectedText,
			}
			const prompt = supportPrompt.create("ADD_TO_CONTEXT", params)
			reviewInstance.createReviewTask(prompt, [
				{
					type: ReviewTargetType.CODE,
					file_path: toRelativePath(filePath.toPosix(), cwd),
					line_range: [startLine, endLine],
				},
			])
		},
		reviewFilesAndFoldersJetbrains: async (args: any) => {
			const visibleProvider = await ClineProvider.getInstance()
			if (!visibleProvider) {
				return
			}
			reviewInstance.setProvider(visibleProvider)
			if (!(await reviewInstance.checkApiProviderSupport())) {
				return
			}
			visibleProvider.log(`[CodeReview] start review ${JSON.stringify(args)}`)
			const data = args?.[0]?.[0]
			if (!data) {
				visibleProvider.log("[CodeReview] Invalid args structure")
				return
			}
			const cwd = visibleProvider.cwd.toPosix()
			const { filePaths } = data
			const targets: ReviewTarget[] = await Promise.all(
				filePaths.map(async (filePath: string) => {
					return {
						type: ReviewTargetType.FILE,
						file_path: toRelativePath(filePath.toPosix(), cwd),
					}
				}),
			)
			reviewInstance.startReview(targets)
		},
		acceptIssueJetbrains: async (args: any) => {
			const visibleProvider = await ClineProvider.getInstance()
			if (!visibleProvider) {
				return
			}
			reviewInstance.setProvider(visibleProvider)
			visibleProvider.log(`[CodeReview] accept issue ${JSON.stringify(args)}`)
			const data = args?.[0]?.[0]
			if (!data) {
				visibleProvider.log("[CodeReview] Invalid args structure")
				return
			}

			const { id } = data
			reviewInstance.updateIssueStatus(id, IssueStatus.ACCEPT)
		},
		rejectIssueJetbrains: async (args: any) => {
			const visibleProvider = await ClineProvider.getInstance()
			if (!visibleProvider) {
				return
			}
			reviewInstance.setProvider(visibleProvider)
			visibleProvider.log(`[CodeReview] reject issue ${JSON.stringify(args)}`)
			const data = args?.[0]?.[0]
			if (!data) {
				visibleProvider.log("[CodeReview] Invalid args structure")
				return
			}

			const { id } = data
			reviewInstance.updateIssueStatus(id, IssueStatus.REJECT)
		},
		askReviewSuggestionWithAIJetbrains: async (args: any) => {
			const visibleProvider = await ClineProvider.getInstance()
			if (!visibleProvider) {
				return
			}
			visibleProvider.log(`[CodeReview] ask review suggestion with AI ${JSON.stringify(args)}`)
			reviewInstance.setProvider(visibleProvider)
			const data = args?.[0]?.[0]
			if (!data) {
				visibleProvider.log("[CodeReview] Invalid args structure")
				return
			}

			const { id } = data
			if (id) {
				reviewInstance.askWithAI(id)
			}
		},
	}
	for (const [id, callback] of Object.entries(commandMap)) {
		const command = getCommand(id as CostrictCommandId)
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

export { CodeReviewService, ReviewTargetType }
