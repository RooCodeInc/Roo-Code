import { mergeJson } from "../getTheme"

describe("getTheme", () => {
	describe("mergeJson", () => {
		it("should merge two simple objects", () => {
			const first = { a: 1, b: 2 }
			const second = { c: 3 }
			const result = mergeJson(first, second)
			expect(result).toEqual({ a: 1, b: 2, c: 3 })
		})

		it("should overwrite values when mergeBehavior is 'overwrite'", () => {
			const first = { a: 1, b: 2 }
			const second = { a: 10, c: 3 }
			const result = mergeJson(first, second, "overwrite")
			expect(result).toEqual({ a: 10, b: 2, c: 3 })
		})

		it("should merge arrays", () => {
			const first = { arr: [1, 2] }
			const second = { arr: [3, 4] }
			const result = mergeJson(first, second)
			expect(result).toEqual({ arr: [1, 2, 3, 4] })
		})

		it("should merge nested objects", () => {
			const first = { nested: { a: 1, b: 2 } }
			const second = { nested: { c: 3 } }
			const result = mergeJson(first, second)
			expect(result).toEqual({ nested: { a: 1, b: 2, c: 3 } })
		})

		it("should use merge keys for arrays", () => {
			const first = {
				items: [
					{ id: 1, value: "a" },
					{ id: 2, value: "b" },
				],
			}
			const second = { items: [{ id: 1, value: "updated" }] }
			const mergeKeys = { items: (a: any, b: any) => a.id === b.id }
			const result = mergeJson(first, second, undefined, mergeKeys)
			expect(result).toEqual({
				items: [
					{ id: 2, value: "b" },
					{ id: 1, value: "updated" },
				],
			})
		})

		it("should merge objects without errors", () => {
			const first = { a: 1 }
			const second = { b: 2 }
			const result = mergeJson(first, second)
			expect(result).toEqual({ a: 1, b: 2 })
		})
	})
})
