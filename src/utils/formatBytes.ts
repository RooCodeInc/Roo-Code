/**
 * Formats bytes into a human-readable string with appropriate units.
 *
 * Note: This is intentionally simple (base-2 / 1024) and consistent with existing
 * formatting expectations in tests and UI.
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B"

	const units = ["B", "KB", "MB", "GB", "TB"]
	const k = 1024
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
	const size = bytes / Math.pow(k, i)

	// Use 2 decimal places for MB and above, 0 for B and KB
	const decimals = i >= 2 ? 2 : 0
	return `${size.toFixed(decimals)} ${units[i]}`
}
