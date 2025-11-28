"use client"

import { useMemo, useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { LoaderCircle, FileText, Copy, Check } from "lucide-react"

import type { Run, TaskMetrics as _TaskMetrics, Task } from "@roo-code/evals"

import { formatCurrency, formatDuration, formatTokens, formatToolUsageSuccessRate } from "@/lib/formatters"
import { useRunStatus } from "@/hooks/use-run-status"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	ScrollArea,
	Button,
} from "@/components/ui"

import { TaskStatus } from "./task-status"
import { RunStatus } from "./run-status"

type TaskMetrics = Pick<_TaskMetrics, "tokensIn" | "tokensOut" | "tokensContext" | "duration" | "cost">

type ToolUsageEntry = { attempts: number; failures: number }
type ToolUsage = Record<string, ToolUsageEntry>

// Generate abbreviation from tool name (e.g., "read_file" -> "RF", "list_code_definition_names" -> "LCDN")
function getToolAbbreviation(toolName: string): string {
	return toolName
		.split("_")
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("")
}

// Pattern definitions for syntax highlighting
type HighlightPattern = {
	pattern: RegExp
	className: string
	// If true, wraps the entire match; if a number, wraps that capture group
	wrapGroup?: number
}

const HIGHLIGHT_PATTERNS: HighlightPattern[] = [
	// Timestamps [YYYY-MM-DDTHH:MM:SS.sssZ]
	{ pattern: /\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/g, className: "text-blue-400" },
	// Log levels
	{ pattern: /\|\s*(INFO)\s*\|/g, className: "text-green-400", wrapGroup: 1 },
	{ pattern: /\|\s*(WARN|WARNING)\s*\|/g, className: "text-yellow-400", wrapGroup: 1 },
	{ pattern: /\|\s*(ERROR)\s*\|/g, className: "text-red-400", wrapGroup: 1 },
	{ pattern: /\|\s*(DEBUG)\s*\|/g, className: "text-gray-400", wrapGroup: 1 },
	// Task identifiers
	{ pattern: /(taskCreated|taskFocused|taskStarted|taskCompleted|EvalPass|EvalFail)/g, className: "text-purple-400" },
	// Message arrows
	{ pattern: /→/g, className: "text-cyan-400" },
]

// Format a single line with syntax highlighting using React elements (XSS-safe)
function formatLine(line: string): React.ReactNode[] {
	// Find all matches with their positions
	type Match = { start: number; end: number; text: string; className: string }
	const matches: Match[] = []

	for (const { pattern, className, wrapGroup } of HIGHLIGHT_PATTERNS) {
		// Reset regex state
		pattern.lastIndex = 0
		let regexMatch
		while ((regexMatch = pattern.exec(line)) !== null) {
			const capturedText = wrapGroup !== undefined ? regexMatch[wrapGroup] : regexMatch[0]
			// Skip if capture group didn't match
			if (!capturedText) continue
			const start =
				wrapGroup !== undefined ? regexMatch.index + regexMatch[0].indexOf(capturedText) : regexMatch.index
			matches.push({
				start,
				end: start + capturedText.length,
				text: capturedText,
				className,
			})
		}
	}

	// Sort matches by position and filter overlapping ones
	matches.sort((a, b) => a.start - b.start)
	const filteredMatches: Match[] = []
	for (const m of matches) {
		const lastMatch = filteredMatches[filteredMatches.length - 1]
		if (!lastMatch || m.start >= lastMatch.end) {
			filteredMatches.push(m)
		}
	}

	// Build result with highlighted spans
	const result: React.ReactNode[] = []
	let currentPos = 0

	for (const [i, m] of filteredMatches.entries()) {
		// Add text before this match
		if (m.start > currentPos) {
			result.push(line.slice(currentPos, m.start))
		}
		// Add highlighted match
		result.push(
			<span key={`${i}-${m.start}`} className={m.className}>
				{m.text}
			</span>,
		)
		currentPos = m.end
	}

	// Add remaining text
	if (currentPos < line.length) {
		result.push(line.slice(currentPos))
	}

	return result.length > 0 ? result : [line]
}

// Format log content with basic highlighting (XSS-safe - no dangerouslySetInnerHTML)
function formatLogContent(log: string): React.ReactNode[] {
	const lines = log.split("\n")
	return lines.map((line, index) => (
		<div key={index} className="hover:bg-white/5">
			{line ? formatLine(line) : " "}
		</div>
	))
}

export function Run({ run }: { run: Run }) {
	const runStatus = useRunStatus(run)
	const { tasks, tokenUsage, usageUpdatedAt } = runStatus

	const [selectedTask, setSelectedTask] = useState<Task | null>(null)
	const [taskLog, setTaskLog] = useState<string | null>(null)
	const [isLoadingLog, setIsLoadingLog] = useState(false)
	const [copied, setCopied] = useState(false)

	const onCopyLog = useCallback(async () => {
		if (!taskLog) return

		try {
			await navigator.clipboard.writeText(taskLog)
			setCopied(true)
			toast.success("Log copied to clipboard")
			setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			console.error("Failed to copy log:", error)
			toast.error("Failed to copy log")
		}
	}, [taskLog])

	// Handle ESC key to close the dialog
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && selectedTask) {
				setSelectedTask(null)
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [selectedTask])

	const onViewTaskLog = useCallback(
		async (task: Task) => {
			// Only allow viewing logs for completed tasks
			if (task.passed === null || task.passed === undefined) {
				toast.error("Task is still running")
				return
			}

			setSelectedTask(task)
			setIsLoadingLog(true)
			setTaskLog(null)

			try {
				const response = await fetch(`/api/runs/${run.id}/logs/${task.id}`)

				if (!response.ok) {
					const error = await response.json()
					toast.error(error.error || "Failed to load log")
					setSelectedTask(null)
					return
				}

				const data = await response.json()
				setTaskLog(data.logContent)
			} catch (error) {
				console.error("Error loading task log:", error)
				toast.error("Failed to load log")
				setSelectedTask(null)
			} finally {
				setIsLoadingLog(false)
			}
		},
		[run.id],
	)

	const taskMetrics: Record<number, TaskMetrics> = useMemo(() => {
		const metrics: Record<number, TaskMetrics> = {}

		tasks?.forEach((task) => {
			const usage = tokenUsage.get(task.id)

			if (task.finishedAt && task.taskMetrics) {
				metrics[task.id] = task.taskMetrics
			} else if (usage) {
				metrics[task.id] = {
					tokensIn: usage.totalTokensIn,
					tokensOut: usage.totalTokensOut,
					tokensContext: usage.contextTokens,
					duration: usage.duration ?? 0,
					cost: usage.totalCost,
				}
			}
		})

		return metrics
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tasks, tokenUsage, usageUpdatedAt])

	// Compute aggregate stats
	const stats = useMemo(() => {
		if (!tasks) return null

		const passed = tasks.filter((t) => t.passed === true).length
		const failed = tasks.filter((t) => t.passed === false).length
		// Count running tasks exactly like TaskStatus shows spinner:
		// - passed is not true and not false (null/undefined)
		// - AND has activity (startedAt or tokenUsage)
		const running = tasks.filter(
			(t) => t.passed !== true && t.passed !== false && (t.startedAt || tokenUsage.get(t.id)),
		).length
		const pending = tasks.filter(
			(t) => t.passed !== true && t.passed !== false && !t.startedAt && !tokenUsage.get(t.id),
		).length
		const total = tasks.length
		const completed = passed + failed

		let totalTokensIn = 0
		let totalTokensOut = 0
		let totalCost = 0
		let totalDuration = 0

		// Aggregate tool usage from completed tasks
		const toolUsage: ToolUsage = {}

		for (const task of tasks) {
			const metrics = taskMetrics[task.id]
			if (metrics) {
				totalTokensIn += metrics.tokensIn
				totalTokensOut += metrics.tokensOut
				totalCost += metrics.cost
				totalDuration += metrics.duration
			}

			// Aggregate tool usage from finished tasks with taskMetrics
			if (task.finishedAt && task.taskMetrics?.toolUsage) {
				for (const [key, usage] of Object.entries(task.taskMetrics.toolUsage)) {
					const tool = key as keyof ToolUsage
					if (!toolUsage[tool]) {
						toolUsage[tool] = { attempts: 0, failures: 0 }
					}
					toolUsage[tool].attempts += usage.attempts
					toolUsage[tool].failures += usage.failures
				}
			}
		}

		return {
			passed,
			failed,
			running,
			pending,
			total,
			completed,
			passRate: completed > 0 ? ((passed / completed) * 100).toFixed(1) : null,
			totalTokensIn,
			totalTokensOut,
			totalCost,
			totalDuration,
			toolUsage,
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tasks, taskMetrics, tokenUsage, usageUpdatedAt])

	return (
		<>
			<div>
				<div className="mb-4">
					<div>
						<div className="font-mono">{run.model}</div>
						{run.description && <div className="text-sm text-muted-foreground">{run.description}</div>}
					</div>
					{!run.taskMetricsId && <RunStatus runStatus={runStatus} />}
				</div>

				{stats && (
					<div className="mb-4 p-4 border rounded-lg bg-muted/50">
						{/* Main Stats Row */}
						<div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
							{/* Passed/Failed */}
							<div className="text-center">
								<div className="text-2xl font-bold whitespace-nowrap">
									<span className="text-green-600">{stats.passed}</span>
									<span className="text-muted-foreground mx-1">/</span>
									<span className="text-red-600">{stats.failed}</span>
									{stats.running > 0 && (
										<span className="text-yellow-600 text-sm ml-2">({stats.running})</span>
									)}
								</div>
								<div className="text-xs text-muted-foreground">Passed / Failed</div>
							</div>

							{/* Pass Rate */}
							<div className="text-center">
								<div className="text-2xl font-bold">{stats.passRate ? `${stats.passRate}%` : "-"}</div>
								<div className="text-xs text-muted-foreground">Pass Rate</div>
							</div>

							{/* Tokens */}
							<div className="text-center">
								<div className="text-xl font-bold font-mono whitespace-nowrap">
									{formatTokens(stats.totalTokensIn)}
									<span className="text-muted-foreground mx-1">/</span>
									{formatTokens(stats.totalTokensOut)}
								</div>
								<div className="text-xs text-muted-foreground">Tokens In / Out</div>
							</div>

							{/* Cost */}
							<div className="text-center">
								<div className="text-2xl font-bold font-mono">{formatCurrency(stats.totalCost)}</div>
								<div className="text-xs text-muted-foreground">Cost</div>
							</div>

							{/* Duration */}
							<div className="text-center">
								<div className="text-2xl font-bold font-mono whitespace-nowrap">
									{stats.totalDuration > 0 ? formatDuration(stats.totalDuration) : "-"}
								</div>
								<div className="text-xs text-muted-foreground">Duration</div>
							</div>

							{/* Tool Usage - Inline */}
							{Object.keys(stats.toolUsage).length > 0 && (
								<div className="flex items-center gap-2 flex-wrap">
									{Object.entries(stats.toolUsage)
										.sort(([, a], [, b]) => b.attempts - a.attempts)
										.map(([toolName, usage]) => {
											const abbr = getToolAbbreviation(toolName)
											const successRate =
												usage.attempts > 0
													? ((usage.attempts - usage.failures) / usage.attempts) * 100
													: 100
											const rateColor =
												successRate === 100
													? "text-green-500"
													: successRate >= 80
														? "text-yellow-500"
														: "text-red-500"
											return (
												<Tooltip key={toolName}>
													<TooltipTrigger asChild>
														<div className="flex items-center gap-1 px-2 py-1 rounded bg-background/50 border border-border/50 hover:border-border transition-colors cursor-default text-xs">
															<span className="font-medium text-muted-foreground">
																{abbr}
															</span>
															<span className="font-bold tabular-nums">
																{usage.attempts}
															</span>
															<span className={`${rateColor}`}>
																{formatToolUsageSuccessRate(usage)}
															</span>
														</div>
													</TooltipTrigger>
													<TooltipContent side="bottom">{toolName}</TooltipContent>
												</Tooltip>
											)
										})}
								</div>
							)}
						</div>
					</div>
				)}
				{!tasks ? (
					<LoaderCircle className="size-4 animate-spin" />
				) : (
					<Table className="border">
						<TableHeader>
							<TableRow>
								<TableHead>Exercise</TableHead>
								<TableHead className="text-center">Tokens In / Out</TableHead>
								<TableHead>Context</TableHead>
								<TableHead>Duration</TableHead>
								<TableHead>Cost</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{tasks.map((task) => (
								<TableRow
									key={task.id}
									className={task.finishedAt ? "cursor-pointer hover:bg-muted/50" : ""}
									onClick={() => task.finishedAt && onViewTaskLog(task)}>
									<TableCell>
										<div className="flex items-center gap-2">
											<TaskStatus
												task={task}
												running={!!task.startedAt || !!tokenUsage.get(task.id)}
											/>
											<div className="flex items-center gap-2">
												<span>
													{task.language}/{task.exercise}
													{task.iteration > 1 && (
														<span className="text-muted-foreground ml-1">
															(#{task.iteration})
														</span>
													)}
												</span>
												{task.finishedAt && (
													<Tooltip>
														<TooltipTrigger asChild>
															<FileText className="size-3 text-muted-foreground" />
														</TooltipTrigger>
														<TooltipContent>Click to view log</TooltipContent>
													</Tooltip>
												)}
											</div>
										</div>
									</TableCell>
									{taskMetrics[task.id] ? (
										<>
											<TableCell className="font-mono text-xs">
												<div className="flex items-center justify-evenly">
													<div>{formatTokens(taskMetrics[task.id]!.tokensIn)}</div>/
													<div>{formatTokens(taskMetrics[task.id]!.tokensOut)}</div>
												</div>
											</TableCell>
											<TableCell className="font-mono text-xs">
												{formatTokens(taskMetrics[task.id]!.tokensContext)}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{taskMetrics[task.id]!.duration
													? formatDuration(taskMetrics[task.id]!.duration)
													: "-"}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{formatCurrency(taskMetrics[task.id]!.cost)}
											</TableCell>
										</>
									) : (
										<TableCell colSpan={4} />
									)}
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</div>

			{/* Task Log Dialog - Full Screen */}
			<Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
				<DialogContent className="w-[95vw] !max-w-[95vw] h-[90vh] flex flex-col">
					<DialogHeader className="flex-shrink-0">
						<div className="flex items-center justify-between pr-8">
							<DialogTitle className="flex items-center gap-2">
								<FileText className="size-4" />
								{selectedTask?.language}/{selectedTask?.exercise}
								{selectedTask?.iteration && selectedTask.iteration > 1 && (
									<span className="text-muted-foreground">(#{selectedTask.iteration})</span>
								)}
								<span
									className={`ml-2 text-sm ${selectedTask?.passed ? "text-green-600" : "text-red-600"}`}>
									({selectedTask?.passed ? "Passed" : "Failed"})
								</span>
							</DialogTitle>
							{taskLog && (
								<Button
									variant="outline"
									size="sm"
									onClick={onCopyLog}
									className="flex items-center gap-1">
									{copied ? (
										<>
											<Check className="size-4" />
											Copied!
										</>
									) : (
										<>
											<Copy className="size-4" />
											Copy Log
										</>
									)}
								</Button>
							)}
						</div>
					</DialogHeader>
					<div className="flex-1 min-h-0 overflow-hidden">
						{isLoadingLog ? (
							<div className="flex items-center justify-center h-full">
								<LoaderCircle className="size-6 animate-spin" />
							</div>
						) : taskLog ? (
							<ScrollArea className="h-full w-full">
								<div className="text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto">
									{formatLogContent(taskLog)}
								</div>
							</ScrollArea>
						) : (
							<div className="flex items-center justify-center h-full text-muted-foreground">
								Log file not available (may have been cleared)
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}
