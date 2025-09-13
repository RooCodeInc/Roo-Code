import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ProgressIndicator } from "./ProgressIndicator"

interface RateLimitCountdownProps {
	message: string
	isRetrying?: boolean
}

export const RateLimitCountdown: React.FC<RateLimitCountdownProps> = ({ message, isRetrying = false }) => {
	const { t } = useTranslation()

	// Parse the message to extract countdown seconds and retry attempt info
	const { seconds, attemptInfo } = useMemo(() => {
		// Match patterns like "Retrying in X seconds" or "Rate limiting for X seconds"
		const secondsMatch = message.match(/(\d+)\s+second/i)
		const seconds = secondsMatch ? parseInt(secondsMatch[1], 10) : null

		// Match retry attempt pattern like "Retry attempt X"
		const attemptMatch = message.match(/Retry attempt (\d+)/i)
		const attemptInfo = attemptMatch ? attemptMatch[0] : null

		return { seconds, attemptInfo }
	}, [message])

	// Check if this is the "Retrying now..." message
	const isRetryingNow = message.toLowerCase().includes("retrying now")

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "12px",
				padding: "12px 16px",
				backgroundColor: "var(--vscode-editor-background)",
				border: "1px solid var(--vscode-editorWidget-border)",
				borderRadius: "4px",
				marginBottom: "8px",
			}}>
			{/* Header with spinner and title */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "10px",
					color: "var(--vscode-foreground)",
				}}>
				<ProgressIndicator />
				<span style={{ fontWeight: "bold", fontSize: "var(--vscode-font-size)" }}>
					{isRetrying || attemptInfo ? t("chat:rateLimitRetry.title") : t("chat:rateLimit.title")}
				</span>
			</div>

			{/* Status message */}
			<div
				style={{
					color: "var(--vscode-descriptionForeground)",
					fontSize: "var(--vscode-font-size)",
					lineHeight: "1.5",
				}}>
				{isRetryingNow ? (
					<span>{t("chat:rateLimit.retryingNow")}</span>
				) : seconds !== null ? (
					<div>
						{attemptInfo && (
							<div style={{ marginBottom: "4px" }}>
								<span style={{ color: "var(--vscode-foreground)" }}>{attemptInfo}</span>
							</div>
						)}
						<span>{t("chat:rateLimit.retryingIn", { seconds })}</span>
					</div>
				) : (
					<span>{t("chat:rateLimit.pleaseWait")}</span>
				)}
			</div>

			{/* Optional error details if present in the message */}
			{message.includes("\n\n") && !isRetryingNow && (
				<details
					style={{
						marginTop: "4px",
						cursor: "pointer",
					}}>
					<summary
						style={{
							color: "var(--vscode-textLink-foreground)",
							fontSize: "calc(var(--vscode-font-size) - 1px)",
							userSelect: "none",
						}}>
						{t("chat:rateLimit.showDetails")}
					</summary>
					<pre
						style={{
							marginTop: "8px",
							padding: "8px",
							backgroundColor: "var(--vscode-textCodeBlock-background)",
							borderRadius: "4px",
							fontSize: "calc(var(--vscode-font-size) - 1px)",
							color: "var(--vscode-descriptionForeground)",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							overflowWrap: "anywhere",
							maxHeight: "200px",
							overflowY: "auto",
						}}>
						{message.split("\n\n")[0]}
					</pre>
				</details>
			)}
		</div>
	)
}
