import { Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useMemo } from "react"

interface CheckpointWarningProps {
	text?: string
}

export const CheckpointWarning = ({ text }: CheckpointWarningProps) => {
	const warningText = useMemo(() => {
		return text || "chat:checkpoint.initializingWarning"
	}, [text])
	return (
		<div className="flex items-center p-3 my-3 bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder rounded">
			<span className="codicon codicon-loading codicon-modifier-spin mr-2" />
			<span className="text-vscode-foreground">
				<Trans
					i18nKey={warningText}
					components={{
						settingsLink: (
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
								className="inline px-0.5"
							/>
						),
					}}
				/>
			</span>
		</div>
	)
}
