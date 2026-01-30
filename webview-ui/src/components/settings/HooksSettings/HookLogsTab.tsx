import React from "react"
import { FileText } from "lucide-react"

interface HookLogsTabProps {
	hookId: string
}

/**
 * Placeholder component for the Logs tab.
 * In a full implementation, this would display logs from hook execution.
 */
export const HookLogsTab: React.FC<HookLogsTabProps> = ({ hookId }) => {
	return (
		<div className="flex flex-col items-center justify-center py-8 text-center">
			<FileText className="w-8 h-8 text-vscode-descriptionForeground mb-3" />
			<p className="text-sm text-vscode-descriptionForeground">
				Logs will be displayed here during hook execution.
			</p>
			<p className="text-xs text-vscode-descriptionForeground mt-2">
				Hook ID: <code className="bg-vscode-input-background px-1 rounded">{hookId}</code>
			</p>
		</div>
	)
}
