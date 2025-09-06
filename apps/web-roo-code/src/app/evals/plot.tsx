"use client"

import { useMemo } from "react"
import { ScatterChart, Scatter, XAxis, YAxis, Label, Customized, Cross, LabelList } from "recharts"

import { formatCurrency } from "@/lib"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui"

import type { EvalRun } from "./types"

type PlotProps = {
	tableData: (EvalRun & { label: string; cost: number })[]
}

export const Plot = ({ tableData }: PlotProps) => {
	const chartData = useMemo(() => tableData.filter(({ cost }) => cost < 50), [tableData])

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
					{chartData.map((d, index) => (
						<Scatter
							key={d.label}
							name={d.label}
							data={[d]}
							fill={generateSpectrumColor(index, chartData.length)}>
							<LabelList dataKey="label" position="top" offset={8} content={renderCustomLabel} />
						</Scatter>
					))}
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderCustomLabel = (props: any) => {
	const { x, y, value } = props
	const maxWidth = 80 // Maximum width in pixels - adjust as needed.

	const truncateText = (text: string, maxChars: number = 12) => {
		if (text.length <= maxChars) {
			return text
		}

		return text.substring(0, maxChars - 1) + "…"
	}

	return (
		<text
			x={x}
			y={y - 5}
			fontSize="10"
			fontWeight="500"
			fill="currentColor"
			opacity="0.8"
			textAnchor="middle"
			dominantBaseline="auto"
			style={{
				pointerEvents: "none",
				maxWidth: `${maxWidth}px`,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			}}>
			{truncateText(value)}
		</text>
	)
}

const generateSpectrumColor = (index: number, total: number): string => {
	// Distribute hues evenly across the color wheel (0-360 degrees)
	// Start at 0 (red) and distribute evenly.
	const hue = (index * 360) / total
	// Use high saturation for vibrant colors.
	const saturation = 70
	// Use medium lightness for good visibility on both light and dark backgrounds.
	const lightness = 50
	return `hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`
}
