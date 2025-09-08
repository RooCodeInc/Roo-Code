import { useState, useCallback } from "react"
import { TelemetryEventName } from "@roo-code/types"
import { vscode } from "@/utils/vscode"
import { telemetryClient } from "@/utils/TelemetryClient"

export const useCloudUpsell = () => {
	const [isOpen, setIsOpen] = useState(false)

	const openUpsell = useCallback(() => {
		setIsOpen(true)
	}, [])

	const closeUpsell = useCallback(() => {
		setIsOpen(false)
	}, [])

	const handleConnect = useCallback(() => {
		// Send telemetry for connect to cloud action
		telemetryClient.capture(TelemetryEventName.SHARE_CONNECT_TO_CLOUD_CLICKED)

		// Send message to VS Code to initiate sign in
		vscode.postMessage({ type: "rooCloudSignIn" })

		// Close the upsell dialog
		closeUpsell()
	}, [closeUpsell])

	return {
		isOpen,
		openUpsell,
		closeUpsell,
		handleConnect,
	}
}
