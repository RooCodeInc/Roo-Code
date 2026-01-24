import type { Worktree } from "@roo-code/types"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Button, Checkbox } from "@/components/ui"
import { ArrowBigRightDash, GitBranch } from "lucide-react"

interface MergeWorktreeModalProps {
	open: boolean
	onClose: () => void
	worktree: Worktree
	targetBranch: string
	deleteAfterMerge: boolean
	onDeleteAfterMergeChange: (checked: boolean) => void
	isMerging: boolean
	onMerge: () => void
}

export const MergeWorktreeModal = ({
	open,
	onClose,
	worktree,
	targetBranch,
	deleteAfterMerge,
	onDeleteAfterMergeChange,
	isMerging,
	onMerge,
}: MergeWorktreeModalProps) => {
	const { t } = useAppTranslation()

	return (
		<Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("worktrees:mergeBranch")}</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-3 overflow-hidden">
					{/* Merge info */}
					<div className="flex gap-2 cursor-defaulttext-vscode-foreground justify-center flex-col min-[400px]:flex-row">
						<div className="flex items-center gap-2 px-6 py-3 rounded-full bg-vscode-input-background justify-center">
							<GitBranch className="size-4 shrink-0" />
							<span className="font-medium truncate">{worktree.branch}</span>
						</div>

						<div className="flex items-center justify-center">
							<ArrowBigRightDash
								className="size-8 text-vscode-descriptionForeground rotate-90 min-[400px]:rotate-0"
								strokeWidth={1}
							/>
						</div>

						<div className="flex items-center gap-2 px-6 py-3 rounded-full bg-vscode-input-background justify-center">
							<GitBranch className="size-4 shrink-0" />
							<span className="font-medium truncate">{targetBranch}</span>
						</div>
					</div>

					{/* Delete after merge option */}
					<div className="flex items-center gap-2">
						<Checkbox
							id="delete-after-merge"
							checked={deleteAfterMerge}
							onCheckedChange={(checked) => onDeleteAfterMergeChange(checked === true)}
						/>
						<label htmlFor="delete-after-merge" className="text-sm text-vscode-foreground cursor-pointer">
							{t("worktrees:deleteAfterMerge")}
						</label>
					</div>
				</div>

				<DialogFooter>
					<Button variant="secondary" onClick={onClose}>
						{t("worktrees:cancel")}
					</Button>
					<Button onClick={onMerge} disabled={isMerging}>
						{isMerging ? (
							<>
								<span className="codicon codicon-loading codicon-modifier-spin mr-2" />
								{t("worktrees:merging")}
							</>
						) : (
							t("worktrees:merge")
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
