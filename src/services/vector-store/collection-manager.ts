const readyCollections = new Map<string, boolean>()
const inFlightEnsures = new Map<string, Promise<boolean>>()

/**
 * Tracks ensure-once readiness per (collection, dimension) pair.
 * Deduplicates concurrent ensure calls for the same key.
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
	 * Deduplicates concurrent calls for the same key.
	 * @returns true if the underlying ensure created/recreated the collection, false if it was already compatible.
	 */
	static async ensureOnce(
		ensureFn: (name: string, dimension: number) => Promise<boolean>,
		name: string,
		dimension: number,
	): Promise<boolean> {
		const key = this.key(name, dimension)

		if (this.isReady(name, dimension)) return false

		// Check if already in-flight
		if (inFlightEnsures.has(key)) {
			return inFlightEnsures.get(key)!
		}

		// Start new ensure operation with cleanup
		const promise = ensureFn(name, dimension)
			.then((created) => {
				this.markReady(name, dimension)
				inFlightEnsures.delete(key)
				return created
			})
			.catch((error) => {
				inFlightEnsures.delete(key)
				throw error
			})

		inFlightEnsures.set(key, promise)
		return promise
	}
}
