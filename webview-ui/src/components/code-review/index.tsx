import React, { useEffect, useState } from "react"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { TaskStatus } from "@roo/codeReview"
import CodeReviewPanel from "./CodeReviewPanel"
import WelcomePage from "./WelcomePage"
import CodebaseSync from "./CodebaseSync"

interface CodeReviewPageProps {
	isHidden?: boolean
	onIssueClick: (issueId: string) => void
	onTaskCancel: () => void
}

enum Page {
	Welcome = "welcome",
	CodebaseSync = "codebaseSync",
	Review = "review",
}

const CodeReviewPage: React.FC<CodeReviewPageProps> = ({ isHidden, onIssueClick, onTaskCancel }) => {
	const { reviewTask, reviewPagePayload, setReviewTask } = useExtensionState()
	const {
		status,
		data: { issues, progress, error = "", message = "", reviewProgress = "" },
	} = reviewTask
	const { targets, isCodebaseReady } = reviewPagePayload
	const [hasShownCodebaseSync, setHasShownCodebaseSync] = useState(false)
	const [page, setPage] = useState<Page>(() => {
		if (!isCodebaseReady) {
			return Page.CodebaseSync
		}
		if (status === TaskStatus.INITIAL && issues.length === 0) {
			return Page.Welcome
		}
		return Page.Review
	})

	useEffect(() => {
		if (!isCodebaseReady) {
			setPage(Page.CodebaseSync)
		} else if (status === TaskStatus.INITIAL && issues.length === 0) {
			setPage(Page.Welcome)
		} else {
			setPage(Page.Review)
		}
	}, [isCodebaseReady, status, issues.length])
	useEffect(() => {
		if ([TaskStatus.COMPLETED, TaskStatus.ERROR].includes(status)) {
			setHasShownCodebaseSync(false)
		}
	}, [status])
	const onCancel = () => {
		setPage(Page.Welcome)
		setHasShownCodebaseSync(false)
		setReviewTask({
			status: TaskStatus.INITIAL,
			data: {
				issues: [],
				progress: null,
				error: "",
				message: "",
			},
		})
	}
	useEffect(() => {
		if (page === Page.CodebaseSync && !hasShownCodebaseSync) {
			setHasShownCodebaseSync(true)
		}
	}, [page, hasShownCodebaseSync])

	switch (page) {
		case Page.CodebaseSync:
			return (
				<div
					className={`fixed top-[28px] left-0 right-0 bottom-0 flex flex-col overflow-hidden ${isHidden ? "hidden" : ""}`}>
					<CodebaseSync onCancel={onCancel} targets={targets} />
				</div>
			)
		case Page.Welcome:
			return <WelcomePage />
		case Page.Review:
			return (
				<div
					className={`fixed top-[28px] left-0 right-0 bottom-0 flex flex-col overflow-hidden ${isHidden ? "hidden" : ""}`}>
					<CodeReviewPanel
						issues={issues} // To be sourced from context
						taskStatus={status}
						progress={progress} // To be sourced from context
						reviewProgress={reviewProgress}
						message={message}
						errorMessage={error}
						onIssueClick={onIssueClick}
						onTaskCancel={onTaskCancel}
						hasRunCodebaseSync={hasShownCodebaseSync}
					/>
				</div>
			)
	}
}

export default CodeReviewPage
