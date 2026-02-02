/**
 * GraphBuilder Unit Tests
 */

import { describe, it, expect } from "vitest"
import { GraphBuilder } from "../builder"
import { DependencyType, SymbolType } from "../types"

describe("GraphBuilder", () => {
	const builder = new GraphBuilder()

	describe("TypeScript/TSX parsing", () => {
		it("should extract ES6 imports", async () => {
			const content = `
import { Component } from 'react'
import utils from './utils'
import * as path from 'path'
`
			const result = await builder.parseFile("/test/file.ts", content)

			expect(result.success).toBe(true)
			expect(result.imports.length).toBeGreaterThanOrEqual(3)
			expect(result.imports.some((i) => i.target === "react")).toBe(true)
			expect(result.imports.some((i) => i.target === "./utils")).toBe(true)
			expect(result.imports.some((i) => i.target === "path")).toBe(true)
		})

		it("should extract dynamic imports", async () => {
			const content = `
const module = await import('./dynamic-module')
`
			const result = await builder.parseFile("/test/file.ts", content)

			expect(result.success).toBe(true)
			expect(result.imports.some((i) => i.target === "./dynamic-module")).toBe(true)
		})

		it("should extract require statements", async () => {
			const content = `
const fs = require('fs')
const path = require('path')
`
			const result = await builder.parseFile("/test/file.ts", content)

			expect(result.success).toBe(true)
			expect(result.imports.some((i) => i.target === "fs")).toBe(true)
			expect(result.imports.some((i) => i.target === "path")).toBe(true)
		})

		it("should extract export statements", async () => {
			const content = `
export function myFunction() {}
export class MyClass {}
export interface MyInterface {}
export type MyType = string
export const MY_CONST = 123
export default function defaultFn() {}
`
			const result = await builder.parseFile("/test/file.ts", content)

			expect(result.success).toBe(true)
			expect(result.exports.some((e) => e.name === "myFunction" && e.type === SymbolType.FUNCTION)).toBe(true)
			expect(result.exports.some((e) => e.name === "MyClass" && e.type === SymbolType.CLASS)).toBe(true)
			expect(result.exports.some((e) => e.name === "MyInterface" && e.type === SymbolType.INTERFACE)).toBe(true)
		})

		it("should handle re-exports", async () => {
			const content = `
export { something } from './other-module'
export * from './all-exports'
`
			const result = await builder.parseFile("/test/file.ts", content)

			expect(result.success).toBe(true)
			expect(result.imports.some((i) => i.target === "./other-module")).toBe(true)
		})
	})

	describe("Python parsing", () => {
		it("should extract Python imports", async () => {
			const content = `
import os
from pathlib import Path
import sys
from typing import List, Dict
`
			const result = await builder.parseFile("/test/file.py", content)

			expect(result.success).toBe(true)
			expect(result.imports.some((i) => i.target === "os" || i.target.includes("os"))).toBe(true)
			expect(result.imports.some((i) => i.target === "pathlib" || i.target.includes("pathlib"))).toBe(true)
		})

		it("should extract Python exports (functions and classes)", async () => {
			const content = `
def my_function():
    pass

class MyClass:
    pass
`
			const result = await builder.parseFile("/test/file.py", content)

			expect(result.success).toBe(true)
			expect(result.exports.some((e) => e.name === "my_function")).toBe(true)
			expect(result.exports.some((e) => e.name === "MyClass")).toBe(true)
		})
	})

	describe("Go parsing", () => {
		it("should extract Go exports (capitalized identifiers)", async () => {
			const content = `
package main

func PublicFunction() {}
func privateFunction() {}

type PublicStruct struct {}
`
			const result = await builder.parseFile("/test/file.go", content)

			expect(result.success).toBe(true)
			expect(result.exports.some((e) => e.name === "PublicFunction")).toBe(true)
			expect(result.exports.some((e) => e.name === "PublicStruct")).toBe(true)
			// Private functions should not be exported
			expect(result.exports.some((e) => e.name === "privateFunction")).toBe(false)
		})
	})

	describe("Java parsing", () => {
		it("should extract Java imports", async () => {
			const content = `
import java.util.List;
import java.util.ArrayList;
import static java.lang.Math.PI;
`
			const result = await builder.parseFile("/test/File.java", content)

			expect(result.success).toBe(true)
			expect(result.imports.some((i) => i.target.includes("java.util.List"))).toBe(true)
		})

		it("should extract Java class declarations", async () => {
			const content = `
public class MyClass {
}

public interface MyInterface {
}

public enum MyEnum {
}
`
			const result = await builder.parseFile("/test/File.java", content)

			expect(result.success).toBe(true)
			expect(result.exports.some((e) => e.name === "MyClass")).toBe(true)
		})
	})

	describe("C/C++ parsing", () => {
		it("should extract C++ includes", async () => {
			const content = `
#include <iostream>
#include <vector>
#include "myheader.h"
`
			const result = await builder.parseFile("/test/file.cpp", content)

			expect(result.success).toBe(true)
			expect(result.imports.some((i) => i.target === "iostream")).toBe(true)
			expect(result.imports.some((i) => i.target === "vector")).toBe(true)
			expect(result.imports.some((i) => i.target === "myheader.h")).toBe(true)
		})
	})

	describe("Rust parsing", () => {
		it("should extract Rust use statements", async () => {
			const content = `
use std::io;
use std::collections::HashMap;
extern crate serde;
mod my_module;
`
			const result = await builder.parseFile("/test/file.rs", content)

			expect(result.success).toBe(true)
			expect(result.imports.length).toBeGreaterThan(0)
		})

		it("should extract Rust public items", async () => {
			const content = `
pub fn public_function() {}
pub struct PublicStruct {}
pub enum PublicEnum {}
pub const PUBLIC_CONST: i32 = 42;
`
			const result = await builder.parseFile("/test/file.rs", content)

			expect(result.success).toBe(true)
			expect(result.exports.some((e) => e.name === "public_function")).toBe(true)
			expect(result.exports.some((e) => e.name === "PublicStruct")).toBe(true)
		})
	})

	describe("C# parsing", () => {
		it("should extract C# using statements", async () => {
			const content = `
using System;
using System.Collections.Generic;
using static System.Math;
`
			const result = await builder.parseFile("/test/file.cs", content)

			expect(result.success).toBe(true)
			expect(result.imports.some((i) => i.target.includes("System"))).toBe(true)
		})
	})

	describe("Unsupported languages", () => {
		it("should handle unsupported file types gracefully", async () => {
			const result = await builder.parseFile("/test/file.xyz", "some content")

			expect(result.success).toBe(true)
			expect(result.imports).toHaveLength(0)
			expect(result.exports).toHaveLength(0)
		})
	})

	describe("Error handling", () => {
		it("should handle empty content", async () => {
			const result = await builder.parseFile("/test/file.ts", "")

			expect(result.success).toBe(true)
			expect(result.imports).toHaveLength(0)
		})
	})

	describe("getSupportedExtensions", () => {
		it("should return all supported extensions", () => {
			const extensions = builder.getSupportedExtensions()

			expect(extensions).toContain(".ts")
			expect(extensions).toContain(".tsx")
			expect(extensions).toContain(".js")
			expect(extensions).toContain(".jsx")
			expect(extensions).toContain(".py")
			expect(extensions).toContain(".go")
			expect(extensions).toContain(".java")
			expect(extensions).toContain(".rs")
		})
	})
})
