import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { RateLimitRetryMetadata } from "@roo-code/types"
import { ProgressIndicator } from "./ProgressIndicator"

export interface RateLimitRetryRowProps {
	metadata?: RateLimitRetryMetadata
}

export const RateLimitRetryRow = ({ metadata }: RateLimitRetryRowProps) => {
	const { t } = useTranslation()

	const description = useMemo(() => {
		if (!metadata) {
			return ""
		}

		if (metadata.status === "retrying") {
			return t("chat:rateLimitRetry.retrying")
		}

		if (metadata.status === "cancelled") {
			return t("chat:rateLimitRetry.cancelled")
		}

		if (typeof metadata.remainingSeconds === "number") {
			if (metadata.attempt && metadata.maxAttempts) {
				return t("chat:rateLimitRetry.waitingWithAttemptMax", {
					seconds: metadata.remainingSeconds,
					attempt: metadata.attempt,
					maxAttempts: metadata.maxAttempts,
				})
			}

			if (metadata.attempt) {
				return t("chat:rateLimitRetry.waitingWithAttempt", {
					seconds: metadata.remainingSeconds,
					attempt: metadata.attempt,
				})
			}

			return t("chat:rateLimitRetry.waiting", { seconds: metadata.remainingSeconds })
		}

		return ""
	}, [metadata, t])

	const detail = metadata?.detail
	const iconNode =
		metadata?.status === "cancelled" ? (
			<span className="codicon codicon-circle-slash text-vscode-descriptionForeground" aria-hidden="true"></span>
		) : (
			<ProgressIndicator />
		)

	return (
		<div role="status" aria-live="polite" className="mt-1">
			<div className="flex items-start gap-3 rounded-md border border-vscode-editorGroup-border/60 bg-vscode-editor-background px-4 py-3">
				<div className="mt-0.5">{iconNode}</div>
				<div className="flex flex-col gap-1 text-sm leading-5">
					<span className="font-semibold text-vscode-foreground">{t("chat:rateLimitRetry.title")}</span>
					{(description || detail) && (
						<span className="text-vscode-descriptionForeground">
							{description}
							{detail ? (
								<>
									{" — "}
									{detail}
								</>
							) : null}
						</span>
					)}
				</div>
			</div>
		</div>
	)
}
