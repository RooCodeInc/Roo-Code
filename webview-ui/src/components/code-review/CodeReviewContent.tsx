import React, { useMemo, useState, useCallback } from "react"
import { CircleAlert } from "lucide-react"
import { ReviewIssue, TaskStatus, SeverityLevel } from "@roo/codeReview"
import TaskSummary from "./TaskSummary"
import FileIssueList from "./FileIssueList"
import {
	Popover,
	PopoverTrigger,
	PopoverContent,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui"
import { severityColor } from "./contants"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface FilterState {
	selectedSeverities: SeverityLevel[]
	selectedIssueTypes: string[]
	selectedConfidence: ConfidenceLevel
}

interface CodeReviewContentProps {
	issues: ReviewIssue[]
	taskStatus: TaskStatus
	onIssueClick: (issueId: string) => void
}

type ConfidenceLevel = "low" | "middle" | "high"

const CONFIDENCE_INACTIVE_COLOR = "rgba(0, 203, 68, 0.15)"

// Utility function to calculate confidence styles
const getConfidenceStyles = (isSelected: boolean) => {
	return {
		backgroundColor: isSelected ? "#00CB44" : CONFIDENCE_INACTIVE_COLOR,
		color: isSelected ? "#FFFFFF" : "#00CB44",
	}
}

const CodeReviewContent: React.FC<CodeReviewContentProps> = ({ issues, taskStatus, onIssueClick }) => {
	const { t } = useAppTranslation()

	// Filter state
	const [filterState, setFilterState] = useState<FilterState>({
		selectedSeverities: [],
		selectedIssueTypes: [],
		selectedConfidence: "middle",
	})

	// Toggle severity filter
	const toggleSeverity = (severity: SeverityLevel) => {
		setFilterState((prev) => ({
			...prev,
			selectedSeverities: prev.selectedSeverities.includes(severity)
				? prev.selectedSeverities.filter((s) => s !== severity)
				: [...prev.selectedSeverities, severity],
		}))
	}

	// Toggle issue type filter
	const toggleIssueType = (issueType: string) => {
		setFilterState((prev) => ({
			...prev,
			selectedIssueTypes: prev.selectedIssueTypes.includes(issueType)
				? prev.selectedIssueTypes.filter((t) => t !== issueType)
				: [...prev.selectedIssueTypes, issueType],
		}))
	}

	// Apply filters to issues
	const filteredIssues = useMemo(() => {
		const matchConfidence = (confidence: number) => {
			let confidenceLevel: ConfidenceLevel
			if (confidence >= 0.1 && confidence <= 0.4) {
				confidenceLevel = "low"
			} else if (confidence >= 0.5 && confidence <= 0.7) {
				confidenceLevel = "middle"
			} else if (confidence >= 0.8 && confidence <= 1) {
				confidenceLevel = "high"
			} else {
				// Handle out of range cases, default to middle
				confidenceLevel = "middle"
			}

			return confidenceLevel === filterState.selectedConfidence
		}

		return issues.filter((issue) => {
			// Severity filter
			const severityMatch =
				filterState.selectedSeverities.length === 0 || filterState.selectedSeverities.includes(issue.severity)

			// Issue type filter
			const typeMatch =
				filterState.selectedIssueTypes.length === 0 ||
				issue.issue_types.some((type) => filterState.selectedIssueTypes.includes(type))

			// Confidence filter
			const confidenceMatch = matchConfidence(issue.confidence)

			return severityMatch && typeMatch && confidenceMatch
		})
	}, [issues, filterState])

	// Show notification dot if there are active filter conditions
	const showNotificationDot =
		filterState.selectedSeverities.length > 0 ||
		filterState.selectedIssueTypes.length > 0 ||
		filterState.selectedConfidence !== null

	// Group filtered issues by file_path
	const groupedIssues = useMemo(() => {
		const groups: { [filePath: string]: ReviewIssue[] } = {}
		filteredIssues.forEach((issue) => {
			if (!groups[issue.file_path]) {
				groups[issue.file_path] = []
			}
			groups[issue.file_path].push(issue)
		})
		return groups
	}, [filteredIssues])

	const normalColor = severityColor(0.1)
	const activeColor = severityColor()
	const severity = useMemo(
		() => ({
			[SeverityLevel.HIGH]: {
				label: t("codereview:codeReviewContent.severity.high"),
			},
			[SeverityLevel.MIDDLE]: {
				label: t("codereview:codeReviewContent.severity.middle"),
			},
			[SeverityLevel.LOW]: {
				label: t("codereview:codeReviewContent.severity.low"),
			},
		}),
		[t],
	)

	const confidence = useMemo<{ label: string; value: ConfidenceLevel }[]>(() => {
		return [
			{
				label: t("codereview:codeReviewContent.confidence.low"),
				value: "low",
			},
			{
				label: t("codereview:codeReviewContent.confidence.middle"),
				value: "middle",
			},
			{
				label: t("codereview:codeReviewContent.confidence.high"),
				value: "high",
			},
		]
	}, [t])

	// Get unique issue types from all issues (not filtered ones for filter options)
	const uniqueIssueTypes = useMemo(() => {
		const allIssueTypes = issues.flatMap((issue) => issue.issue_types)
		return Array.from(new Set(allIssueTypes))
	}, [issues])

	// Check if severity is selected
	const isSeveritySelected = useCallback(
		(severityLevel: SeverityLevel) => filterState.selectedSeverities.includes(severityLevel),
		[filterState.selectedSeverities],
	)

	// Check if issue type is selected
	const isIssueTypeSelected = useCallback(
		(issueType: string) => filterState.selectedIssueTypes.includes(issueType),
		[filterState.selectedIssueTypes],
	)

	// Handle confidence selection
	const toggleConfidenceSelect = useCallback(
		(value: ConfidenceLevel) => {
			setFilterState((prev) => ({
				...prev,
				selectedConfidence: value,
			}))
		},
		[setFilterState],
	)

	return (
		<div className="flex flex-col h-full">
			{(taskStatus === TaskStatus.COMPLETED || (taskStatus === TaskStatus.ERROR && issues.length !== 0)) && (
				<div className="px-5 mb-4">
					<div className="flex justify-between items-center flex-shrink-0">
						<TaskSummary issues={filteredIssues} />
						<Popover>
							<PopoverTrigger>
								<div className="relative">
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger>
												<div
													className={`w-6 h-6 flex items-center justify-center rounded-[1px] transition-all duration-200 hover:bg-white/10 active:bg-white/10 cursor-pointer ${showNotificationDot ? "bg-white/10" : ""}`}>
													<i className="codicon codicon-filter"></i>
												</div>
											</TooltipTrigger>
											<TooltipContent side="top" className="text-base">
												{t("codereview:codeReviewContent.filterTooltip")}
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
									{showNotificationDot && (
										<div
											className="absolute top-[2px] right-0 w-[5px] h-[5px] bg-red-500 rounded-full"
											style={{ transform: "translate(50%, -50%)" }}></div>
									)}
								</div>
							</PopoverTrigger>
							<PopoverContent
								className="!border-transparent bg-popover mr-2 rounded-[5px]"
								style={{
									boxShadow: "0 2px 8px var(--color-vscode-widget-shadow)",
									outline: "1px solid var(--color-vscode-menu-border)",
								}}>
								<div className="flex flex-col">
									<div className="mb-4">
										<div className="flex items-center mb-2">
											{t("codereview:codeReviewContent.severityLabel")}
										</div>
										<div className="flex items-center gap-2">
											{Object.entries(severity).map(([key, { label }]) => {
												const severityLevel = parseInt(key) as SeverityLevel
												const isSelected = isSeveritySelected(severityLevel)
												return (
													<div
														key={key}
														className={`flex justify-center items-center rounded-[20px] py-[3px] px-4 cursor-pointer transition-all duration-200`}
														style={{
															backgroundColor: isSelected
																? activeColor[severityLevel]
																: normalColor[severityLevel],
															color: isSelected
																? "var(--vscode-list-activeSelectionForeground)"
																: activeColor[severityLevel],
														}}
														onClick={() => toggleSeverity(severityLevel)}>
														{label}
													</div>
												)
											})}
										</div>
									</div>
									<div className="mb-4">
										<div className="flex items-center mb-2">
											<span>{t("codereview:codeReviewContent.confidenceLabel")}</span>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<CircleAlert className="w-4 h-4 ml-1" />
													</TooltipTrigger>
													<TooltipContent side="top" className="w-52">
														{t("codereview:codeReviewContent.confidenceTooltip")}
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
										<div className="flex items-center gap-2">
											{confidence.map(({ label, value }) => {
												const isSelected = filterState.selectedConfidence === value
												const { backgroundColor, color } = getConfidenceStyles(isSelected)

												return (
													<div
														className={`flex justify-center items-center rounded-[20px] py-[3px] px-4 cursor-pointer transition-all duration-200`}
														style={{
															backgroundColor,
															color,
														}}
														key={value}
														onClick={() => toggleConfidenceSelect(value)}>
														<span>{label}</span>
													</div>
												)
											})}
										</div>
									</div>
									<div>
										<div className="flex items-center mb-2">
											{t("codereview:codeReviewContent.issueLable")}
										</div>
										<div className="flex items-center gap-2 flex-wrap">
											{uniqueIssueTypes.map((type) => {
												const isSelected = isIssueTypeSelected(type)
												return (
													<div
														key={type}
														className={`h-4 truncate flex justify-center items-center px-4 py-3 rounded-[20px] cursor-pointer transition-all duration-200`}
														style={{
															backgroundColor: isSelected
																? "#E6C000"
																: "rgba(230,192,0,0.1)",
															color: isSelected
																? "var(--vscode-list-activeSelectionForeground)"
																: "#E6C000",
														}}
														onClick={() => toggleIssueType(type)}>
														{type}
													</div>
												)
											})}
										</div>
									</div>
								</div>
							</PopoverContent>
						</Popover>
					</div>
					{!!issues.length && (
						<div className="text-neutral-500 italic text-sm mt-2">{t("codereview:tips")}</div>
					)}
				</div>
			)}
			<div className="flex-1 overflow-y-auto pl-5">
				<div className="flex flex-col space-y-4">
					{Object.entries(groupedIssues).map(([filePath, fileIssues]) => (
						<FileIssueList
							key={filePath}
							fileName={filePath}
							issues={fileIssues}
							onIssueClick={onIssueClick}
						/>
					))}
				</div>
			</div>
		</div>
	)
}

// Export the component
export default CodeReviewContent
