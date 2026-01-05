import { useState, useEffect, useCallback } from "react"

import type { WorktreeDefaultsResponse, BranchInfo, WorktreeIncludeStatus } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Button,
	Input,
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui"

interface CreateWorktreeModalProps {
	open: boolean
	onClose: () => void
	openAfterCreate?: boolean
	onSuccess?: () => void
}

export const CreateWorktreeModal = ({
	open,
	onClose,
	openAfterCreate = false,
	onSuccess,
}: CreateWorktreeModalProps) => {
	const { t } = useAppTranslation()

	// Form state
	const [branchName, setBranchName] = useState("")
	const [worktreePath, setWorktreePath] = useState("")
	const [baseBranch, setBaseBranch] = useState("")

	// Data state
	const [defaults, setDefaults] = useState<WorktreeDefaultsResponse | null>(null)
	const [branches, setBranches] = useState<BranchInfo | null>(null)
	const [includeStatus, setIncludeStatus] = useState<WorktreeIncludeStatus | null>(null)

	// UI state
	const [isCreating, setIsCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Fetch defaults and branches on open
	useEffect(() => {
		if (open) {
			vscode.postMessage({ type: "getWorktreeDefaults" })
			vscode.postMessage({ type: "getAvailableBranches" })
			vscode.postMessage({ type: "getWorktreeIncludeStatus" })
		}
	}, [open])

	// Handle messages from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			switch (message.type) {
				case "worktreeDefaults": {
					const data = message as WorktreeDefaultsResponse
					setDefaults(data)
					setBranchName(data.suggestedBranch)
					setWorktreePath(data.suggestedPath)
					break
				}
				case "branchList": {
					const data = message as BranchInfo
					setBranches(data)
					setBaseBranch(data.currentBranch || "main")
					break
				}
				case "worktreeIncludeStatus": {
					setIncludeStatus(message as WorktreeIncludeStatus)
					break
				}
				case "worktreeResult": {
					setIsCreating(false)
					if (message.success) {
						if (openAfterCreate) {
							vscode.postMessage({
								type: "switchWorktree",
								worktreePath: worktreePath,
								worktreeNewWindow: true,
							})
						}
						onSuccess?.()
						onClose()
					} else {
						setError(message.text || "Unknown error")
					}
					break
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [openAfterCreate, worktreePath, onSuccess, onClose])

	const handleCreate = useCallback(() => {
		setError(null)
		setIsCreating(true)

		vscode.postMessage({
			type: "createWorktree",
			worktreePath: worktreePath,
			worktreeBranch: branchName,
			worktreeBaseBranch: baseBranch,
			worktreeCreateNewBranch: true,
		})
	}, [worktreePath, branchName, baseBranch])

	const isValid = branchName.trim() && worktreePath.trim() && baseBranch.trim()

	return (
		<Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("worktrees:createWorktree")}</DialogTitle>
					<DialogDescription>{t("worktrees:createWorktreeDescription")}</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3">
					{/* No .worktreeinclude warning */}
					{includeStatus && !(includeStatus as any).worktreeIncludeExists && (
						<div className="flex items-center gap-2 px-2 py-1.5 rounded bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder text-sm">
							<span className="codicon codicon-warning text-vscode-charts-yellow flex-shrink-0" />
							<span className="text-vscode-foreground">
								<span className="font-medium">{t("worktrees:noIncludeFileWarning")}</span>
								{" — "}
								<span className="text-vscode-descriptionForeground">
									{t("worktrees:noIncludeFileHint")}
								</span>
							</span>
						</div>
					)}

					{/* Branch name */}
					<div className="flex flex-col gap-1">
						<label className="text-sm text-vscode-foreground">{t("worktrees:branchName")}</label>
						<Input
							value={branchName}
							onChange={(e) => setBranchName(e.target.value)}
							placeholder={defaults?.suggestedBranch || "worktree/feature-name"}
						/>
					</div>

					{/* Base branch selector */}
					{branches && (
						<div className="flex flex-col gap-1">
							<label className="text-sm text-vscode-foreground">{t("worktrees:baseBranch")}</label>
							<Select value={baseBranch} onValueChange={setBaseBranch}>
								<SelectTrigger className="w-full rounded-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectLabel>{t("worktrees:localBranches")}</SelectLabel>
										{branches.localBranches.map((branch) => (
											<SelectItem key={branch} value={branch}>
												{branch}
											</SelectItem>
										))}
									</SelectGroup>
									{branches.remoteBranches.length > 0 && (
										<SelectGroup>
											<SelectLabel>{t("worktrees:remoteBranches")}</SelectLabel>
											{branches.remoteBranches.map((branch) => (
												<SelectItem key={branch} value={branch}>
													{branch}
												</SelectItem>
											))}
										</SelectGroup>
									)}
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Worktree path */}
					<div className="flex flex-col gap-1">
						<label className="text-sm text-vscode-foreground">{t("worktrees:worktreePath")}</label>
						<Input
							value={worktreePath}
							onChange={(e) => setWorktreePath(e.target.value)}
							placeholder={defaults?.suggestedPath || "/path/to/worktree"}
						/>
						<p className="text-xs text-vscode-descriptionForeground">{t("worktrees:pathHint")}</p>
					</div>

					{/* Error message */}
					{error && (
						<div className="flex items-center gap-2 px-2 py-1.5 rounded bg-vscode-inputValidation-errorBackground border border-vscode-inputValidation-errorBorder text-sm">
							<span className="codicon codicon-error text-vscode-errorForeground flex-shrink-0" />
							<p className="text-vscode-errorForeground">{error}</p>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="secondary" onClick={onClose}>
						{t("worktrees:cancel")}
					</Button>
					<Button onClick={handleCreate} disabled={!isValid || isCreating}>
						{isCreating ? (
							<>
								<span className="codicon codicon-loading codicon-modifier-spin mr-2" />
								{t("worktrees:creating")}
							</>
						) : (
							t("worktrees:create")
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
