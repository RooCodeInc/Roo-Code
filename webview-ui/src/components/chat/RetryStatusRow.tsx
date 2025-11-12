import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { RetryStatusMetadata } from "@roo-code/types"
import { ProgressIndicator } from "./ProgressIndicator"

export interface RetryStatusRowProps {
	metadata?: RetryStatusMetadata
}

export const RetryStatusRow = ({ metadata }: RetryStatusRowProps) => {
	const { t } = useTranslation()

	const title = useMemo(() => {
		if (!metadata) {
			return ""
		}

		const isRateLimit = metadata.cause === "rate_limit"

		if (isRateLimit) {
			// For rate limit, show "Rate limit set for Xs"
			return t("chat:retryStatus.rateLimit.title", {
				rateLimitSeconds: metadata.rateLimitSeconds || 30, // fallback to 30 if not provided
			})
		} else {
			// For backoff/retry, show the error message if available
			return metadata.detail || t("chat:retryStatus.backoff.title")
		}
	}, [metadata, t])

	const subtitle = useMemo(() => {
		if (!metadata) {
			// Default to backoff waiting when no metadata is provided
			return t("chat:retryStatus.backoff.waiting")
		}

		const isRateLimit = metadata.cause === "rate_limit"

		if (metadata.status === "retrying") {
			return isRateLimit ? t("chat:retryStatus.rateLimit.proceeding") : t("chat:retryStatus.backoff.retrying")
		}

		if (metadata.status === "cancelled") {
			return isRateLimit ? t("chat:retryStatus.rateLimit.cancelled") : t("chat:retryStatus.backoff.cancelled")
		}

		if (typeof metadata.remainingSeconds === "number") {
			if (isRateLimit) {
				// Rate limit: always use simple waiting message (no attempt numbers)
				return t("chat:retryStatus.rateLimit.waiting", { seconds: metadata.remainingSeconds })
			} else {
				// Retry: "Trying in 22s (attempt #2)"
				const baseKey = "chat:retryStatus.backoff"

				if (metadata.attempt && metadata.maxAttempts) {
					return t(`${baseKey}.waitingWithAttemptMax`, {
						seconds: metadata.remainingSeconds,
						attempt: metadata.attempt,
						maxAttempts: metadata.maxAttempts,
					})
				}

				if (metadata.attempt) {
					return t(`${baseKey}.waitingWithAttempt`, {
						seconds: metadata.remainingSeconds,
						attempt: metadata.attempt,
					})
				}

				return t(`${baseKey}.waiting`, { seconds: metadata.remainingSeconds })
			}
		}

		return ""
	}, [metadata, t])

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
					<span className="font-semibold text-vscode-foreground">{title}</span>
					{subtitle && <span className="text-vscode-descriptionForeground">{subtitle}</span>}
				</div>
			</div>
		</div>
	)
}
