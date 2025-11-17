import { memo } from "react"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"

import { useTaskSearch } from "./useTaskSearch"
import TaskItem from "./TaskItem"

const HistoryPreview = () => {
	const { tasks } = useTaskSearch()
	const { t } = useAppTranslation()
	const { maxTasksHomeScreen } = useExtensionState()

	const handleViewAllHistory = () => {
		vscode.postMessage({ type: "switchTab", tab: "history" })
	}

	// If maxTasksHomeScreen is 0, don't render anything
	if (maxTasksHomeScreen === 0) {
		return null
	}

	return (
		<div className="flex flex-col gap-1 h-full">
			<div className="flex flex-wrap items-center justify-between mt-4 mb-2">
				<h2 className="font-semibold text-lg grow m-0">{t("history:recentTasks")}</h2>
				<button
					onClick={handleViewAllHistory}
					className="text-base text-vscode-descriptionForeground hover:text-vscode-textLink-foreground transition-colors cursor-pointer"
					aria-label={t("history:viewAllHistory")}>
					{t("history:viewAllHistory")}
				</button>
			</div>
			{tasks.length !== 0 && (
				<div className="relative w-full">
					<div className="absolute w-full bg-gradient-to-t from-vscode-sideBar-background to-vscode-sideBar-background/0 z-5 bottom-0 h-6" />
					<div className="overflow-y-auto space-y-1 -mx-6 px-6 pb-6 max-h-[calc(100vh-280px)] relative z-4">
						{tasks.slice(0, Math.max(0, Math.min(20, maxTasksHomeScreen ?? 4))).map((item) => (
							<TaskItem key={item.id} item={item} variant="compact" />
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export default memo(HistoryPreview)
