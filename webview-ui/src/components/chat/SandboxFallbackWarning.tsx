import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Container, AlertTriangle } from "lucide-react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

const DOCKER_BLUE = "#0DB7ED"

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
		<div
			className="text-sm rounded-lg p-3 ml-6"
			style={{
				backgroundColor: "color-mix(in srgb, #0DB7ED 8%, var(--vscode-editor-background))",
				border: `1px solid color-mix(in srgb, #0DB7ED 30%, transparent)`,
			}}>
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-2">
					<Container className="w-4 h-4 flex-shrink-0" style={{ color: DOCKER_BLUE }} />
					<AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-vscode-editorWarning-foreground" />
					<span className="font-semibold" style={{ color: DOCKER_BLUE }}>
						{t("chat:sandbox.fallbackTitle")}
					</span>
				</div>
				<div
					className="ml-6 pl-2 pb-1"
					style={{ borderLeft: `2px solid color-mix(in srgb, #0DB7ED 40%, transparent)` }}>
					<div className="text-vscode-foreground">{t("chat:sandbox.fallbackDescription")}</div>
					{message && <div className="text-vscode-descriptionForeground italic mt-1 text-xs">{message}</div>}
				</div>
				<div className="ml-6 pl-2">
					<VSCodeLink href="#" onClick={onClick} className="inline">
						{t("chat:sandbox.openSettings")}
					</VSCodeLink>
				</div>
			</div>
		</div>
	)
}
