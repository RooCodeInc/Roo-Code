import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { useFirmwareQuota } from "@/components/ui/hooks/useFirmwareQuota"

const formatTimeUntilReset = (ms: number): string => {
	if (ms <= 0) return "resetting..."
	const hours = Math.floor(ms / (1000 * 60 * 60))
	const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
	if (hours > 0) return `${hours}h ${minutes}m`
	return `${minutes}m`
}

export const FirmwareQuotaDisplay = () => {
	const { data: quota } = useFirmwareQuota()

	if (!quota) {
		return null
	}

	const percentUsed = (quota.used * 100).toFixed(2)

	// Calculate reset time only if reset is provided
	let resetText = ""
	if (quota.reset) {
		const resetDate = new Date(quota.reset)
		const now = new Date()
		const msUntilReset = resetDate.getTime() - now.getTime()
		resetText = ` · resets in ${formatTimeUntilReset(msUntilReset)}`
	}

	const isAtLimit = quota.used >= 1
	const isWarning = quota.used >= 0.8

	const statusText = isAtLimit ? `Limit reached${resetText}` : `${percentUsed}% used${resetText}`

	const colorClass = isAtLimit
		? "text-vscode-errorForeground"
		: isWarning
			? "text-vscode-editorWarning-foreground"
			: "text-vscode-foreground"

	return (
		<VSCodeLink
			href="https://app.firmware.ai/billing"
			className={`${colorClass} hover:underline whitespace-nowrap`}>
			{statusText}
		</VSCodeLink>
	)
}
