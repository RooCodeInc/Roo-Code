import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { useFirmwareQuota } from "@/components/ui/hooks/useFirmwareQuota"

export const FirmwareQuotaDisplay = () => {
	const { data: quota } = useFirmwareQuota()

	if (quota === null || quota === undefined) {
		return null
	}

	const formattedRemaining = quota.remaining.toFixed(2)
	const billingUrl = "https://app.firmware.ai/billing"

	return (
		<VSCodeLink href={billingUrl} className="text-vscode-foreground hover:underline whitespace-nowrap">
			${formattedRemaining} remaining
		</VSCodeLink>
	)
}
