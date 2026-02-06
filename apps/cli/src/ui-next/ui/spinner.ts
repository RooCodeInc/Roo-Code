/**
 * Spinner animation frames for loading indicators.
 */

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function getSpinnerFrame(tick: number): string {
	return SPINNER_FRAMES[tick % SPINNER_FRAMES.length]!
}
