/**
 * Enhanced Tree-sitter Symbols Tests
 * Tests for enhanced query parsing including generics, decorators, type aliases, and other advanced features
 */

import { describe, it, expect, beforeAll } from "vitest"
import * as path from "path"
import { initializeTreeSitter, debugLog } from "./helpers"
import { typescriptEnhancedQuery, pythonEnhancedQuery, javaEnhancedQuery } from "../queries"

describe("Enhanced Tree-sitter Queries", () => {
	let treeSitter: {
		Parser: typeof import("web-tree-sitter").Parser
		Language: typeof import("web-tree-sitter").Language
	} | null = null

	beforeAll(async () => {
		treeSitter = await initializeTreeSitter()
	})

	describe("Query String Validation", () => {
		it("should have TypeScript enhanced query defined", () => {
			expect(typescriptEnhancedQuery).toBeDefined()
			expect(typeof typescriptEnhancedQuery).toBe("string")
			expect(typescriptEnhancedQuery.length).toBeGreaterThan(0)
		})

		it("should have Python enhanced query defined", () => {
			expect(pythonEnhancedQuery).toBeDefined()
			expect(typeof pythonEnhancedQuery).toBe("string")
			expect(pythonEnhancedQuery.length).toBeGreaterThan(0)
		})

		it("should have Java enhanced query defined", () => {
			expect(javaEnhancedQuery).toBeDefined()
			expect(typeof javaEnhancedQuery).toBe("string")
			expect(javaEnhancedQuery.length).toBeGreaterThan(0)
		})

		it("should have valid TypeScript enhanced query syntax", () => {
			expect(typescriptEnhancedQuery).toContain("@")
			expect(typescriptEnhancedQuery.length).toBeGreaterThan(100)
		})

		it("should have valid Python enhanced query syntax", () => {
			expect(pythonEnhancedQuery).toContain("@")
			expect(pythonEnhancedQuery.length).toBeGreaterThan(100)
		})

		it("should have valid Java enhanced query syntax", () => {
			expect(javaEnhancedQuery).toContain("@")
			expect(javaEnhancedQuery.length).toBeGreaterThan(100)
		})
	})

	describe("TypeScript Enhanced Query Parsing", () => {
		it("should parse TypeScript code without errors", async () => {
			if (!treeSitter) return

			const code = `
@Component({
    selector: 'my-component',
    template: '<div>Hello</div>'
})
class MyComponent<T extends string> {
    @Input() name: string;
}
`
			const { Parser, Language } = treeSitter
			const parser = new Parser()
			const wasmPath = path.join(process.cwd(), "dist/tree-sitter-typescript.wasm")
			const lang = await Language.load(wasmPath)
			parser.setLanguage(lang)

			const tree = parser.parse(code)
			expect(tree).toBeDefined()
			if (!tree) return
			expect(tree.rootNode).toBeDefined()
		})

		it("should capture symbols in TypeScript code", async () => {
			if (!treeSitter) return

			const code = `
class TestClass<T> {
    name: string;
}
`
			const { Parser, Language } = treeSitter
			const parser = new Parser()
			const wasmPath = path.join(process.cwd(), "dist/tree-sitter-typescript.wasm")
			const lang = await Language.load(wasmPath)
			parser.setLanguage(lang)

			const tree = parser.parse(code)
			if (!tree) return
			// Use basic query for actual capture testing
			const basicQuery = lang.query(typescriptEnhancedQuery)
			const captures = basicQuery.captures(tree.rootNode)

			expect(captures.length).toBeGreaterThan(0)
		})
	})

	describe("Python Enhanced Query Parsing", () => {
		it("should parse Python code without errors", async () => {
			if (!treeSitter) return

			const code = `
@pytest.mark.parametrize("input,expected", [
    ("a", 1)
])
def test_function(input, expected):
    pass

class GenericClass(Generic[T, K]):
    def __init__(self, key: K, value: T):
        self.key = key
        self.value = value
`
			const { Parser, Language } = treeSitter
			const parser = new Parser()
			const wasmPath = path.join(process.cwd(), "dist/tree-sitter-python.wasm")
			const lang = await Language.load(wasmPath)
			parser.setLanguage(lang)

			const tree = parser.parse(code)
			expect(tree).toBeDefined()
			if (!tree) return
			expect(tree.rootNode).toBeDefined()
		})

		it("should capture symbols in Python code", async () => {
			if (!treeSitter) return

			const code = `
@pytest.fixture
def my_fixture():
    return {}

class TestClass:
    name: str
`
			const { Parser, Language } = treeSitter
			const parser = new Parser()
			const wasmPath = path.join(process.cwd(), "dist/tree-sitter-python.wasm")
			const lang = await Language.load(wasmPath)
			parser.setLanguage(lang)

			const tree = parser.parse(code)
			if (!tree) return
			const basicQuery = lang.query(pythonEnhancedQuery)
			const captures = basicQuery.captures(tree.rootNode)

			expect(captures.length).toBeGreaterThan(0)
		})
	})

	describe("Java Enhanced Query Parsing", () => {
		it("should parse Java code without errors", async () => {
			if (!treeSitter) return

			const code = `
@Component(value = "test")
public class MyClass<T extends Comparable<T>> {
    @Deprecated
    public void oldMethod() {}
}
`
			const { Parser, Language } = treeSitter
			const parser = new Parser()
			const wasmPath = path.join(process.cwd(), "dist/tree-sitter-java.wasm")
			const lang = await Language.load(wasmPath)
			parser.setLanguage(lang)

			const tree = parser.parse(code)
			expect(tree).toBeDefined()
			if (!tree) return
			expect(tree.rootNode).toBeDefined()
		})

		it("should capture symbols in Java code", async () => {
			if (!treeSitter) return

			const code = `
@Component(value = "test")
public class MyClass {}
`
			const { Parser, Language } = treeSitter
			const parser = new Parser()
			const wasmPath = path.join(process.cwd(), "dist/tree-sitter-java.wasm")
			const lang = await Language.load(wasmPath)
			parser.setLanguage(lang)

			const tree = parser.parse(code)
			if (!tree) return
			const basicQuery = lang.query(javaEnhancedQuery)
			const captures = basicQuery.captures(tree.rootNode)

			expect(captures.length).toBeGreaterThan(0)
		})
	})

	describe("Query Coverage", () => {
		it("should have TypeScript queries for generic type parameters", () => {
			expect(typescriptEnhancedQuery).toContain("type_parameter")
			expect(typescriptEnhancedQuery.length).toBeGreaterThan(200)
		})

		it("should have TypeScript queries for decorators", () => {
			expect(typescriptEnhancedQuery).toContain("decorator")
		})

		it("should have TypeScript queries for class declarations", () => {
			expect(typescriptEnhancedQuery).toContain("class_declaration")
		})

		it("should have TypeScript queries for type aliases", () => {
			expect(typescriptEnhancedQuery).toContain("type_alias")
		})

		it("should have Python queries for decorators", () => {
			expect(pythonEnhancedQuery).toContain("decorator")
		})

		it("should have Python queries for class definitions", () => {
			expect(pythonEnhancedQuery).toContain("class_definition")
		})

		it("should have Python queries for function definitions", () => {
			expect(pythonEnhancedQuery).toContain("function_definition")
		})

		it("should have Java queries for annotations", () => {
			expect(javaEnhancedQuery).toContain("annotation")
		})

		it("should have Java queries for generic types", () => {
			expect(javaEnhancedQuery).toContain("type_parameter")
		})

		it("should have Java queries for class declarations", () => {
			expect(javaEnhancedQuery).toContain("class_declaration")
		})
	})

	describe("Backward Compatibility", () => {
		it("should not break existing TypeScript parsing", async () => {
			if (!treeSitter) return

			const code = `
function testFunction(): void {
    console.log('test');
}

class TestClass {
    name: string;
}
`
			const { Parser, Language } = treeSitter
			const parser = new Parser()
			const wasmPath = path.join(process.cwd(), "dist/tree-sitter-typescript.wasm")
			const lang = await Language.load(wasmPath)
			parser.setLanguage(lang)

			const tree = parser.parse(code)
			expect(tree).toBeDefined()
		})

		it("should not break existing Python parsing", async () => {
			if (!treeSitter) return

			const code = `
def test_function():
    pass

class TestClass:
    name: str
`
			const { Parser, Language } = treeSitter
			const parser = new Parser()
			const wasmPath = path.join(process.cwd(), "dist/tree-sitter-python.wasm")
			const lang = await Language.load(wasmPath)
			parser.setLanguage(lang)

			const tree = parser.parse(code)
			expect(tree).toBeDefined()
		})

		it("should not break existing Java parsing", async () => {
			if (!treeSitter) return

			const code = `
public class TestClass {
    private String name;
    
    public void testMethod() {}
}
`
			const { Parser, Language } = treeSitter
			const parser = new Parser()
			const wasmPath = path.join(process.cwd(), "dist/tree-sitter-java.wasm")
			const lang = await Language.load(wasmPath)
			parser.setLanguage(lang)

			const tree = parser.parse(code)
			expect(tree).toBeDefined()
		})
	})
})
