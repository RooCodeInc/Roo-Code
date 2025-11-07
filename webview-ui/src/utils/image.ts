/**
 * Utilities for image handling in webview.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/**
 * Estimate raw bytes from a base64 data URL. Returns 0 for invalid input.
 */
export function estimateBytesFromBase64DataUrl(dataUrl: string): number {
	if (typeof dataUrl !== "string") return 0
	const idx = dataUrl.indexOf(",")
	if (idx === -1) return 0
	const base64 = dataUrl.slice(idx + 1).replace(/=+$/, "")
	// 4 base64 chars represent 3 bytes
	return Math.floor((base64.length * 3) / 4)
}
