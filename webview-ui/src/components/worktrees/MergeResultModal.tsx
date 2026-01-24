import type { MergeWorktreeResult } from "@roo-code/types"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Button } from "@/components/ui"
import { Check, TriangleAlert, XCircle } from "lucide-react"

interface MergeResultModalProps {
	open: boolean
	onClose: () => void
	result: MergeWorktreeResult
	onAskRooResolve: () => void
}

export const MergeResultModal = ({ open, onClose, result, onAskRooResolve }: MergeResultModalProps) => {
	const { t } = useAppTranslation()

	// Determine the title and icon based on result state
	const getResultDisplay = () => {
		if (result.success) {
			return {
				title: t("worktrees:mergeSuccess"),
				icon: <Check className="size-6 text-vscode-charts-green" />,
			}
		}
		if (result.hasConflicts) {
			return {
				title: t("worktrees:mergeConflicts"),
				icon: <TriangleAlert className="size-6 text-vscode-charts-yellow" />,
			}
		}
		return {
			title: t("worktrees:mergeFailed"),
			icon: <XCircle className="size-6 text-vscode-errorForeground" />,
		}
	}

	const { title, icon } = getResultDisplay()

	return (
		<Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{icon}
						{title}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-3 overflow-hidden">
					{result.success ? (
						<p className="text-sm text-vscode-descriptionForeground m-0">{result.message}</p>
					) : result.hasConflicts ? (
						<>
							<p className="text-sm text-vscode-descriptionForeground m-0">
								{t("worktrees:conflictsDescription")}
							</p>

							{/* Conflicting files list */}
							<div className="flex flex-col p-3 gap-1 cursor-default rounded-xl bg-vscode-input-background max-h-32 overflow-y-auto">
								{result.conflictingFiles.map((file) => (
									<div key={file} className="text-xs text-vscode-foreground font-mono truncate">
										{file}
									</div>
								))}
							</div>
						</>
					) : (
						<p className="text-sm text-vscode-descriptionForeground m-0">{result.message}</p>
					)}
				</div>

				<DialogFooter>
					{result.success ? (
						<Button onClick={onClose}>{t("worktrees:done")}</Button>
					) : result.hasConflicts ? (
						<>
							<Button variant="secondary" onClick={onClose}>
								{t("worktrees:resolveManually")}
							</Button>
							<Button onClick={onAskRooResolve}>{t("worktrees:askRooResolve")}</Button>
						</>
					) : (
						<Button onClick={onClose}>{t("worktrees:close")}</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
