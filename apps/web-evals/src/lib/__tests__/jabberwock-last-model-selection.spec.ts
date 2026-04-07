import {
	loadJabberwockLastModelSelection,
	JABBERWOCK_LAST_MODEL_SELECTION_KEY,
	saveJabberwockLastModelSelection,
} from "../jabberwock-last-model-selection"

class LocalStorageMock implements Storage {
	private store = new Map<string, string>()

	get length(): number {
		return this.store.size
	}

	clear(): void {
		this.store.clear()
	}

	getItem(key: string): string | null {
		return this.store.get(key) ?? null
	}

	key(index: number): string | null {
		return Array.from(this.store.keys())[index] ?? null
	}

	removeItem(key: string): void {
		this.store.delete(key)
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value)
	}
}

beforeEach(() => {
	Object.defineProperty(globalThis, "localStorage", {
		value: new LocalStorageMock(),
		configurable: true,
	})
})

describe("jabberwock-last-model-selection", () => {
	it("saves and loads (deduped + trimmed)", () => {
		saveJabberwockLastModelSelection([" jabberwock/model-a ", "jabberwock/model-a", "jabberwock/model-b"])
		expect(loadJabberwockLastModelSelection()).toEqual(["jabberwock/model-a", "jabberwock/model-b"])
	})

	it("ignores invalid JSON", () => {
		localStorage.setItem(JABBERWOCK_LAST_MODEL_SELECTION_KEY, "{this is not json")
		expect(loadJabberwockLastModelSelection()).toEqual([])
	})

	it("clears when empty", () => {
		localStorage.setItem(JABBERWOCK_LAST_MODEL_SELECTION_KEY, JSON.stringify(["jabberwock/model-a"]))
		saveJabberwockLastModelSelection([])
		expect(localStorage.getItem(JABBERWOCK_LAST_MODEL_SELECTION_KEY)).toBeNull()
	})

	it("does not throw if localStorage access fails", () => {
		Object.defineProperty(globalThis, "localStorage", {
			value: {
				getItem: () => {
					throw new Error("blocked")
				},
				setItem: () => {
					throw new Error("blocked")
				},
				removeItem: () => {
					throw new Error("blocked")
				},
			},
			configurable: true,
		})

		expect(() => loadJabberwockLastModelSelection()).not.toThrow()
		expect(() => saveJabberwockLastModelSelection(["jabberwock/model-a"])).not.toThrow()
	})
})
