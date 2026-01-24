import React, { useState, useCallback, useEffect, useMemo } from "react"
import { GitBranch, Check } from "lucide-react"

import type { Worktree, WorktreeListResponse } from "@roo-code/types"

import { cn } from "@/lib/utils"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"

import { IconButton } from "./IconButton"

interface WorktreeSelectorProps {
	disabled?: boolean
}

export const WorktreeSelector = ({ disabled = false }: WorktreeSelectorProps) => {
	const { t } = useAppTranslation()
	const [open, setOpen] = useState(false)
	const [worktrees, setWorktrees] = useState<Worktree[]>([])
	const [isGitRepo, setIsGitRepo] = useState(true)
	const portalContainer = useRooPortal("roo-portal")

	// Find current worktree
	const currentWorktree = useMemo(() => worktrees.find((w) => w.isCurrent), [worktrees])

	// Fetch worktrees when popover opens
	const fetchWorktrees = useCallback(() => {
		vscode.postMessage({ type: "listWorktrees" })
	}, [])

	// Handle messages from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "worktreeList") {
				const response: WorktreeListResponse = message
				setWorktrees(response.worktrees || [])
				setIsGitRepo(response.isGitRepo)
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	// Initial fetch and refresh on open
	useEffect(() => {
		fetchWorktrees()
	}, [fetchWorktrees])

	useEffect(() => {
		if (open) {
			fetchWorktrees()
		}
	}, [open, fetchWorktrees])

	const handleSelect = useCallback((worktreePath: string) => {
		vscode.postMessage({
			type: "switchWorktree",
			worktreePath: worktreePath,
			worktreeNewWindow: false,
		})
		setOpen(false)
	}, [])

	const handleSettingsClick = useCallback(() => {
		vscode.postMessage({
			type: "switchTab",
			tab: "settings",
			values: { section: "worktrees" },
		})
		setOpen(false)
	}, [])

	// Don't render if not a git repo or only one worktree
	if (!isGitRepo || worktrees.length <= 1) {
		return null
	}

	const title = t("worktrees:selector.tooltip")
	const instructionText = t("worktrees:selector.description")

	return (
		<Popover open={open} onOpenChange={setOpen} data-testid="worktree-selector-root">
			<StandardTooltip content={title}>
				<PopoverTrigger
					disabled={disabled}
					data-testid="worktree-selector-trigger"
					className={cn(
						"inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						disabled
							? "opacity-50 cursor-not-allowed"
							: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
					)}>
					<GitBranch className="w-3 h-3 mr-1" />
					<span className="truncate">{currentWorktree?.branch || t("worktrees:noBranch")}</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden min-w-80 max-w-9/10">
				<div className="flex flex-col w-full">
					{/* Info blurb */}
					<div className="p-3 border-b border-vscode-dropdown-border">
						<p className="m-0 text-xs text-vscode-descriptionForeground">{instructionText}</p>
					</div>

					{/* Worktree list */}
					<div className="max-h-[300px] overflow-y-auto py-1">
						{worktrees.map((worktree) => {
							const isSelected = worktree.isCurrent
							return (
								<div
									key={worktree.path}
									onClick={() => !isSelected && handleSelect(worktree.path)}
									data-testid="worktree-selector-item"
									className={cn(
										"px-3 py-1.5 text-sm cursor-pointer flex items-center",
										"hover:bg-vscode-list-hoverBackground",
										isSelected &&
											"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground",
									)}>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<GitBranch className="w-3 h-3 shrink-0" />
											<span className="font-bold truncate">
												{worktree.branch || t("worktrees:noBranch")}
											</span>
											{worktree.isBare && (
												<span className="text-xs opacity-70">{t("worktrees:primary")}</span>
											)}
										</div>
										<div className="text-xs text-vscode-descriptionForeground ml-5 truncate">
											{worktree.path}
										</div>
									</div>
									{isSelected && <Check className="ml-auto size-4 p-0.5" />}
								</div>
							)
						})}
					</div>

					{/* Bottom bar with settings cog and title */}
					<div className="flex flex-row items-center justify-between px-2 py-2 border-t border-vscode-dropdown-border">
						<div className="flex flex-row gap-1">
							<IconButton
								iconClass="codicon-settings-gear"
								title={t("worktrees:selector.settings")}
								onClick={handleSettingsClick}
							/>
						</div>

						{/* Info icon and title on the right */}
						<div className="flex items-center gap-1 pr-1">
							<StandardTooltip content={t("worktrees:selector.info")}>
								<span className="codicon codicon-info text-xs text-vscode-descriptionForeground opacity-70 hover:opacity-100 cursor-help" />
							</StandardTooltip>
							<h4 className="m-0 font-medium text-sm text-vscode-descriptionForeground">
								{t("worktrees:selector.title")}
							</h4>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
