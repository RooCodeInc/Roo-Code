const formatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
})

export const formatCurrency = (amount: number) => formatter.format(amount)

export const formatDuration = (durationMs: number) => {
	const seconds = Math.floor(durationMs / 1000)
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	const remainingSeconds = seconds % 60

	// Format as H:MM:SS
	const mm = minutes.toString().padStart(2, "0")
	const ss = remainingSeconds.toString().padStart(2, "0")
	return `${hours}:${mm}:${ss}`
}

export const formatTokens = (tokens: number) => {
	if (tokens < 1000) {
		return tokens.toString()
	}

	if (tokens < 1000000) {
		// No decimal for thousands (e.g., 72k not 72.5k)
		return `${Math.round(tokens / 1000)}k`
	}

	if (tokens < 1000000000) {
		// Keep decimal for millions (e.g., 3.2M)
		return `${(tokens / 1000000).toFixed(1)}M`
	}

	return `${(tokens / 1000000000).toFixed(1)}B`
}

export const formatToolUsageSuccessRate = (usage: { attempts: number; failures: number }) =>
	usage.attempts === 0 ? "0%" : `${Math.round(((usage.attempts - usage.failures) / usage.attempts) * 100)}%`

export const formatDateTime = (date: Date) => {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(date)
}
