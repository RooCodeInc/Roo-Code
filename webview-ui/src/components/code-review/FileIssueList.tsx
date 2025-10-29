import React, { useState, useMemo, useEffect } from "react"
import IssueItem from "./IssueItem"
import { ChevronUpIcon, ChevronDownIcon } from "@radix-ui/react-icons"
import { ReviewIssue, IssueStatus } from "@roo/codeReview"
import SetiFileIcon from "../common/SetiFileIcon"

interface FileIssueListProps {
	fileName: string
	issues: ReviewIssue[]
	onIssueClick: (issueId: string) => void
}

const FileIssueList: React.FC<FileIssueListProps> = ({ fileName, issues, onIssueClick }) => {
	const [isExpanded, setIsExpanded] = useState(true)

	const allIssuesProcessed = useMemo(() => {
		return (
			issues.length > 0 &&
			issues.every((issue) => issue.status !== IssueStatus.INITIAL && issue.status !== IssueStatus.IGNORE)
		)
	}, [issues])

	useEffect(() => {
		if (allIssuesProcessed) {
			setIsExpanded(false)
		}
	}, [allIssuesProcessed])

	return (
		<div className="w-full" style={{ opacity: allIssuesProcessed ? 0.4 : 1 }}>
			<div className="flex justify-between pr-5">
				<div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
					<SetiFileIcon fileName={fileName} size={16} className="flex-shrink-0" />
					<span className="truncate" title={fileName}>
						{fileName}
					</span>
					<div onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer flex-shrink-0">
						{isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
					</div>
				</div>
				<div className="flex items-center gap-1 flex-shrink-0">
					<span className="codicon codicon-bug"></span>
					<span>{issues.length}</span>
				</div>
			</div>
			{isExpanded && (
				<div className="w-full mt-2">
					{(issues ?? []).map((issue) => (
						<IssueItem key={issue.id} issue={issue} onIssueClick={onIssueClick} />
					))}
				</div>
			)}
		</div>
	)
}

export default FileIssueList
