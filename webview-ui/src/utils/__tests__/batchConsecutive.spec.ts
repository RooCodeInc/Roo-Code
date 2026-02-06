import type { ClineMessage } from "@roo-code/types"

import { batchConsecutive } from "../batchConsecutive"

/** Helper: create a minimal ClineMessage with an identifiable text field. */
function msg(text: string, type: ClineMessage["type"] = "say"): ClineMessage {
	return { ts: Date.now(), type, text }
}

/** Predicate: matches messages whose text starts with "match". */
const isMatch = (m: ClineMessage) => !!m.text?.startsWith("match")

/** Synthesize: merges a batch into a single message with a "BATCH:" marker. */
const synthesizeBatch = (batch: ClineMessage[]): ClineMessage => ({
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
})
