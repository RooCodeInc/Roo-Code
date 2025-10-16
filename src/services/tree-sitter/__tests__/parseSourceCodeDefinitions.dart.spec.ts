import { testParseSourceCodeDefinitions } from "./helpers"
import { dartQuery } from "../queries"
import sampleDartContent from "./fixtures/sample-dart"

describe("parseSourceCodeDefinitions for Dart", () => {
	const testOptions = {
		language: "dart",
		wasmFile: "tree-sitter-dart.wasm",
		queryString: dartQuery,
		extKey: "dart",
	}

	it("should parse Dart class definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.dart", sampleDartContent, testOptions)
		expect(result).toBeTruthy()
		expect(result).toContain("UserService")
		expect(result).toContain("BaseRepository")
	})

	it("should parse Dart method definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.dart", sampleDartContent, testOptions)
		expect(result).toContain("fetchData")
		expect(result).toContain("createUser")
	})

	it("should parse Dart mixin definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.dart", sampleDartContent, testOptions)
		expect(result).toContain("ValidationMixin")
	})

	it("should parse Dart enum definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.dart", sampleDartContent, testOptions)
		expect(result).toContain("UserRole")
	})

	it("should parse Dart extension definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.dart", sampleDartContent, testOptions)
		expect(result).toContain("StringExtensions")
	})

	it("should parse Dart constructor definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.dart", sampleDartContent, testOptions)
		expect(result).toContain("UserService")
		expect(result).toContain("User")
	})

	it("should parse Dart top-level function definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.dart", sampleDartContent, testOptions)
		expect(result).toContain("initializeApp")
	})

	it("should format output with line numbers", async () => {
		const result = await testParseSourceCodeDefinitions("test.dart", sampleDartContent, testOptions)
		expect(result).toMatch(/\d+--\d+ \| /)
	})
})
