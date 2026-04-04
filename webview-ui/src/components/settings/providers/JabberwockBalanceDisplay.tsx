import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { useJabberwockCreditBalance } from "@/components/ui/hooks/useJabberwockCreditBalance"
import { useExtensionState } from "@src/context/ExtensionStateContext"

export const JabberwockBalanceDisplay = () => {
	const { data: balance } = useJabberwockCreditBalance()
	const { cloudApiUrl } = useExtensionState()

	if (balance === null || balance === undefined) {
		return null
	}

	const formattedBalance = balance.toFixed(2)
	const billingUrl = cloudApiUrl ? `${cloudApiUrl.replace(/\/$/, "")}/billing` : "https://app.jabberwock.com/billing"

	return (
		<VSCodeLink href={billingUrl} className="text-vscode-foreground hover:underline whitespace-nowrap">
			${formattedBalance}
		</VSCodeLink>
	)
}
