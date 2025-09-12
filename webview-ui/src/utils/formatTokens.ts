/**
 * Format token count for display
 * @param count - The token count to format
 * @returns Formatted string (e.g., "1.2k" for 1200)
 */
export function formatTokenCount(count: number | undefined): string {
	if (count === undefined || count === 0) {
		return "0"
	}

	if (count < 1000) {
		return count.toString()
	}

	// Format as k (thousands) with one decimal place
	const thousands = count / 1000
	if (thousands < 10) {
		// For values less than 10k, show one decimal place
		return `${thousands.toFixed(1)}k`
	} else {
		// For values 10k and above, show no decimal places
		return `${Math.round(thousands)}k`
	}
}

/**
 * Format token statistics for display
 * @param tokensIn - Input tokens
 * @param tokensOut - Output tokens
 * @param cacheReads - Cache read tokens (optional)
 * @param cacheLabel - Localized cache label
 * @returns { { input: string; output: string } } An object with formatted input and output token strings.
 */
export function formatTokenStats(
	tokensIn?: number,
	tokensOut?: number,
	cacheReads?: number,
	cacheLabel: string = "cache",
): { input: string; output: string } {
	let inputDisplay = formatTokenCount(tokensIn)

	// Add cache reads in parentheses if they exist
	if (cacheReads && cacheReads > 0) {
		const cacheDisplay = formatTokenCount(cacheReads)
		inputDisplay = `${inputDisplay} (${cacheDisplay} ${cacheLabel})`
	}

	const outputDisplay = formatTokenCount(tokensOut)

	return {
		input: inputDisplay,
		output: outputDisplay,
	}
}
