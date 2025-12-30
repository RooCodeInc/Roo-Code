import React, { memo } from "react"
import { useTranslation } from "react-i18next"
import { Timer } from "lucide-react"

export interface RateLimitCountdownProps {
	seconds: number
}

/**
 * Displays a user-configured rate limiting countdown as an informational message.
 * This is NOT an error state - it's expected behavior based on user settings.
 *
 * Uses neutral/informational styling instead of error styling.
 */
export const RateLimitCountdown = memo(({ seconds }: RateLimitCountdownProps) => {
	const { t } = useTranslation()

	return (
		<div className="flex items-center gap-2 text-vscode-descriptionForeground">
			<Timer className="size-4 shrink-0" strokeWidth={1.5} />
			<span className="text-sm">
				{t("chat:rateLimit.countdown", { seconds, defaultValue: `Rate limiting: ${seconds}s` })}
			</span>
		</div>
	)
})

RateLimitCountdown.displayName = "RateLimitCountdown"

export default RateLimitCountdown
