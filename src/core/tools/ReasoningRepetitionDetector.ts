/**
 * Detects repetitive patterns in model reasoning/thinking output during streaming.
 *
 * Some models (particularly Gemini) can get stuck in a loop where their
 * thinking/reasoning output repeats the same lines over and over, e.g.:
 *   "I'll mention that I verified with tests."
 *   "I'll mention that I reverted the tests."
 *   "I'll mention that I verified with tests."
 *   "I'll mention that I reverted the tests."
 *   ...
 *
 * This detector tracks lines as they stream in and flags when any single
 * line has been repeated more than the configured threshold.
 */
export class ReasoningRepetitionDetector {
	private lineCounts: Map<string, number> = new Map()
	private buffer: string = ""
	private readonly repetitionThreshold: number
	private readonly minLineLength: number

	/**
	 * @param repetitionThreshold Number of times a line must repeat to be considered a loop (default: 5)
	 * @param minLineLength Minimum line length to track - short lines are ignored (default: 20)
	 */
	constructor(repetitionThreshold: number = 5, minLineLength: number = 20) {
		this.repetitionThreshold = repetitionThreshold
		this.minLineLength = minLineLength
	}

	/**
	 * Feed a new chunk of reasoning text and check for repetition.
	 *
	 * @param chunk A new piece of reasoning/thinking text from the stream
	 * @returns true if repetitive looping has been detected
	 */
	public addChunk(chunk: string): boolean {
		this.buffer += chunk

		// Split buffer into complete lines (keeping incomplete last line in buffer)
		const lines = this.buffer.split("\n")

		// Keep the last element as the buffer (it may be an incomplete line)
		this.buffer = lines.pop() ?? ""

		for (const rawLine of lines) {
			const line = this.normalizeLine(rawLine)

			if (line.length < this.minLineLength) {
				continue
			}

			const count = (this.lineCounts.get(line) ?? 0) + 1
			this.lineCounts.set(line, count)

			if (count >= this.repetitionThreshold) {
				return true
			}
		}

		return false
	}

	/**
	 * Check if any line in the accumulated reasoning has hit the repetition threshold.
	 * Useful for checking after a stream is complete but before tool processing.
	 */
	public isRepetitive(): boolean {
		// Also process any remaining buffer content
		if (this.buffer.length > 0) {
			const line = this.normalizeLine(this.buffer)
			if (line.length >= this.minLineLength) {
				const count = (this.lineCounts.get(line) ?? 0) + 1
				this.lineCounts.set(line, count)
				if (count >= this.repetitionThreshold) {
					return true
				}
			}
		}

		for (const count of this.lineCounts.values()) {
			if (count >= this.repetitionThreshold) {
				return true
			}
		}

		return false
	}

	/**
	 * Get the most repeated line and its count, useful for diagnostics.
	 */
	public getMostRepeatedLine(): { line: string; count: number } | undefined {
		let maxLine: string | undefined
		let maxCount = 0

		for (const [line, count] of this.lineCounts.entries()) {
			if (count > maxCount) {
				maxCount = count
				maxLine = line
			}
		}

		if (maxLine !== undefined) {
			return { line: maxLine, count: maxCount }
		}

		return undefined
	}

	/**
	 * Reset the detector state. Called at the start of each new API request.
	 */
	public reset(): void {
		this.lineCounts.clear()
		this.buffer = ""
	}

	/**
	 * Normalize a line for comparison: trim whitespace, collapse internal
	 * whitespace, and lowercase.
	 */
	private normalizeLine(line: string): string {
		return line.trim().replace(/\s+/g, " ").toLowerCase()
	}
}
