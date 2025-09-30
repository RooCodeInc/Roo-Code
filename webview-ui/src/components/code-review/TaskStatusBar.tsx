import React, { useMemo } from "react"
import { ReviewIssue, TaskStatus } from "@roo/codeReview"
import { CheckIcon, InfoCircledIcon } from "@radix-ui/react-icons"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface TaskStatusBarProps {
	taskStatus: TaskStatus
	progress: number | null
	reviewProgress: string
	message: string
	errorMessage: string
	issues: ReviewIssue[]
	onTaskCancel: () => void
	hasRunCodebaseSync?: boolean // 是否运行过索引同步服务
}

const TaskStatusBar: React.FC<TaskStatusBarProps> = ({
	taskStatus,
	progress,
	reviewProgress,
	issues,
	message,
	errorMessage,
	onTaskCancel,
	hasRunCodebaseSync = false,
}) => {
	const { t } = useAppTranslation()
	const adjustedProgress = useMemo(() => {
		return hasRunCodebaseSync ? Math.round((progress ?? 0 * 0.7 + 0.3) * 100) : Math.round((progress ?? 0) * 100)
	}, [progress, hasRunCodebaseSync])
	return (
		<div className="flex items-center mt-5">
			{taskStatus === TaskStatus.RUNNING && (
				<div className="mb-4">
					<div>
						<div className="flex items-center">
							<div
								className="w-4 h-4 rounded-full border-2 border-transparent animate-spin"
								style={{ borderTopColor: "rgba(23, 112, 230, 0.7)" }}
							/>
							{progress !== null && (
								<div>
									<span className="ml-2">
										{reviewProgress
											? `${reviewProgress} ${adjustedProgress}%`
											: t("codereview:taskStatusBar.running", { progress: adjustedProgress })}
									</span>
									<span className="ml-2 text-[#1876F2] cursor-pointer" onClick={() => onTaskCancel()}>
										{t("codereview:taskStatusBar.cancel")}
									</span>
								</div>
							)}
							{message && <span className="ml-2">{message}</span>}
						</div>
						{progress !== null && (
							<div className="text-neutral-500 italic text-sm mt-2">{t("codereview:tips")}</div>
						)}
					</div>
				</div>
			)}
			{taskStatus === TaskStatus.COMPLETED && issues.length === 0 && (
				<div className="flex items-center mb-4">
					<CheckIcon color="#50B371" width={20} height={20} />
					<span className="ml-2">{t("codereview:taskStatusBar.completed")}</span>
				</div>
			)}
			{taskStatus === TaskStatus.ERROR && (
				<div className="w-full mb-4">
					<div className="w-full flex items-center">
						<InfoCircledIcon
							className="text-[#E64545] leading-[17px] flex-shrink-0 mt-0.5"
							width={20}
							height={20}
						/>
						<span className="ml-2 text-[#E64545] leading-[17px] break-words flex-1 min-w-0">
							{errorMessage ?? ""}
						</span>
					</div>
				</div>
			)}
		</div>
	)
}

export default TaskStatusBar
