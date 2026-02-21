import { Loader2 } from "lucide-react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { calculateTokenDistribution } from "../../utils/model-utils"

interface ContextUsageIndicatorProps {
	contextTokens: number
	contextWindow: number
	onCondense: () => void
	isCondensing: boolean
	disabled: boolean
	taskId?: string
}

const ContextUsageIndicator = memo<ContextUsageIndicatorProps>(
	({ contextTokens, contextWindow, onCondense, isCondensing, disabled, taskId }) => {
		const { t } = useTranslation()

		// Match backend auto-condense logic: use effective input-window percentage
		const { effectivePercent } = calculateTokenDistribution(contextWindow, contextTokens)
		const percentage = Math.round(effectivePercent)

		// Determine color based on usage
		const getColorClass = (percent: number) => {
			if (percent < 70) return "context-usage-low"
			if (percent < 85) return "context-usage-medium"
			if (percent < 95) return "context-usage-high"
			return "context-usage-critical"
		}

		const colorClass = getColorClass(percentage)

		// Format display text
		const displayText = `${percentage}%`
		const detailText = `${contextTokens.toLocaleString()} / ${contextWindow.toLocaleString()}`

		const handleClick = () => {
			if (!disabled && !isCondensing && taskId) {
				onCondense()
			}
		}

		return (
			<div className="context-usage-indicator">
				<button
					onClick={handleClick}
					disabled={disabled || isCondensing || !taskId}
					title={
						taskId
							? `${t("chat:task.contextUsage")}: ${detailText}\n${t("chat:task.clickToCondense")}`
							: `${t("chat:task.contextUsage")}: ${detailText}`
					}
					className={`context-usage-button ${colorClass}`}>
					{isCondensing ? (
						<>
							<Loader2 className="context-usage-spinner" size={14} />
							<span>{t("chat:task.condensing")}</span>
						</>
					) : (
						<>
							<svg className="context-usage-circle" viewBox="0 0 20 20">
								<circle className="context-usage-circle-bg" cx="10" cy="10" r="8.5" />
								<circle
									className="context-usage-circle-progress"
									cx="10"
									cy="10"
									r="8.5"
									strokeDasharray={`${2 * Math.PI * 8.5}`}
									strokeDashoffset={`${2 * Math.PI * 8.5 * (1 - Math.min(percentage, 100) / 100)}`}
								/>
							</svg>
							<span className="context-usage-text">{displayText}</span>
						</>
					)}
				</button>
			</div>
		)
	},
)

ContextUsageIndicator.displayName = "ContextUsageIndicator"

export default ContextUsageIndicator
