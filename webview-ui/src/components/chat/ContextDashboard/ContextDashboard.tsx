import React, { useState } from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { Layers, FileText, Folder } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@src/components/ui/popover"
import { cn } from "@src/lib/utils"

interface ContextDashboardButtonProps {
	className?: string
}

export const ContextDashboardButton: React.FC<ContextDashboardButtonProps> = ({ className }) => {
	const { t } = useAppTranslation()
	const { filePaths, openedTabs } = useExtensionState()
	const [isOpen, setIsOpen] = useState(false)

	// Calculate stats
	const totalFiles = filePaths.length
	const totalOpenedTabs = openedTabs.length

	// Don't render if no context
	if (totalFiles === 0 && totalOpenedTabs === 0) {
		return null
	}

	const hasContext = totalFiles > 0 || totalOpenedTabs > 0

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<button
					className={cn(
						"inline-flex items-center justify-center",
						"bg-transparent border-none p-1.5",
						"rounded-md min-w-[28px] min-h-[28px]",
						"text-vscode-foreground opacity-85",
						"transition-all duration-150",
						"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
						"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
						"active:bg-[rgba(255,255,255,0.1)]",
						"cursor-pointer relative",
						className,
					)}
					aria-label={t("chat:contextDashboard.tooltip")}
					title={hasContext ? t("chat:contextDashboard.tooltip") : undefined}>
					<Layers className="w-4 h-4" />
					{hasContext && (
						<span className="absolute top-0 right-0 w-2 h-2 bg-vscode-activityBar-activeBorder rounded-full" />
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 bg-vscode-editor-background border border-vscode-editorGroup-border shadow-lg p-3 max-h-[300px] overflow-y-auto"
				onEscapeKeyDown={() => setIsOpen(false)}
				onPointerDownOutside={() => setIsOpen(false)}>
				{/* Header */}
				<div className="flex items-center gap-2 pb-2 border-b border-vscode-editorGroup-border mb-2">
					<Layers className="w-4 h-4 text-vscode-foreground shrink-0" />
					<span className="font-medium text-vscode-foreground text-sm flex-grow text-left">
						{t("chat:contextDashboard.title")}
					</span>
					{/* Stats badge */}
					<span className="text-xs text-vscode-descriptionForeground px-2 py-0.5 rounded bg-vscode-editorWidget-background">
						{t("chat:contextDashboard.stats", { files: totalFiles, tabs: totalOpenedTabs })}
					</span>
				</div>

				{/* Content */}
				<div className="space-y-3">
					{/* Opened Tabs Section */}
					{totalOpenedTabs > 0 && (
						<div>
							<div className="flex items-center gap-1.5 mb-1">
								<FileText className="w-3.5 h-3.5 text-vscode-descriptionForeground shrink-0" />
								<span className="text-xs font-medium text-vscode-descriptionForeground uppercase tracking-wide">
									{t("chat:contextDashboard.openedTabs")}
								</span>
								<span className="text-xs text-vscode-descriptionForeground opacity-70">
									({totalOpenedTabs})
								</span>
							</div>
							<div className="flex flex-col gap-0.5 ml-4">
								{openedTabs.slice(0, 10).map((tab, index) => (
									<div
										key={tab.path || index}
										className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-vscode-list-hoverBackground cursor-pointer text-xs truncate">
										<span
											className={cn(
												"w-1.5 h-1.5 rounded-full shrink-0",
												tab.isActive
													? "bg-vscode-activityBar-activeBorder"
													: "bg-vscode-descriptionForeground opacity-50",
											)}
										/>
										<span className="text-vscode-foreground truncate">{tab.label}</span>
									</div>
								))}
								{totalOpenedTabs > 10 && (
									<span className="text-xs text-vscode-descriptionForeground opacity-60 italic">
										{t("chat:contextDashboard.more", { count: totalOpenedTabs - 10 })}
									</span>
								)}
							</div>
						</div>
					)}

					{/* Workspace Files Section */}
					{totalFiles > 0 && (
						<div>
							<div className="flex items-center gap-1.5 mb-1">
								<Folder className="w-3.5 h-3.5 text-vscode-descriptionForeground shrink-0" />
								<span className="text-xs font-medium text-vscode-descriptionForeground uppercase tracking-wide">
									{t("chat:contextDashboard.workspaceFiles")}
								</span>
								<span className="text-xs text-vscode-descriptionForeground opacity-70">
									({totalFiles})
								</span>
							</div>
							<div className="flex flex-col gap-0.5 ml-4">
								{filePaths.slice(0, 15).map((filePath, index) => {
									// Extract just the filename for display
									const fileName = filePath.split("/").pop() || filePath
									return (
										<div
											key={filePath || index}
											className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-vscode-list-hoverBackground cursor-pointer text-xs truncate">
											<FileText className="w-3 h-3 text-vscode-descriptionForeground opacity-60 shrink-0" />
											<span className="text-vscode-foreground truncate">{fileName}</span>
										</div>
									)
								})}
								{totalFiles > 15 && (
									<span className="text-xs text-vscode-descriptionForeground opacity-60 italic">
										{t("chat:contextDashboard.moreFiles", { count: totalFiles - 15 })}
									</span>
								)}
							</div>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default ContextDashboardButton
