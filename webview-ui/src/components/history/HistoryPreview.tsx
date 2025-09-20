import { memo } from "react"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import { useTaskSearch } from "./useTaskSearch"
import TaskItem from "./TaskItem"

const HistoryPreview = () => {
	const { tasks, recentTasks } = useTaskSearch()
	const { t } = useAppTranslation()

	const handleViewAllHistory = () => {
		vscode.postMessage({ type: "switchTab", tab: "history" })
	}

	const previewSource = tasks.length > 0 ? tasks : recentTasks
	const previewTasks = previewSource.slice(0, 3)
	const hasAnyTasks = recentTasks.length > 0

	return (
		<div className="flex flex-col gap-3">
			{hasAnyTasks && (
				<>
					{previewTasks.map((item) => (
						<TaskItem key={item.id} item={item} variant="compact" />
					))}
					<button
						onClick={handleViewAllHistory}
						className="text-base text-vscode-descriptionForeground hover:text-vscode-textLink-foreground transition-colors cursor-pointer text-center w-full"
						aria-label={t("history:viewAllHistory")}>
						{t("history:viewAllHistory")}
					</button>
				</>
			)}
		</div>
	)
}

export default memo(HistoryPreview)
