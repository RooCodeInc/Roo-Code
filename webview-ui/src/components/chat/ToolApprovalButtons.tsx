import React, { useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Check, X } from "lucide-react"
import { vscode } from "@src/utils/vscode"

interface ToolApprovalButtonsProps {
	messageTs: number
	isProtected?: boolean
	disabled?: boolean
	onResponse?: () => void
}

export const ToolApprovalButtons: React.FC<ToolApprovalButtonsProps> = ({
	messageTs: _messageTs, // Prefixed with _ to indicate intentionally unused
	isProtected = false,
	disabled = false,
	onResponse,
}) => {
	const [hasResponded, setHasResponded] = useState(false)

	const handleApprove = () => {
		if (hasResponded) return
		setHasResponded(true)
		vscode.postMessage({
			type: "askResponse",
			askResponse: "yesButtonClicked",
		})
		onResponse?.()
	}

	const handleReject = () => {
		if (hasResponded) return
		setHasResponded(true)
		vscode.postMessage({
			type: "askResponse",
			askResponse: "noButtonClicked",
		})
		onResponse?.()
	}

	if (hasResponded) {
		return null // Hide buttons after response
	}

	return (
		<div className="flex gap-2 mt-3 ml-6">
			<VSCodeButton
				appearance="primary"
				onClick={handleApprove}
				disabled={disabled}
				style={{ display: "flex", alignItems: "center", gap: "4px" }}>
				<Check className="w-4 h-4" />
				{isProtected ? "Approve (Protected File)" : "Approve"}
			</VSCodeButton>
			<VSCodeButton
				appearance="secondary"
				onClick={handleReject}
				disabled={disabled}
				style={{ display: "flex", alignItems: "center", gap: "4px" }}>
				<X className="w-4 h-4" />
				Reject
			</VSCodeButton>
		</div>
	)
}
