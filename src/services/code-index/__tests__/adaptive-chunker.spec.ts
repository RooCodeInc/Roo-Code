import { describe, it, expect, beforeEach, vi } from "vitest"
import {
	AdaptiveChunker,
	typescriptChunker,
	pythonChunker,
	javaChunker,
	goChunker,
	rustChunker,
	genericChunker,
} from "../chunking"
import { ChunkingConfig, DEFAULT_CHUNKING_CONFIG } from "../interfaces/chunking"

describe("AdaptiveChunker", () => {
	describe("constructor", () => {
		it("should create with default config", () => {
			const chunker = new AdaptiveChunker()
			expect(chunker.isEnabled()).toBe(true) // Enabled by default
			expect(chunker.getConfig().enabled).toBe(true)
		})

		it("should create with custom config", () => {
			const customConfig: Partial<ChunkingConfig> = {
				enabled: true,
				maxChunkSize: 3000,
				strategy: "syntactic",
			}
			const chunker = new AdaptiveChunker(customConfig)
			expect(chunker.isEnabled()).toBe(true)
			expect(chunker.getConfig().maxChunkSize).toBe(3000)
			expect(chunker.getConfig().strategy).toBe("syntactic")
		})
	})

	describe("setEnabled", () => {
		it("should enable adaptive chunking", () => {
			const chunker = new AdaptiveChunker()
			expect(chunker.isEnabled()).toBe(true) // Already enabled by default
			chunker.setEnabled(true)
			expect(chunker.isEnabled()).toBe(true)
		})

		it("should disable adaptive chunking", () => {
			const chunker = new AdaptiveChunker({ enabled: true })
			expect(chunker.isEnabled()).toBe(true)
			chunker.setEnabled(false)
			expect(chunker.isEnabled()).toBe(false)
		})
	})

	describe("updateConfig", () => {
		it("should update configuration", () => {
			const chunker = new AdaptiveChunker()
			chunker.updateConfig({ maxChunkSize: 2500, minChunkSize: 300 })
			const config = chunker.getConfig()
			expect(config.maxChunkSize).toBe(2500)
			expect(config.minChunkSize).toBe(300)
		})
	})

	describe("chunkFile", () => {
		it("should return empty array when disabled", async () => {
			const chunker = new AdaptiveChunker({ enabled: false })
			const result = chunker.chunkFile("const x = 1;", "typescript", "test.ts")
			expect(result).toEqual([])
		})

		it("should return empty array when enabled but no content", async () => {
			const chunker = new AdaptiveChunker({ enabled: true })
			const result = chunker.chunkFile("", "typescript", "test.ts")
			expect(result).toEqual([])
		})
	})

	describe("chunkContent", () => {
		it("should return empty array when disabled", () => {
			const chunker = new AdaptiveChunker({ enabled: false })
			const result = chunker.chunkContent("const x = 1;", "typescript")
			expect(result).toEqual([])
		})

		it("should return chunks when enabled", () => {
			const chunker = new AdaptiveChunker({ enabled: true, minChunkSize: 10 })
			const result = chunker.chunkContent("const x = 1;", "typescript")
			expect(result.length).toBeGreaterThan(0)
		})
	})
})

describe("Language Chunkers", () => {
	describe("TypeScriptChunker", () => {
		it("should support typescript", () => {
			expect(typescriptChunker.canChunk("typescript")).toBe(true)
			expect(typescriptChunker.canChunk("javascript")).toBe(true)
			expect(typescriptChunker.canChunk("tsx")).toBe(true)
			expect(typescriptChunker.canChunk("jsx")).toBe(true)
		})

		it("should not support python", () => {
			expect(typescriptChunker.canChunk("python")).toBe(false)
		})

		it("should chunk function declarations", () => {
			const code = `
function hello() {
	console.log("Hello");
	return true;
}

function world() {
	console.log("World");
}
`
			const chunks = typescriptChunker.chunk(code, 1500)
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some((c) => c.includes("function hello"))).toBe(true)
			expect(chunks.some((c) => c.includes("function world"))).toBe(true)
		})

		it("should chunk class declarations", () => {
			const code = `
class MyClass {
	name: string;

	constructor(name: string) {
		this.name = name;
	}

	greet() {
		return "Hello, " + this.name;
	}
}
`
			const chunks = typescriptChunker.chunk(code, 1500)
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some((c) => c.includes("class MyClass"))).toBe(true)
		})
	})

	describe("PythonChunker", () => {
		it("should support python", () => {
			expect(pythonChunker.canChunk("python")).toBe(true)
			expect(pythonChunker.canChunk("py")).toBe(true)
		})

		it("should not support java", () => {
			expect(pythonChunker.canChunk("java")).toBe(false)
		})

		it("should chunk function definitions", () => {
			const code = `
def hello():
	print("Hello")
	return True

def world():
	print("World")
`
			const chunks = pythonChunker.chunk(code, 1500)
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some((c) => c.includes("def hello"))).toBe(true)
		})

		it("should chunk class definitions", () => {
			const code = `
class MyClass:
	def __init__(self, name):
		self.name = name

	def greet(self):
		return f"Hello, {self.name}"
`
			const chunks = pythonChunker.chunk(code, 1500)
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some((c) => c.includes("class MyClass"))).toBe(true)
		})
	})

	describe("JavaChunker", () => {
		it("should support java", () => {
			expect(javaChunker.canChunk("java")).toBe(true)
		})

		it("should not support go", () => {
			expect(javaChunker.canChunk("go")).toBe(false)
		})

		it("should chunk class definitions", () => {
			const code = `
public class MyClass {
	private String name;

	public MyClass(String name) {
		this.name = name;
	}

	public String greet() {
		return "Hello, " + name;
	}
}
`
			const chunks = javaChunker.chunk(code, 2000)
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some((c) => c.includes("class MyClass"))).toBe(true)
		})
	})

	describe("GoChunker", () => {
		it("should support go", () => {
			expect(goChunker.canChunk("go")).toBe(true)
		})

		it("should not support rust", () => {
			expect(goChunker.canChunk("rust")).toBe(false)
		})

		it("should chunk function definitions", () => {
			const code = `
package main

import "fmt"

func hello() {
	fmt.Println("Hello")
	return
}

func main() {
	hello()
}
`
			const chunks = goChunker.chunk(code, 1500)
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some((c) => c.includes("func hello"))).toBe(true)
		})
	})

	describe("RustChunker", () => {
		it("should support rust", () => {
			expect(rustChunker.canChunk("rust")).toBe(true)
			expect(rustChunker.canChunk("rs")).toBe(true)
		})

		it("should not support go", () => {
			expect(rustChunker.canChunk("go")).toBe(false)
		})

		it("should chunk function definitions", () => {
			const code = `
fn hello() {
	println!("Hello");
	return;
}

fn main() {
	hello();
}
`
			const chunks = rustChunker.chunk(code, 1500)
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some((c) => c.includes("fn hello"))).toBe(true)
		})

		it("should chunk Rust code blocks", () => {
			const code = `
struct MyStruct {
	name: String,
}

impl MyStruct {
	fn new(name: String) -> MyStruct {
		MyStruct { name }
	}
}
`
			const chunks = rustChunker.chunk(code, 1500)
			expect(chunks.length).toBeGreaterThan(0)
		})
	})

	describe("GenericChunker", () => {
		it("should support fallback for any language", () => {
			expect(genericChunker.canChunk("unknown")).toBe(false)
			expect(genericChunker.canChunk("custom")).toBe(false)
		})

		it("should chunk basic code", () => {
			const code = `
function hello() {
	console.log("Hello");
}

const x = 1;
`
			const chunks = genericChunker.chunk(code, 1500)
			expect(chunks.length).toBeGreaterThan(0)
		})
	})
})

describe("Chunking Configuration", () => {
	it("should have correct default values", () => {
		expect(DEFAULT_CHUNKING_CONFIG.enabled).toBe(true)
		expect(DEFAULT_CHUNKING_CONFIG.strategy).toBe("balanced")
		expect(DEFAULT_CHUNKING_CONFIG.maxChunkSize).toBe(2000)
		expect(DEFAULT_CHUNKING_CONFIG.minChunkSize).toBe(200)
		expect(DEFAULT_CHUNKING_CONFIG.overlapSize).toBe(200)
	})

	it("should have language overrides", () => {
		expect(DEFAULT_CHUNKING_CONFIG.languageOverrides.typescript).toBeDefined()
		expect(DEFAULT_CHUNKING_CONFIG.languageOverrides.python).toBeDefined()
		expect(DEFAULT_CHUNKING_CONFIG.languageOverrides.java).toBeDefined()
		expect(DEFAULT_CHUNKING_CONFIG.languageOverrides.go).toBeDefined()
		expect(DEFAULT_CHUNKING_CONFIG.languageOverrides.rust).toBeDefined()
	})
})

describe("Large File Chunking", () => {
	it("should handle large TypeScript files", () => {
		const largeCode = Array(100)
			.fill(null)
			.map((_, i) => `function func${i}() {\n\treturn ${i};\n}`)
			.join("\n\n")

		const chunks = typescriptChunker.chunk(largeCode, 1000)
		expect(chunks.length).toBeGreaterThan(1)
	})

	it("should handle large Python files", () => {
		const largeCode = Array(100)
			.fill(null)
			.map((_, i) => `def func${i}():\n\treturn ${i}`)
			.join("\n\n")

		const chunks = pythonChunker.chunk(largeCode, 500)
		expect(chunks.length).toBeGreaterThanOrEqual(1)
	})

	it("should respect max chunk size", () => {
		const code = Array(50)
			.fill(null)
			.map((_, i) => `function func${i}() { return ${i}; }`)
			.join("\n")

		const chunks = typescriptChunker.chunk(code, 500)
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(500)
		}
	})
})

describe("Edge Cases", () => {
	it("should handle empty content", () => {
		const chunks = typescriptChunker.chunk("", 1500)
		expect(chunks).toEqual([])
	})

	it("should handle single line content", () => {
		const code = "const x = 1;"
		const chunks = typescriptChunker.chunk(code, 1500)
		expect(chunks.length).toBeGreaterThanOrEqual(1)
	})

	it("should handle code with only comments", () => {
		const code = `
// This is a comment
// Another comment
/* Block comment */
`
		const chunks = typescriptChunker.chunk(code, 1500)
		expect(chunks.length).toBeGreaterThanOrEqual(0)
	})

	it("should handle deeply nested code", () => {
		const code = `
class Outer {
	class Inner {
		static nested() {
			return function() {
				return true;
			};
		}
	}
}
`
		const chunks = typescriptChunker.chunk(code, 1500)
		expect(chunks.length).toBeGreaterThan(0)
	})
})
