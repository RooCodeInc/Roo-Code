import { memo } from "react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"

const EnhancedLoggingBanner = () => {
	const { t } = useAppTranslation()
	const { enhancedLoggingEnabled, setEnhancedLoggingEnabled } = useExtensionState()

	const handleDisable = () => {
		setEnhancedLoggingEnabled(false)
		vscode.postMessage({ type: "enhancedLoggingEnabled", bool: false })
	}

	const handleOpenSettings = () => {
		window.postMessage({
			type: "action",
			action: "settingsButtonClicked",
			values: { section: "about" },
		})
	}

	if (!enhancedLoggingEnabled) {
		return null
	}

	return (
		<div className="relative px-4 py-2.5 pr-10 bg-yellow-500/20 border-b border-yellow-500/30 text-sm leading-normal text-vscode-foreground">
			{/* Close button (X) */}
			<button
				onClick={handleDisable}
				className="absolute top-1.5 right-2 bg-transparent border-none text-vscode-foreground cursor-pointer text-2xl p-1 opacity-70 hover:opacity-100 transition-opacity duration-200 leading-none"
				aria-label="Disable enhanced logging">
				×
			</button>

			<div className="mb-0.5 font-bold flex items-center gap-2">
				<span className="text-yellow-600">⚠️</span>
				{t("settings:about.enhancedLogging.bannerTitle")}
			</div>
			<div>
				{t("settings:about.enhancedLogging.bannerMessage")}{" "}
				<VSCodeLink href="#" onClick={handleOpenSettings}>
					{t("settings:about.enhancedLogging.bannerSettings")}
				</VSCodeLink>
			</div>
		</div>
	)
}

export default memo(EnhancedLoggingBanner)
