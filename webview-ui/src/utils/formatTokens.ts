import { formatLargeNumber } from "./format"

/**
 * Format token count for display
 * @param count - The token count to format
 * @returns Formatted string (e.g., "1.2k" for 1200)
 */
export function formatTokenCount(count: number | undefined): string {
	if (count === undefined || count === 0) {
		return "0"
	}
	return formatLargeNumber(count)
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
