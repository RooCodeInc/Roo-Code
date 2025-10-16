import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { dartQuery } from "../queries"
import sampleDartContent from "./fixtures/sample-dart"

describe("inspectDart", () => {
	const testOptions = {
		language: "dart",
		wasmFile: "tree-sitter-dart.wasm",
		queryString: dartQuery,
		extKey: "dart",
	}

	it("should inspect Dart tree structure", async () => {
		const result = await inspectTreeStructure(sampleDartContent, "dart")
		expect(result).toBeTruthy()
	})

	it("should parse Dart definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.dart", sampleDartContent, testOptions)
		expect(result).toBeTruthy()
		expect(result).toMatch(/\d+--\d+ \| /) // Verify line number format
	})
})
