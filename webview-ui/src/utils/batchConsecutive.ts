/**
 * Walk an item array and batch runs of consecutive items that match
 * `predicate` into synthetic items produced by `synthesize`.
 *
 * - Runs of length 1 are passed through unchanged.
 * - Runs of length >= 2 are replaced by a single synthetic item.
 * - Non-matching items are preserved in-order.
 */
export function batchConsecutive<T>(items: T[], predicate: (item: T) => boolean, synthesize: (batch: T[]) => T): T[] {
	const result: T[] = []
	let i = 0

	while (i < items.length) {
		if (predicate(items[i])) {
			// Collect consecutive matches into a batch
			const batch: T[] = [items[i]]
			let j = i + 1

			while (j < items.length && predicate(items[j])) {
				batch.push(items[j])
				j++
			}

			if (batch.length > 1) {
				result.push(synthesize(batch))
			} else {
				result.push(batch[0])
			}

			i = j
		} else {
			result.push(items[i])
			i++
		}
	}

	return result
}
