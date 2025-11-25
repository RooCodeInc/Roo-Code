"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Rocket } from "lucide-react"

import type { Run, TaskMetrics } from "@roo-code/evals"
import type { ToolName } from "@roo-code/types"

import {
	Button,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui"
import { Run as Row } from "@/components/home/run"

type RunWithTaskMetrics = Run & { taskMetrics: TaskMetrics | null }

// Generate abbreviation from tool name (e.g., "read_file" -> "RF", "list_code_definition_names" -> "LCDN")
function getToolAbbreviation(toolName: string): string {
	return toolName
		.split("_")
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("")
}

export function Runs({ runs }: { runs: RunWithTaskMetrics[] }) {
	const router = useRouter()

	// Collect all unique tool names from all runs and sort by total attempts
	const toolColumns = useMemo<ToolName[]>(() => {
		const toolTotals = new Map<ToolName, number>()

		for (const run of runs) {
			if (run.taskMetrics?.toolUsage) {
				for (const [toolName, usage] of Object.entries(run.taskMetrics.toolUsage)) {
					const tool = toolName as ToolName
					const current = toolTotals.get(tool) ?? 0
					toolTotals.set(tool, current + usage.attempts)
				}
			}
		}

		// Sort by total attempts descending
		return Array.from(toolTotals.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name]): ToolName => name)
	}, [runs])

	// Calculate colSpan for empty state (5 base columns + dynamic tools + 3 end columns)
	const totalColumns = 5 + toolColumns.length + 3

	return (
		<>
			<Table className="border border-t-0">
				<TableHeader>
					<TableRow>
						<TableHead>Model</TableHead>
						<TableHead>Passed</TableHead>
						<TableHead>Failed</TableHead>
						<TableHead>%</TableHead>
						<TableHead>Tokens</TableHead>
						{toolColumns.map((toolName) => (
							<TableHead key={toolName} className="text-xs text-center">
								<Tooltip>
									<TooltipTrigger>{getToolAbbreviation(toolName)}</TooltipTrigger>
									<TooltipContent>{toolName}</TooltipContent>
								</Tooltip>
							</TableHead>
						))}
						<TableHead>Cost</TableHead>
						<TableHead>Duration</TableHead>
						<TableHead></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{runs.length ? (
						runs.map(({ taskMetrics, ...run }) => (
							<Row key={run.id} run={run} taskMetrics={taskMetrics} toolColumns={toolColumns} />
						))
					) : (
						<TableRow>
							<TableCell colSpan={totalColumns} className="text-center">
								No eval runs yet.
								<Button variant="link" onClick={() => router.push("/runs/new")}>
									Launch
								</Button>
								one now.
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
			<Button
				variant="default"
				className="absolute top-4 right-12 size-12 rounded-full"
				onClick={() => router.push("/runs/new")}>
				<Rocket className="size-6" />
			</Button>
		</>
	)
}
