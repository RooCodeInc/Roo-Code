import React from "react"
import TaskStatusBar from "./TaskStatusBar"
import CodeReviewContent from "./CodeReviewContent"
import { ReviewIssue, TaskStatus } from "@roo/codeReview"
interface CodeReviewPanelProps {
	issues: ReviewIssue[]
	taskStatus: TaskStatus
	progress: number | null
	reviewProgress: string
	errorMessage: string
	message: string
	onIssueClick: (issueId: string) => void
	onTaskCancel: () => void
	hasRunCodebaseSync?: boolean // 是否运行过索引同步服务
}
const CodeReviewPanel: React.FC<CodeReviewPanelProps> = ({
	issues,
	taskStatus,
	progress,
	reviewProgress,
	message,
	errorMessage,
	onIssueClick,
	onTaskCancel,
	hasRunCodebaseSync = false,
}) => {
	return (
		<div className="flex flex-col h-full">
			<div className="flex-shrink-0 px-5">
				<TaskStatusBar
					taskStatus={taskStatus}
					progress={progress}
					reviewProgress={reviewProgress}
					issues={issues}
					message={message}
					errorMessage={errorMessage}
					onTaskCancel={onTaskCancel}
					hasRunCodebaseSync={hasRunCodebaseSync}
				/>
			</div>
			<div className="flex-1 overflow-hidden">
				<CodeReviewContent issues={issues} taskStatus={taskStatus} onIssueClick={onIssueClick} />
			</div>
		</div>
	)
}

export default CodeReviewPanel
