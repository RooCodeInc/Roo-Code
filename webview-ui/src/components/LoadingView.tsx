import React, { useEffect, useState, useCallback } from "react"
import { useAppTranslation } from "../i18n/TranslationContext"
import { vscode } from "../utils/vscode"

const RETRY_INTERVAL_MS = 5_000
const MAX_RETRIES = 3

/**
 * LoadingView is displayed while the webview waits for the extension host to
 * send the initial state hydration message.  It replaces the previous
 * `return null` which left users staring at a blank grey panel (see #11931).
 *
 * If the state message does not arrive within {@link RETRY_INTERVAL_MS} the
 * component automatically re-sends the `webviewDidLaunch` message up to
 * {@link MAX_RETRIES} times, after which a manual "Retry" button is shown.
 */
export default function LoadingView() {
	const { t } = useAppTranslation()
	const [retryCount, setRetryCount] = useState(0)
	const [showRetryButton, setShowRetryButton] = useState(false)

	const retry = useCallback(() => {
		vscode.postMessage({ type: "webviewDidLaunch" })
		setRetryCount((prev) => prev + 1)
	}, [])

	// Automatic retries on a timer
	useEffect(() => {
		if (showRetryButton) {
			return // Stop auto-retrying once we're showing the manual button.
		}

		const timer = setTimeout(() => {
			if (retryCount < MAX_RETRIES) {
				retry()
			} else {
				setShowRetryButton(true)
			}
		}, RETRY_INTERVAL_MS)

		return () => clearTimeout(timer)
	}, [retryCount, showRetryButton, retry])

	return (
		<div className="absolute inset-0 flex flex-col bg-vscode-editor-background text-vscode-foreground">
			<div className="flex-1 flex items-center justify-center px-6">
				<div className="flex flex-col items-center gap-5 text-center">
					{!showRetryButton ? (
						<div className="flex items-center gap-2 text-sm text-vscode-descriptionForeground">
							<span className="codicon codicon-loading codicon-modifier-spin text-base" />
							<span>{t("common:ui.initializing")}</span>
						</div>
					) : (
						<div className="flex flex-col items-center gap-3">
							<p className="text-sm text-vscode-descriptionForeground">
								{t("common:ui.connection_failed")}
							</p>
							<button
								className="px-4 py-1.5 rounded text-sm font-medium bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground"
								onClick={() => {
									setRetryCount(0)
									setShowRetryButton(false)
									retry()
								}}>
								{t("common:ui.retry_connection")}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
