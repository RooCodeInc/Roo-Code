import type { ClineMessage } from "@roo-code/types"

/**
 * Walk a message array and batch runs of consecutive messages that match
 * `predicate` into synthetic messages produced by `synthesize`.
 *
 * - Runs of length 1 are passed through unchanged.
 * - Runs of length >= 2 are replaced by a single synthetic message.
 * - Non-matching messages are preserved in-order.
 */
export function batchConsecutive(
	messages: ClineMessage[],
	predicate: (msg: ClineMessage) => boolean,
	synthesize: (batch: ClineMessage[]) => ClineMessage,
): ClineMessage[] {
	const result: ClineMessage[] = []
	let i = 0

	while (i < messages.length) {
		if (predicate(messages[i])) {
			// Collect consecutive matches into a batch
			const batch: ClineMessage[] = [messages[i]]
			let j = i + 1

			while (j < messages.length && predicate(messages[j])) {
				batch.push(messages[j])
				j++
			}

			if (batch.length > 1) {
				result.push(synthesize(batch))
			} else {
				result.push(batch[0])
			}

			i = j
		} else {
			result.push(messages[i])
			i++
		}
	}

	return result
}
