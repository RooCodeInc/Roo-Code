import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

interface SandboxFallbackWarningProps {
	message?: string
}

export const SandboxFallbackWarning = ({ message }: SandboxFallbackWarningProps) => {
	const { t } = useTranslation()

	const onClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
		e.preventDefault()
		window.postMessage({ type: "action", action: "settingsButtonClicked", values: { section: "rpiConfig" } }, "*")
	}, [])

	return (
		<div className="text-sm bg-vscode-editor-background border border-vscode-border rounded-lg p-3 ml-6">
			<div className="flex flex-col gap-2">
				<div className="flex items-center">
					<i className="codicon codicon-warning mr-1 text-vscode-editorWarning-foreground" />
					<span className="text-vscode-editorWarning-foreground font-semibold">
						{t("chat:sandbox.fallbackTitle")}
					</span>
				</div>
				<div>{t("chat:sandbox.fallbackDescription")}</div>
				{message && <div className="text-vscode-descriptionForeground italic">{message}</div>}
				<VSCodeLink href="#" onClick={onClick} className="inline">
					{t("chat:sandbox.openSettings")}
				</VSCodeLink>
			</div>
		</div>
	)
}
