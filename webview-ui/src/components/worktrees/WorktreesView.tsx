import { useState, useEffect, useCallback } from "react"

import type { Worktree, WorktreeListResponse, MergeWorktreeResult, WorktreeIncludeStatus } from "@roo-code/types"

import { Badge, Button, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"

import { Tab, TabContent, TabHeader } from "../common/Tab"

import { CreateWorktreeModal } from "./CreateWorktreeModal"
import { DeleteWorktreeModal } from "./DeleteWorktreeModal"

type WorktreesViewProps = {
	onDone: () => void
}

export const WorktreesView = ({ onDone }: WorktreesViewProps) => {
	const { t } = useAppTranslation()

	// State
	const [worktrees, setWorktrees] = useState<Worktree[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [isGitRepo, setIsGitRepo] = useState(true)
	const [isMultiRoot, setIsMultiRoot] = useState(false)
	const [isSubfolder, setIsSubfolder] = useState(false)
	const [gitRootPath, setGitRootPath] = useState("")

	// Worktree include status
	const [includeStatus, setIncludeStatus] = useState<WorktreeIncludeStatus | null>(null)
	const [isCreatingInclude, setIsCreatingInclude] = useState(false)

	// Modals
	const [showCreateModal, setShowCreateModal] = useState(false)
	const [deleteWorktree, setDeleteWorktree] = useState<Worktree | null>(null)

	// Merge state
	const [mergeWorktree, setMergeWorktree] = useState<Worktree | null>(null)
	const [mergeTargetBranch, setMergeTargetBranch] = useState("")
	const [mergeDeleteAfter, setMergeDeleteAfter] = useState(false)
	const [isMerging, setIsMerging] = useState(false)
	const [mergeResult, setMergeResult] = useState<MergeWorktreeResult | null>(null)

	// Fetch worktrees list
	const fetchWorktrees = useCallback(() => {
		vscode.postMessage({ type: "listWorktrees" })
	}, [])

	// Fetch worktree include status
	const fetchIncludeStatus = useCallback(() => {
		vscode.postMessage({ type: "getWorktreeIncludeStatus" })
	}, [])

	// Handle messages from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			switch (message.type) {
				case "worktreeList": {
					const response: WorktreeListResponse = message
					setWorktrees(response.worktrees || [])
					setIsGitRepo(response.isGitRepo)
					setIsMultiRoot(response.isMultiRoot)
					setIsSubfolder(response.isSubfolder)
					setGitRootPath(response.gitRootPath)
					setError(response.error || null)
					setIsLoading(false)
					break
				}
				case "worktreeIncludeStatus": {
					console.log("[WorktreesView] Received worktreeIncludeStatus:", message)
					setIncludeStatus(message.worktreeIncludeStatus)
					break
				}
				case "worktreeResult": {
					console.log("[WorktreesView] Received worktreeResult:", message)
					// Refresh list and include status after any worktree operation
					fetchWorktrees()
					fetchIncludeStatus()
					setIsCreatingInclude(false)
					break
				}
				case "mergeWorktreeResult": {
					setIsMerging(false)
					// Map ExtensionMessage format (text) to MergeWorktreeResult format (message)
					setMergeResult({
						success: message.success,
						message: message.text || "",
						hasConflicts: message.hasConflicts || false,
						conflictingFiles: message.conflictingFiles || [],
						sourceBranch: message.sourceBranch,
						targetBranch: message.targetBranch,
					})
					if (message.success) {
						fetchWorktrees()
					}
					break
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [fetchWorktrees, fetchIncludeStatus])

	// Initial fetch and polling
	useEffect(() => {
		fetchWorktrees()
		fetchIncludeStatus()

		// Poll every 3 seconds for updates
		const interval = setInterval(fetchWorktrees, 3000)
		return () => clearInterval(interval)
	}, [fetchWorktrees, fetchIncludeStatus])

	// Handle create worktree include file
	const handleCreateWorktreeInclude = useCallback(() => {
		console.log("[WorktreesView] handleCreateWorktreeInclude called, includeStatus:", includeStatus)
		if (!includeStatus?.gitignoreContent) {
			console.log("[WorktreesView] No gitignoreContent, returning early")
			return
		}
		setIsCreatingInclude(true)
		console.log(
			"[WorktreesView] Sending createWorktreeInclude with content length:",
			includeStatus.gitignoreContent.length,
		)
		vscode.postMessage({
			type: "createWorktreeInclude",
			worktreeIncludeContent: includeStatus.gitignoreContent,
		} as const)
		// Refresh status after a short delay
		setTimeout(() => {
			fetchIncludeStatus()
			setIsCreatingInclude(false)
		}, 500)
	}, [includeStatus, fetchIncludeStatus])

	// Handle switch worktree
	const handleSwitchWorktree = useCallback((worktreePath: string, newWindow: boolean) => {
		vscode.postMessage({
			type: "switchWorktree",
			worktreePath: worktreePath,
			worktreeNewWindow: newWindow,
		})
	}, [])

	// Handle merge
	const handleMerge = useCallback(() => {
		if (!mergeWorktree) return
		setIsMerging(true)
		vscode.postMessage({
			type: "mergeWorktree",
			worktreePath: mergeWorktree.path,
			worktreeTargetBranch: mergeTargetBranch,
			worktreeDeleteAfterMerge: mergeDeleteAfter,
		})
	}, [mergeWorktree, mergeTargetBranch, mergeDeleteAfter])

	// Handle "Ask Roo to resolve conflicts"
	const handleAskRooResolve = useCallback(() => {
		if (!mergeResult) return
		// Create a new task with conflict resolution instructions
		const conflictMessage = `Please help me resolve merge conflicts in the following files:\n\n${mergeResult.conflictingFiles.map((f) => `- ${f}`).join("\n")}\n\nThe merge was from branch "${mergeResult.sourceBranch}" into "${mergeResult.targetBranch}".`
		vscode.postMessage({
			type: "newTask",
			text: conflictMessage,
		})
		setMergeWorktree(null)
		setMergeResult(null)
	}, [mergeResult])

	// Render error states
	if (!isGitRepo) {
		return (
			<Tab>
				<TabHeader className="flex justify-between items-center">
					<h3 className="text-vscode-foreground m-0">{t("worktrees:title")}</h3>
					<Button onClick={onDone}>{t("worktrees:done")}</Button>
				</TabHeader>
				<TabContent>
					<div className="flex flex-col items-center justify-center h-48 text-vscode-descriptionForeground">
						<span className="codicon codicon-warning text-4xl mb-4" />
						<p className="text-center">{t("worktrees:notGitRepo")}</p>
					</div>
				</TabContent>
			</Tab>
		)
	}

	if (isMultiRoot) {
		return (
			<Tab>
				<TabHeader className="flex justify-between items-center">
					<h3 className="text-vscode-foreground m-0">{t("worktrees:title")}</h3>
					<Button onClick={onDone}>{t("worktrees:done")}</Button>
				</TabHeader>
				<TabContent>
					<div className="flex flex-col items-center justify-center h-48 text-vscode-descriptionForeground">
						<span className="codicon codicon-warning text-4xl mb-4" />
						<p className="text-center">{t("worktrees:multiRootNotSupported")}</p>
					</div>
				</TabContent>
			</Tab>
		)
	}

	if (isSubfolder) {
		return (
			<Tab>
				<TabHeader className="flex justify-between items-center">
					<h3 className="text-vscode-foreground m-0">{t("worktrees:title")}</h3>
					<Button onClick={onDone}>{t("worktrees:done")}</Button>
				</TabHeader>
				<TabContent>
					<div className="flex flex-col items-center justify-center h-48 text-vscode-descriptionForeground">
						<span className="codicon codicon-warning text-4xl mb-4" />
						<p className="text-center">{t("worktrees:subfolderNotSupported")}</p>
						<p className="text-sm mt-2 text-center">
							{t("worktrees:gitRoot")}:{" "}
							<code className="bg-vscode-input-background px-2 py-1 rounded">{gitRootPath}</code>
						</p>
					</div>
				</TabContent>
			</Tab>
		)
	}

	// Find the primary (bare/main) worktree for merge target.
	const primaryWorktree = worktrees.find((w) => w.isBare || worktrees.indexOf(w) === 0)

	return (
		<Tab>
			<TabHeader className="flex flex-col gap-2">
				<div className="flex justify-between items-center">
					<h3 className="text-vscode-foreground m-0">{t("worktrees:title")}</h3>
					<Button onClick={onDone}>{t("worktrees:done")}</Button>
				</div>
				<p className="text-vscode-descriptionForeground text-sm m-0">{t("worktrees:description")}</p>

				{/* Worktree include status */}
				{includeStatus && (
					<div className="flex items-center gap-2 text-sm">
						{includeStatus.exists ? (
							<>
								<span className="codicon codicon-check text-vscode-charts-green" />
								<span className="text-vscode-descriptionForeground">
									{t("worktrees:includeFileExists")}
								</span>
							</>
						) : (
							<>
								<span className="codicon codicon-warning text-vscode-charts-yellow" />
								<span className="text-vscode-descriptionForeground">
									{t("worktrees:noIncludeFile")}
								</span>
								{includeStatus.hasGitignore && (
									<Button
										variant="secondary"
										size="sm"
										onClick={handleCreateWorktreeInclude}
										disabled={isCreatingInclude}>
										{t("worktrees:createFromGitignore")}
									</Button>
								)}
							</>
						)}
					</div>
				)}
			</TabHeader>

			<TabContent className="px-2 py-0">
				{isLoading ? (
					<div className="flex items-center justify-center h-48">
						<span className="codicon codicon-loading codicon-modifier-spin text-2xl" />
					</div>
				) : error ? (
					<div className="flex flex-col items-center justify-center h-48 text-vscode-errorForeground">
						<span className="codicon codicon-error text-4xl mb-4" />
						<p className="text-center">{error}</p>
					</div>
				) : (
					<div className="flex flex-col gap-1 py-2">
						{worktrees.map((worktree) => (
							<div
								key={worktree.path}
								className={`p-3 rounded-xl border transition-colors ${
									worktree.isCurrent
										? "border-vscode-focusBorder bg-vscode-list-activeSelectionBackground"
										: "border-transparent bg-vscode-editor-background hover:bg-vscode-editor-foreground/10"
								}`}>
								<div className="flex items-start justify-between">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="codicon codicon-git-branch" />
											<span className="font-medium truncate">
												{worktree.branch ||
													(worktree.isDetached
														? t("worktrees:detachedHead")
														: t("worktrees:noBranch"))}
											</span>
											{worktree.isBare && <Badge>{t("worktrees:primary")}</Badge>}
											{worktree.isCurrent && (
												<Badge variant="secondary">{t("worktrees:current")}</Badge>
											)}
											{worktree.isLocked && (
												<StandardTooltip content={worktree.lockReason || t("worktrees:locked")}>
													<span className="codicon codicon-lock text-vscode-charts-yellow" />
												</StandardTooltip>
											)}
										</div>
										<div className="text-xs text-vscode-descriptionForeground mt-1 truncate">
											{worktree.path}
										</div>
									</div>

									<div className="flex items-center gap-1 ml-2 flex-shrink-0">
										{!worktree.isCurrent && (
											<>
												<StandardTooltip content={t("worktrees:openInCurrentWindow")}>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleSwitchWorktree(worktree.path, false)}>
														<span className="codicon codicon-window" />
													</Button>
												</StandardTooltip>
												<StandardTooltip content={t("worktrees:openInNewWindow")}>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleSwitchWorktree(worktree.path, true)}>
														<span className="codicon codicon-empty-window" />
													</Button>
												</StandardTooltip>
											</>
										)}
										{!worktree.isBare &&
											worktree.branch &&
											primaryWorktree &&
											worktree.branch !== primaryWorktree.branch && (
												<StandardTooltip content={t("worktrees:merge")}>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => {
															setMergeWorktree(worktree)
															setMergeTargetBranch(primaryWorktree.branch || "main")
														}}>
														<span className="codicon codicon-git-merge" />
													</Button>
												</StandardTooltip>
											)}
										{!worktree.isBare && !worktree.isCurrent && (
											<StandardTooltip content={t("worktrees:delete")}>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setDeleteWorktree(worktree)}>
													<span className="codicon codicon-trash text-vscode-errorForeground" />
												</Button>
											</StandardTooltip>
										)}
									</div>
								</div>
							</div>
						))}

						{/* New Worktree button */}
						<Button variant="secondary" className="mt-2" onClick={() => setShowCreateModal(true)}>
							<span className="codicon codicon-add mr-2" />
							{t("worktrees:newWorktree")}
						</Button>
					</div>
				)}
			</TabContent>

			{/* Create Modal */}
			{showCreateModal && (
				<CreateWorktreeModal
					open={showCreateModal}
					onClose={() => setShowCreateModal(false)}
					onSuccess={() => {
						setShowCreateModal(false)
						fetchWorktrees()
					}}
				/>
			)}

			{/* Delete Modal */}
			{deleteWorktree && (
				<DeleteWorktreeModal
					open={!!deleteWorktree}
					onClose={() => setDeleteWorktree(null)}
					worktree={deleteWorktree}
					onSuccess={() => {
						setDeleteWorktree(null)
						fetchWorktrees()
					}}
				/>
			)}

			{/* Merge Modal */}
			{mergeWorktree && !mergeResult && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-lg p-4 max-w-md w-full mx-4">
						<h3 className="text-lg font-medium text-vscode-foreground mb-4">
							{t("worktrees:mergeBranch")}
						</h3>
						<p className="text-sm text-vscode-descriptionForeground mb-4">
							{t("worktrees:mergeDescription", {
								source: mergeWorktree.branch,
								target: mergeTargetBranch,
							})}
						</p>

						<div className="mb-4">
							<label className="flex items-center gap-2 text-sm text-vscode-foreground">
								<input
									type="checkbox"
									checked={mergeDeleteAfter}
									onChange={(e) => setMergeDeleteAfter(e.target.checked)}
								/>
								{t("worktrees:deleteAfterMerge")}
							</label>
						</div>

						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setMergeWorktree(null)}>
								{t("worktrees:cancel")}
							</Button>
							<Button onClick={handleMerge} disabled={isMerging}>
								{isMerging ? (
									<>
										<span className="codicon codicon-loading codicon-modifier-spin mr-2" />
										{t("worktrees:merging")}
									</>
								) : (
									t("worktrees:merge")
								)}
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Merge Result Modal */}
			{mergeResult && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-lg p-4 max-w-md w-full mx-4">
						{mergeResult.success ? (
							<>
								<div className="flex items-center gap-2 mb-4">
									<span className="codicon codicon-check text-vscode-charts-green text-2xl" />
									<h3 className="text-lg font-medium text-vscode-foreground">
										{t("worktrees:mergeSuccess")}
									</h3>
								</div>
								<p className="text-sm text-vscode-descriptionForeground mb-4">{mergeResult.message}</p>
								<div className="flex justify-end">
									<Button
										onClick={() => {
											setMergeWorktree(null)
											setMergeResult(null)
										}}>
										{t("worktrees:done")}
									</Button>
								</div>
							</>
						) : mergeResult.hasConflicts ? (
							<>
								<div className="flex items-center gap-2 mb-4">
									<span className="codicon codicon-warning text-vscode-charts-yellow text-2xl" />
									<h3 className="text-lg font-medium text-vscode-foreground">
										{t("worktrees:mergeConflicts")}
									</h3>
								</div>
								<p className="text-sm text-vscode-descriptionForeground mb-2">
									{t("worktrees:conflictsDescription")}
								</p>
								<div className="bg-vscode-input-background rounded p-2 mb-4 max-h-32 overflow-y-auto">
									{mergeResult.conflictingFiles.map((file) => (
										<div key={file} className="text-xs text-vscode-foreground font-mono">
											{file}
										</div>
									))}
								</div>
								<div className="flex justify-end gap-2">
									<Button
										variant="secondary"
										onClick={() => {
											setMergeWorktree(null)
											setMergeResult(null)
										}}>
										{t("worktrees:resolveManually")}
									</Button>
									<Button onClick={handleAskRooResolve}>{t("worktrees:askRooResolve")}</Button>
								</div>
							</>
						) : (
							<>
								<div className="flex items-center gap-2 mb-4">
									<span className="codicon codicon-error text-vscode-errorForeground text-2xl" />
									<h3 className="text-lg font-medium text-vscode-foreground">
										{t("worktrees:mergeFailed")}
									</h3>
								</div>
								<p className="text-sm text-vscode-descriptionForeground mb-4">{mergeResult.message}</p>
								<div className="flex justify-end">
									<Button
										onClick={() => {
											setMergeWorktree(null)
											setMergeResult(null)
										}}>
										{t("worktrees:close")}
									</Button>
								</div>
							</>
						)}
					</div>
				</div>
			)}
		</Tab>
	)
}
