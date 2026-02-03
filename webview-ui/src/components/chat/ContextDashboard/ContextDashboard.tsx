import React, { useState } from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { ChevronDown, ChevronRight, FileText, Folder, Layers } from "lucide-react"
import { cn } from "@src/lib/utils"

interface ContextDashboardProps {
	className?: string
}

export const ContextDashboard: React.FC<ContextDashboardProps> = ({ className }) => {
	const { t } = useAppTranslation()
	const { filePaths, openedTabs } = useExtensionState()
	const [isExpanded, setIsExpanded] = useState(true)

	// Calculate stats
	const totalFiles = filePaths.length
	const totalOpenedTabs = openedTabs.length

	const handleToggle = () => {
		setIsExpanded(!isExpanded)
	}

	// Don't render if no context
	if (totalFiles === 0 && totalOpenedTabs === 0) {
		return null
	}

	return (
		<div className={cn("border-b border-vscode-editorGroup-border", className)}>
			{/* Header */}
			<button
				onClick={handleToggle}
				className="w-full flex items-center gap-2 px-3 py-2 hover:bg-vscode-list-hoverBackground transition-colors cursor-pointer"
				aria-expanded={isExpanded}
				aria-label={isExpanded ? t("chat:contextDashboard.collapse") : t("chat:contextDashboard.expand")}>
				{isExpanded ? (
					<ChevronDown className="w-4 h-4 text-vscode-descriptionForeground shrink-0" />
				) : (
					<ChevronRight className="w-4 h-4 text-vscode-descriptionForeground shrink-0" />
				)}
				<Layers className="w-4 h-4 text-vscode-foreground shrink-0" />
				<span className="font-medium text-vscode-foreground text-sm flex-grow text-left">
					{t("chat:contextDashboard.title")}
				</span>
				{/* Stats badge */}
				<span className="text-xs text-vscode-descriptionForeground px-2 py-0.5 rounded bg-vscode-editorWidget-background">
					{t("chat:contextDashboard.stats", { files: totalFiles, tabs: totalOpenedTabs })}
				</span>
			</button>

			{/* Content */}
			{isExpanded && (
				<div className="px-3 pb-3 max-h-[200px] overflow-y-auto">
					{/* Opened Tabs Section */}
					{totalOpenedTabs > 0 && (
						<div className="mb-2">
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
			)}
		</div>
	)
}

export default ContextDashboard
