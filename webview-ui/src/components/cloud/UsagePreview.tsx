import { useEffect, useState } from "react"
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { CircleAlert, SquareArrowOutUpRight } from "lucide-react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { formatDateShort } from "@/utils/format"

interface DailyUsage {
	date: string // ISO date string
	taskCount: number
	tokenCount: number
	cost: number // in USD
}

interface UsageStats {
	days: DailyUsage[]
	totals: {
		tasks: number
		tokens: number
		cost: number
	}
}

interface UsagePreviewProps {
	onViewDetails: () => void
}

export const UsagePreview = ({ onViewDetails }: UsagePreviewProps) => {
	const { t } = useAppTranslation()
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [data, setData] = useState<UsageStats | null>(null)

	// Format large numbers (e.g., 14800000 -> "14.8M")
	const formatTokenCount = (tokens: number): string => {
		if (tokens >= 1_000_000) {
			return `${(tokens / 1_000_000).toFixed(1)}M`
		} else if (tokens >= 1_000) {
			return `${(tokens / 1_000).toFixed(1)}K`
		}
		return tokens.toString()
	}

	// Format cost (e.g., 17.81 -> "$17.81")
	const formatCost = (cost: number): string => {
		return `$${cost.toFixed(2)}`
	}

	// Fetch usage data on mount
	useEffect(() => {
		setIsLoading(true)
		setError(null)

		// Request usage preview data from the extension
		vscode.postMessage({ type: "getUsagePreview" })

		// Listen for the response
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			if (message.type === "usagePreviewData") {
				console.log("[UsagePreview] Received usagePreviewData:", message)
				console.log("[UsagePreview] Data structure:", {
					hasData: !!message.data,
					dataKeys: message.data ? Object.keys(message.data) : [],
					hasDays: message.data?.days !== undefined,
					daysIsArray: Array.isArray(message.data?.days),
					daysLength: message.data?.days?.length || 0,
				})

				if (message.error) {
					console.log("[UsagePreview] Setting error:", message.error)
					setError(message.error)
				} else if (message.data) {
					// Validate the data structure
					if (!message.data.days || !Array.isArray(message.data.days)) {
						console.error(
							"[UsagePreview] Invalid data structure - missing or non-array days:",
							message.data,
						)
						setError("Invalid data format received")
					} else {
						console.log("[UsagePreview] Setting valid data with", message.data.days.length, "days")
						setData(message.data)
					}
				}
				setIsLoading(false)
			}
		}

		window.addEventListener("message", handleMessage)

		// Clean up listener after 10 seconds (timeout)
		const timeout = setTimeout(() => {
			if (isLoading) {
				setError("Failed to load usage data")
				setIsLoading(false)
			}
		}, 10000)

		return () => {
			clearTimeout(timeout)
			window.removeEventListener("message", handleMessage)
		}
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	const getBarHeight = (cost: number): number => {
		const maxCost = Math.max(...data.days.map((d) => d.cost))
		return Math.max(1, ~~(cost / maxCost) * 100) // Avoid NaN and enforce minimum 10% height for visibility
	}

	// Retry loading
	const handleRetry = () => {
		setError(null)
		setIsLoading(true)
		vscode.postMessage({ type: "getUsagePreview" })
	}

	// Loading state
	if (isLoading) {
		return (
			<div
				className="cursor-pointer group rounded-lg bg-vscode-editor-background hover:bg-vscode-list-hoverBackground transition-colors relative"
				onClick={onViewDetails}>
				<div className="p-4">
					{/* Loading spinner centered in chart area */}
					<div className="h-20 flex items-center justify-center mb-3">
						<VSCodeProgressRing className="size-6" />
					</div>
				</div>
			</div>
		)
	}

	// Error state
	if (error) {
		return (
			<div
				className="cursor-pointer group rounded-lg bg-vscode-editor-background hover:bg-vscode-list-hoverBackground transition-colors relative"
				onClick={handleRetry}>
				<div className="p-4">
					{/* Error message in chart area */}
					<div className="mb-3 text-vscode-descriptionForeground">
						<CircleAlert className="size-4 mb-2 text-vscode-muted-foreground" />
						<p className="text-xs font-mono font-bold">Couldn&apos;t load chart:</p>
						<p className="text-xs font-mono">{error}</p>
						<p className="text-xs font-medium mt-1">Click to retry</p>
					</div>
				</div>
			</div>
		)
	}

	// Use placeholder data if no real data available
	const displayData = data || {
		days: [
			{ date: "2025-09-17", taskCount: 2, tokenCount: 3200000, cost: 3.2 },
			{ date: "2025-09-18", taskCount: 1, tokenCount: 1600000, cost: 1.6 },
			{ date: "2025-09-19", taskCount: 1, tokenCount: 2400000, cost: 2.4 },
			{ date: "2025-09-20", taskCount: 0, tokenCount: 1200000, cost: 1.2 },
			{ date: "2025-09-21", taskCount: 3, tokenCount: 4000000, cost: 4.0 },
			{ date: "2025-09-22", taskCount: 1, tokenCount: 2800000, cost: 2.8 },
			{ date: "2025-09-23", taskCount: 1, tokenCount: 2000000, cost: 2.61 },
		],
		totals: {
			tasks: 9,
			tokens: 14800000,
			cost: 17.81,
		},
	}

	return (
		<div
			className="cursor-pointer group rounded-lg bg-vscode-editor-background hover:bg-vscode-list-hoverBackground transition-colors relative"
			onClick={onViewDetails}>
			<div className="p-4">
				{/* Chart with daily usage bars */}
				<div className="h-24 min-[450px]:h-40 rounded mb-3 flex items-end gap-1 pb-2">
					{displayData.days &&
						Array.isArray(displayData.days) &&
						displayData.days.map((day, index) => (
							<div key={index} className="w-full flex flex-col items-center justify-end h-full">
								<div
									className="w-full rounded-t-xs transition-all bg-vscode-button-background"
									style={{ height: `${getBarHeight(day.cost)}%` }}
								/>
								<span className="text-[9px] h-[1em] hidden min-[300px]:block overflow-clip text-center text-muted-foreground mt-0.5">
									{formatDateShort(new Date(day.date).getTime())}
								</span>
							</div>
						))}
				</div>

				{/* Stats text */}
				<div className="flex flex-col justify-between text-sm min-[450px]:flex-row min-[450px]:items-center">
					<span className="flex items-center gap-1 text-vscode-descriptionForeground">
						{t("cloud:usageStats.pastDays", { count: displayData.days.length })}
					</span>
					<span className="text-vscode-foreground">
						{displayData.totals.tasks} tasks · {formatTokenCount(displayData.totals.tokens)} tokens ·{" "}
						{formatCost(displayData.totals.cost)}
					</span>
				</div>
			</div>

			{/* Hover overlay */}
			<div className="absolute inset-0 bg-vscode-editor-background/95 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
				<div className="flex items-center gap-2 text-vscode-foreground">
					<span>{t("cloud:usageStats.seeMoreStats")}</span>
					<SquareArrowOutUpRight className="w-4 h-4" />
				</div>
			</div>
		</div>
	)
}
