import { describe, it, expect } from "vitest"
import { QdrantFilterTranslator } from "../filters"

describe("QdrantFilterTranslator", () => {
	const t = new QdrantFilterTranslator()

	it("directoryPrefixToFilter handles '.' and './' as no-op", () => {
		expect(t.directoryPrefixToFilter(".")).toBeUndefined()
		expect(t.directoryPrefixToFilter("./")).toBeUndefined()
	})

	it("directoryPrefixToFilter builds must clauses for segments", () => {
		const filter = t.directoryPrefixToFilter("./src/utils")
		expect(filter).toEqual({
			must: [
				{ key: "pathSegments.0", match: { value: "src" } },
				{ key: "pathSegments.1", match: { value: "utils" } },
			],
		})
	})

	it("filePathsToDeleteFilter builds OR over exact path segments with workspace root", () => {
		const filter = t.filePathsToDeleteFilter(["/repo/src/a.ts", "src/b.ts"], "/repo")
		expect(filter.should.length).toBe(2)
		expect(filter.should[0].must).toEqual([
			{ key: "pathSegments.0", match: { value: "src" } },
			{ key: "pathSegments.1", match: { value: "a.ts" } },
		])
	})
})
