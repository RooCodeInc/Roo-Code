const readyCollections = new Map<string, boolean>()

/**
 * Tracks ensure-once readiness per (collection, dimension) pair.
 *
 * Note: This utility does not dedupe in-flight ensure calls; callers should
 * avoid issuing concurrent ensures for the same key.
 */
export class CollectionManager {
	/**
	 * Builds a stable key for a (collection, dimension) pair.
	 */
	static key(name: string, dimension: number): string {
		return `${name}:${dimension}`
	}

	/**
	 * Returns true if ensure has already succeeded for this key in the current process.
	 */
	static isReady(name: string, dimension: number): boolean {
		return readyCollections.get(this.key(name, dimension)) === true
	}

	/** Marks a collection as ready for the given dimension. */
	static markReady(name: string, dimension: number): void {
		readyCollections.set(this.key(name, dimension), true)
	}

	/**
	 * Calls the provided ensure function at most once per key.
	 * @returns true if the underlying ensure created/recreated the collection, false if it was already compatible.
	 */
	static async ensureOnce(
		ensureFn: (name: string, dimension: number) => Promise<boolean>,
		name: string,
		dimension: number,
	): Promise<boolean> {
		if (this.isReady(name, dimension)) return false
		const created = await ensureFn(name, dimension)
		this.markReady(name, dimension)
		return created
	}
}
