import { useState, useEffect, useCallback } from "react"

import type { Worktree } from "@roo-code/types"

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
	Checkbox,
} from "@/components/ui"

interface DeleteWorktreeModalProps {
	open: boolean
	onClose: () => void
	worktree: Worktree
	onSuccess?: () => void
}

export const DeleteWorktreeModal = ({ open, onClose, worktree, onSuccess }: DeleteWorktreeModalProps) => {
	const { t } = useAppTranslation()

	const [isDeleting, setIsDeleting] = useState(false)
	const [forceDelete, setForceDelete] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			if (message.type === "worktreeResult") {
				setIsDeleting(false)
				if (message.success) {
					onSuccess?.()
					onClose()
				} else {
					setError(message.text || "Unknown error")
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [onSuccess, onClose])

	const handleDelete = useCallback(() => {
		setError(null)
		setIsDeleting(true)

		vscode.postMessage({
			type: "deleteWorktree",
			worktreePath: worktree.path,
			worktreeForce: forceDelete,
		})
	}, [worktree.path, forceDelete])

	return (
		<Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
			<DialogContent>
				<DialogHeader>
					<div className="flex items-center gap-2">
						<span className="codicon codicon-warning text-vscode-charts-yellow text-xl" />
						<DialogTitle>{t("worktrees:deleteWorktree")}</DialogTitle>
					</div>
					<DialogDescription>{t("worktrees:deleteWorktreeDescription")}</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 overflow-hidden">
					{/* Worktree info */}
					<div className="px-2 py-1.5 rounded bg-vscode-input-background border border-vscode-input-border">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-git-branch flex-shrink-0" />
							<span className="font-medium text-vscode-foreground truncate">
								{worktree.branch ||
									(worktree.isDetached ? t("worktrees:detachedHead") : t("worktrees:noBranch"))}
							</span>
						</div>
						<div className="text-xs text-vscode-descriptionForeground mt-0.5 truncate">{worktree.path}</div>
					</div>

					{/* Warning message */}
					<div className="flex items-start gap-2 p-2 rounded bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder text-sm">
						<span className="codicon codicon-warning text-vscode-charts-yellow flex-shrink-0 mt-0.5" />
						<div className="min-w-0">
							<p className="text-vscode-foreground m-0">{t("worktrees:deleteWarning")}</p>
							<ul className="mt-1 mb-0 pl-0 list-none space-y-0.5 text-vscode-descriptionForeground">
								<li>• {t("worktrees:deleteWarningBranch", { branch: worktree.branch || "HEAD" })}</li>
								<li>• {t("worktrees:deleteWarningFiles")}</li>
							</ul>
						</div>
					</div>

					{/* Force delete option (if worktree is locked) */}
					{worktree.isLocked && (
						<div className="flex items-center gap-2">
							<Checkbox
								id="force-delete"
								checked={forceDelete}
								onCheckedChange={(checked) => setForceDelete(checked === true)}
							/>
							<label htmlFor="force-delete" className="text-sm text-vscode-foreground cursor-pointer">
								{t("worktrees:forceDelete")}
								<span className="text-vscode-descriptionForeground ml-1">
									({t("worktrees:worktreeIsLocked")})
								</span>
							</label>
						</div>
					)}

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
					<Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
						{isDeleting ? (
							<>
								<span className="codicon codicon-loading codicon-modifier-spin mr-2" />
								{t("worktrees:deleting")}
							</>
						) : (
							t("worktrees:delete")
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
