"use client"

import { useMemo } from "react"
import { ScatterChart, Scatter, XAxis, YAxis, Label, Customized, Cross } from "recharts"

import { formatCurrency } from "@/lib"
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartConfig,
	ChartLegend,
	ChartLegendContent,
} from "@/components/ui"

import type { EvalRun } from "./types"

type PlotProps = {
	tableData: (EvalRun & { label: string; cost: number })[]
}

export const Plot = ({ tableData }: PlotProps) => {
	const chartData = useMemo(() => tableData.filter(({ cost }) => cost < 100), [tableData])

	const chartConfig = useMemo(
		() => chartData.reduce((acc, run) => ({ ...acc, [run.label]: run }), {} as ChartConfig),
		[chartData],
	)

	return (
		<>
			<div className="pb-4 font-medium">Cost Versus Score</div>
			<ChartContainer config={chartConfig} className="h-[500px] w-full">
				<ScatterChart margin={{ top: 0, right: 0, bottom: 0, left: 20 }}>
					<XAxis
						type="number"
						dataKey="cost"
						name="Cost"
						domain={[
							(dataMin: number) => Math.round((dataMin - 5) / 5) * 5,
							(dataMax: number) => Math.round((dataMax + 5) / 5) * 5,
						]}
						tickFormatter={(value) => formatCurrency(value)}>
						<Label value="Cost" position="bottom" offset={0} />
					</XAxis>
					<YAxis
						type="number"
						dataKey="score"
						name="Score"
						domain={[
							(dataMin: number) => Math.max(0, Math.round((dataMin - 5) / 5) * 5),
							(dataMax: number) => Math.min(100, Math.round((dataMax + 5) / 5) * 5),
						]}
						tickFormatter={(value) => `${value}%`}>
						<Label value="Score" angle={-90} position="left" dy={-15} />
					</YAxis>
					<ChartTooltip content={<ChartTooltipContent labelKey="label" hideIndicator />} />
					<Customized component={renderQuadrant} />
					{chartData.map((d, i) => (
						<Scatter key={d.label} name={d.label} data={[d]} fill={`hsl(var(--chart-${i + 1}))`} />
					))}
					<ChartLegend content={<ChartLegendContent />} />
				</ScatterChart>
			</ChartContainer>
			<div className="py-4 text-xs opacity-50">
				(Note: Very expensive models are excluded from the scatter plot.)
			</div>
		</>
	)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderQuadrant = (props: any) => (
	<Cross
		width={props.width}
		height={props.height}
		x={props.width / 2 + 35}
		y={props.height / 2 - 15}
		top={0}
		left={0}
		stroke="currentColor"
		opacity={0.1}
	/>
)
