import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { t } from "i18next"
import { useMemo } from "react"

interface CheckpointWarningProps {
	text?: string
}

export const CheckpointWarning = ({ text }: CheckpointWarningProps) => {
	const warnText = useMemo(() => {
		return text || t("chat:checkpoint.initializingWarning")
	}, [text])

	const settingsLink = (
		<VSCodeLink
			href="#"
			onClick={(e) => {
				e.preventDefault()
				window.postMessage(
					{
						type: "action",
						action: "settingsButtonClicked",
						values: { section: "checkpoints" },
					},
					"*",
				)
			}}
			className="inline px-0.5">
			{warnText}
		</VSCodeLink>
	)

	return (
		<div className="flex items-center p-3 my-3 bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder rounded">
			<span className="codicon codicon-loading codicon-modifier-spin mr-2" />
			<span className="text-vscode-foreground">{settingsLink}</span>
		</div>
	)
}
