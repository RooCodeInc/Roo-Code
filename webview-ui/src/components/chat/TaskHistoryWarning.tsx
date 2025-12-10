import React, { useState, useEffect, useMemo } from "react"
import { AlertTriangle, X, Trash2 } from "lucide-react"

import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
	StandardTooltip,
	Button,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@src/components/ui"

interface TaskHistoryWarningProps {
	className?: string
}

const TASK_WARNING_THRESHOLD = 1000
const TASK_WARNING_INCREMENT = 1000
const CLEANUP_DAYS_THRESHOLD = 30

export const TaskHistoryWarning: React.FC<TaskHistoryWarningProps> = ({ className }) => {
	const { t } = useAppTranslation()
	const { taskHistory } = useExtensionState()

	const [dismissedAtTaskCount, setDismissedAtTaskCount] = useState<number>(0)
	const [showCleanupDialog, setShowCleanupDialog] = useState(false)
	const [isCleaningUp, setIsCleaningUp] = useState(false)

	// Load dismissed state from localStorage
	useEffect(() => {
		const stored = localStorage.getItem("taskHistoryWarningDismissed")
		if (stored) {
			setDismissedAtTaskCount(parseInt(stored, 10))
		}
	}, [])

	// Calculate task count and whether to show warning
	const taskCount = useMemo(() => {
		return taskHistory?.length || 0
	}, [taskHistory])

	const shouldShowWarning = useMemo(() => {
		if (taskCount < TASK_WARNING_THRESHOLD) {
			return false
		}

		// Show warning if we've crossed a new threshold since dismissal
		const currentThreshold = Math.floor(taskCount / TASK_WARNING_INCREMENT) * TASK_WARNING_INCREMENT
		const dismissedThreshold = Math.floor(dismissedAtTaskCount / TASK_WARNING_INCREMENT) * TASK_WARNING_INCREMENT

		return currentThreshold > dismissedThreshold
	}, [taskCount, dismissedAtTaskCount])

	// Calculate how many tasks would be deleted
	const tasksToDelete = useMemo(() => {
		if (!taskHistory) return 0

		const cutoffDate = Date.now() - CLEANUP_DAYS_THRESHOLD * 24 * 60 * 60 * 1000
		return taskHistory.filter((task) => task.ts < cutoffDate).length
	}, [taskHistory])

	const handleDismiss = () => {
		setDismissedAtTaskCount(taskCount)
		localStorage.setItem("taskHistoryWarningDismissed", taskCount.toString())
	}

	const handleCleanup = async () => {
		if (isCleaningUp) return

		setIsCleaningUp(true)
		setShowCleanupDialog(false)

		try {
			// Get tasks older than 30 days
			const cutoffDate = Date.now() - CLEANUP_DAYS_THRESHOLD * 24 * 60 * 60 * 1000
			const tasksToDelete = taskHistory?.filter((task) => task.ts < cutoffDate).map((task) => task.id) || []

			if (tasksToDelete.length > 0) {
				// Send message to delete tasks
				vscode.postMessage({
					type: "deleteMultipleTasksWithIds",
					ids: tasksToDelete,
				})

				// Reset dismissed state since we've cleaned up
				setDismissedAtTaskCount(0)
				localStorage.removeItem("taskHistoryWarningDismissed")
			}
		} finally {
			setIsCleaningUp(false)
		}
	}

	if (!shouldShowWarning) {
		return null
	}

	return (
		<>
			<Popover>
				<StandardTooltip content={t("chat:taskHistoryWarning.tooltip", { count: taskCount })}>
					<PopoverTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							aria-label={t("chat:taskHistoryWarning.ariaLabel")}
							className={cn(
								"relative h-5 w-5 p-0",
								"text-yellow-500 opacity-85",
								"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]",
								"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
								"animate-pulse",
								className,
							)}>
							<AlertTriangle className="w-4 h-4" />
							{taskCount >= 2000 && (
								<span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
							)}
						</Button>
					</PopoverTrigger>
				</StandardTooltip>

				<PopoverContent className="w-80 p-4" align="end">
					<div className="space-y-3">
						<div className="flex items-start justify-between">
							<div className="flex items-center gap-2">
								<AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
								<h3 className="font-semibold text-sm">{t("chat:taskHistoryWarning.title")}</h3>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleDismiss}
								className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
								aria-label={t("chat:taskHistoryWarning.dismiss")}>
								<X className="w-3 h-3" />
							</Button>
						</div>

						<div className="text-sm text-vscode-descriptionForeground">
							<p className="mb-2">{t("chat:taskHistoryWarning.message", { count: taskCount })}</p>
							<p className="text-xs opacity-80">{t("chat:taskHistoryWarning.performance")}</p>
						</div>

						<div className="flex flex-col gap-2">
							<Button
								variant="primary"
								size="sm"
								onClick={() => setShowCleanupDialog(true)}
								disabled={isCleaningUp || tasksToDelete === 0}
								className="w-full">
								<Trash2 className="w-3 h-3 mr-2" />
								{isCleaningUp
									? t("chat:taskHistoryWarning.cleaning")
									: tasksToDelete > 0
										? t("chat:taskHistoryWarning.cleanupButton", { count: tasksToDelete })
										: t("chat:taskHistoryWarning.noOldTasks")}
							</Button>

							{tasksToDelete === 0 && taskCount > TASK_WARNING_THRESHOLD && (
								<p className="text-xs text-center text-vscode-descriptionForeground opacity-70">
									{t("chat:taskHistoryWarning.allRecent")}
								</p>
							)}
						</div>
					</div>
				</PopoverContent>
			</Popover>

			<AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
				<AlertDialogContent className="max-w-md">
					<AlertDialogHeader>
						<AlertDialogTitle>{t("chat:taskHistoryWarning.confirmTitle")}</AlertDialogTitle>
						<AlertDialogDescription className="text-vscode-foreground">
							<div className="mb-2">
								{t("chat:taskHistoryWarning.confirmMessage", {
									count: tasksToDelete,
									days: CLEANUP_DAYS_THRESHOLD,
								})}
							</div>
							<div className="text-vscode-editor-foreground bg-vscode-editor-background p-2 rounded text-sm">
								{t("chat:taskHistoryWarning.confirmWarning")}
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel asChild>
							<Button variant="secondary">{t("common:cancel")}</Button>
						</AlertDialogCancel>
						<AlertDialogAction asChild>
							<Button variant="destructive" onClick={handleCleanup}>
								<Trash2 className="w-3 h-3 mr-2" />
								{t("chat:taskHistoryWarning.confirmButton")}
							</Button>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
