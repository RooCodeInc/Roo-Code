import { batchConsecutive } from "../batchConsecutive"

interface TestItem {
	ts: number
	type: string
	text: string
}

/** Helper: create a minimal test item with an identifiable text field. */
function msg(text: string, type = "say"): TestItem {
	return { ts: Date.now(), type, text }
}

/** Predicate: matches items whose text starts with "match". */
const isMatch = (m: TestItem) => !!m.text?.startsWith("match")

/** Synthesize: merges a batch into a single item with a "BATCH:" marker. */
const synthesizeBatch = (batch: TestItem[]): TestItem => ({
	...batch[0],
	text: `BATCH:${batch.map((m) => m.text).join(",")}`,
})

describe("batchConsecutive", () => {
	test("empty input returns empty output", () => {
		expect(batchConsecutive([], isMatch, synthesizeBatch)).toEqual([])
	})

	test("no matches returns passthrough", () => {
		const messages = [msg("a"), msg("b"), msg("c")]
		const result = batchConsecutive(messages, isMatch, synthesizeBatch)
		expect(result).toEqual(messages)
	})

	test("single match is passed through without batching", () => {
		const messages = [msg("a"), msg("match-1"), msg("b")]
		const result = batchConsecutive(messages, isMatch, synthesizeBatch)
		expect(result).toHaveLength(3)
		expect(result[1].text).toBe("match-1")
	})

	test("two consecutive matches produce one synthetic message", () => {
		const messages = [msg("a"), msg("match-1"), msg("match-2"), msg("b")]
		const result = batchConsecutive(messages, isMatch, synthesizeBatch)
		expect(result).toHaveLength(3)
		expect(result[0].text).toBe("a")
		expect(result[1].text).toBe("BATCH:match-1,match-2")
		expect(result[2].text).toBe("b")
	})

	test("non-consecutive matches are not batched", () => {
		const messages = [msg("match-1"), msg("other"), msg("match-2")]
		const result = batchConsecutive(messages, isMatch, synthesizeBatch)
		expect(result).toHaveLength(3)
		expect(result[0].text).toBe("match-1")
		expect(result[1].text).toBe("other")
		expect(result[2].text).toBe("match-2")
	})

	test("mixed sequences are correctly interleaved", () => {
		const messages = [
			msg("match-1"),
			msg("match-2"),
			msg("match-3"),
			msg("other-1"),
			msg("match-4"),
			msg("other-2"),
			msg("match-5"),
			msg("match-6"),
		]
		const result = batchConsecutive(messages, isMatch, synthesizeBatch)
		expect(result).toHaveLength(5)
		expect(result[0].text).toBe("BATCH:match-1,match-2,match-3")
		expect(result[1].text).toBe("other-1")
		expect(result[2].text).toBe("match-4") // single — not batched
		expect(result[3].text).toBe("other-2")
		expect(result[4].text).toBe("BATCH:match-5,match-6")
	})

	test("all items match → single synthetic message", () => {
		const items = [msg("match-1"), msg("match-2"), msg("match-3")]
		const result = batchConsecutive(items, isMatch, synthesizeBatch)
		expect(result).toHaveLength(1)
		expect(result[0].text).toBe("BATCH:match-1,match-2,match-3")
	})

	test("does not mutate the input array", () => {
		const items = [msg("match-1"), msg("match-2")]
		const original = [...items]
		batchConsecutive(items, isMatch, synthesizeBatch)
		expect(items).toHaveLength(2)
		expect(items).toEqual(original)
	})

	test("returns a new array, not the same reference", () => {
		const items = [msg("a"), msg("b")]
		const result = batchConsecutive(items, isMatch, synthesizeBatch)
		expect(result).not.toBe(items)
	})

	test("synthesize callback receives the correct batches", () => {
		const spy = vi.fn(synthesizeBatch)
		const items = [msg("match-1"), msg("match-2"), msg("other"), msg("match-3"), msg("match-4")]
		batchConsecutive(items, isMatch, spy)
		expect(spy).toHaveBeenCalledTimes(2)
		expect(spy.mock.calls[0][0]).toHaveLength(2)
		expect(spy.mock.calls[1][0]).toHaveLength(2)
	})

	test("batch at the end of the array", () => {
		const items = [msg("other"), msg("match-1"), msg("match-2")]
		const result = batchConsecutive(items, isMatch, synthesizeBatch)
		expect(result).toHaveLength(2)
		expect(result[0].text).toBe("other")
		expect(result[1].text).toBe("BATCH:match-1,match-2")
	})
})
