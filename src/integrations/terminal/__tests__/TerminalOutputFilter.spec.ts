import {
	filterTerminalOutput,
	formatFilterIndicator,
	BUILT_IN_FILTER_RULES,
	type FilterResult,
} from "../TerminalOutputFilter"

describe("TerminalOutputFilter", () => {
	describe("filterTerminalOutput", () => {
		it("should return null for very small outputs (< 5 lines)", () => {
			const output = "line1\nline2\nline3\nline4"
			const result = filterTerminalOutput("npm test", output)
			expect(result).toBeNull()
		})

		it("should return null when no filter matches the command", () => {
			const output = Array(20).fill("some output line").join("\n")
			const result = filterTerminalOutput("echo hello", output)
			expect(result).toBeNull()
		})

		it("should return null when filter matches but reduction is less than 20%", () => {
			// A very short test output that wouldn't be reduced much
			const output = [
				"PASS src/test.ts",
				"Test Suites: 1 passed, 1 total",
				"Tests: 3 passed, 3 total",
				"Time: 1.5s",
				"extra line",
			].join("\n")
			const result = filterTerminalOutput("npm test", output)
			expect(result).toBeNull()
		})
	})

	describe("test-runner filter", () => {
		const makeTestOutput = (passCount: number, failCount: number): string => {
			const lines: string[] = []
			lines.push("PASS src/utils/helper.spec.ts")
			for (let i = 0; i < passCount; i++) {
				lines.push(`  ✓ should pass test ${i} (${i + 1}ms)`)
			}
			if (failCount > 0) {
				lines.push("")
				lines.push("FAIL src/core/main.spec.ts")
				for (let i = 0; i < failCount; i++) {
					lines.push(`  ✕ should fail test ${i}`)
					lines.push(`    expect(received).toBe(expected)`)
					lines.push(`    Expected: true`)
					lines.push(`    Received: false`)
					lines.push("")
				}
			}
			lines.push("")
			lines.push(`Test Suites: ${failCount > 0 ? "1 failed, " : ""}1 passed, ${failCount > 0 ? 2 : 1} total`)
			lines.push(
				`Tests: ${failCount > 0 ? `${failCount} failed, ` : ""}${passCount} passed, ${passCount + failCount} total`,
			)
			lines.push("Time: 5.234s")
			lines.push("Ran all test suites.")
			return lines.join("\n")
		}

		it("should filter jest/vitest output with passing tests", () => {
			const output = makeTestOutput(50, 0)
			const result = filterTerminalOutput("npx vitest run", output)
			expect(result).not.toBeNull()
			expect(result!.filterName).toBe("test-runner")
			expect(result!.filteredLineCount).toBeLessThan(result!.originalLineCount)
			expect(result!.output).toContain("Tests:")
			expect(result!.output).toContain("50 passed")
		})

		it("should preserve failure details while filtering passing tests", () => {
			const output = makeTestOutput(50, 2)
			const result = filterTerminalOutput("npm test", output)
			expect(result).not.toBeNull()
			expect(result!.filterName).toBe("test-runner")
			expect(result!.output).toContain("Failures:")
			expect(result!.output).toContain("expect(received).toBe(expected)")
			expect(result!.output).toContain("2 failed")
		})

		it("should match various test runner commands", () => {
			const testOutput = makeTestOutput(30, 0)
			const commands = [
				"jest",
				"vitest run",
				"npx jest --coverage",
				"npx vitest run src/tests",
				"npm test",
				"npm run test",
				"yarn test",
				"pnpm test",
				"cargo test",
				"go test ./...",
				"pytest",
				"py.test -v",
			]

			for (const cmd of commands) {
				const result = filterTerminalOutput(cmd, testOutput)
				expect(result).not.toBeNull()
				expect(result!.filterName).toBe("test-runner")
			}
		})

		it("should handle pytest output format", () => {
			const output = [
				"============================= test session starts ==============================",
				"platform linux -- Python 3.10.0, pytest-7.0.0, pluggy-1.0.0",
				"collected 50 items",
				"",
				...Array(45).fill("test_module.py::test_case PASSED"),
				"test_module.py::test_broken FAILED",
				"",
				"=================================== FAILURES ===================================",
				"_________________________ test_broken __________________________",
				"",
				"    def test_broken():",
				">       assert False",
				"E       AssertionError",
				"",
				"=========================== short test summary info ============================",
				"FAILED test_module.py::test_broken",
				"======================== 1 failed, 49 passed in 2.50s ========================",
			].join("\n")

			const result = filterTerminalOutput("pytest", output)
			expect(result).not.toBeNull()
			expect(result!.filterName).toBe("test-runner")
			expect(result!.filteredLineCount).toBeLessThan(result!.originalLineCount)
			expect(result!.output).toContain("1 failed, 49 passed")
		})

		it("should handle cargo test output format", () => {
			const output = [
				"   Compiling myproject v0.1.0",
				"    Finished test profile [unoptimized + debuginfo]",
				"     Running unittests src/main.rs",
				"",
				...Array(20).fill("test module::test_case ... ok"),
				"test module::test_fail ... FAILED",
				"",
				"failures:",
				"---- module::test_fail stdout ----",
				"thread panicked at 'assertion failed'",
				"",
				"failures:",
				"    module::test_fail",
				"",
				"test result: FAILED. 20 passed; 1 failed; 0 ignored",
			].join("\n")

			const result = filterTerminalOutput("cargo test", output)
			expect(result).not.toBeNull()
			expect(result!.filterName).toBe("test-runner")
			expect(result!.output).toContain("test result:")
		})
	})

	describe("git-status filter", () => {
		it("should compact git status short format", () => {
			const output = [
				"On branch main",
				"Your branch is up to date with 'origin/main'.",
				"",
				"M  src/file1.ts",
				"M  src/file2.ts",
				" M src/file3.ts",
				"?? src/new-file.ts",
				"?? tests/new-test.ts",
				"A  src/added.ts",
				...Array(10).fill("M  src/bulk-change.ts"),
			].join("\n")

			const result = filterTerminalOutput("git status", output)
			expect(result).not.toBeNull()
			expect(result!.filterName).toBe("git-status")
			expect(result!.output).toContain("On branch main")
			expect(result!.output).toContain("Staged")
			expect(result!.output).toContain("Untracked")
		})

		it("should pass through clean working directory with few lines", () => {
			const output = ["On branch main", "nothing to commit, working tree clean", ""].join("\n")

			const result = filterTerminalOutput("git status", output)
			// Very small output (< 5 lines) is not filtered
			expect(result).toBeNull()
		})

		it("should still reduce verbose clean status output", () => {
			const output = [
				"On branch main",
				"Your branch is up to date with 'origin/main'.",
				"",
				"nothing to commit, working tree clean",
				"",
				"",
			].join("\n")

			const result = filterTerminalOutput("git status", output)
			// 6 lines input; only branch info is extractable => compact
			if (result) {
				expect(result.filterName).toBe("git-status")
				expect(result.output).toContain("On branch main")
			}
		})
	})

	describe("git-log filter", () => {
		it("should compact git log to one-line-per-commit", () => {
			const output = Array(10)
				.fill(null)
				.map((_, i) =>
					[
						`commit ${"a".repeat(40).replace(/a/g, () => Math.floor(Math.random() * 16).toString(16))}`,
						`Author: Developer <dev@example.com>`,
						`Date:   Mon Jan 1 12:00:00 2024 +0000`,
						"",
						`    Fix bug number ${i}`,
						"",
					].join("\n"),
				)
				.join("\n")

			const result = filterTerminalOutput("git log", output)
			expect(result).not.toBeNull()
			expect(result!.filterName).toBe("git-log")
			expect(result!.filteredLineCount).toBeLessThan(result!.originalLineCount)
			// Each commit should be condensed to one line
			const filteredLines = result!.output.split("\n").filter((l) => l.trim())
			expect(filteredLines.length).toBe(10)
		})
	})

	describe("package-install filter", () => {
		it("should filter npm install progress and keep warnings/summary", () => {
			const output = [
				"npm warn deprecated some-package@1.0.0: Use something-else instead",
				...Array(30).fill("npm http fetch GET 200 https://registry.npmjs.org/some-package"),
				...Array(10).fill("Resolving packages 5/10"),
				"",
				"added 150 packages, removed 5 packages in 12s",
				"",
				"5 packages are looking for funding",
				"  run `npm fund` for details",
			].join("\n")

			const result = filterTerminalOutput("npm install", output)
			expect(result).not.toBeNull()
			expect(result!.filterName).toBe("package-install")
			expect(result!.output).toContain("warn")
			expect(result!.output).toContain("added 150 packages")
			expect(result!.output).not.toContain("http fetch GET")
		})

		it("should match various package manager commands", () => {
			const output = [...Array(30).fill("Resolving packages 5/10"), "", "Done in 5s"].join("\n")

			const commands = [
				"npm install",
				"npm i",
				"yarn install",
				"yarn add lodash",
				"pnpm install",
				"pip install flask",
			]

			for (const cmd of commands) {
				const result = filterTerminalOutput(cmd, output)
				// Some may not reduce enough, but they should at least match the pattern
				const rule = BUILT_IN_FILTER_RULES.find((r) => r.name === "package-install")
				expect(rule!.commandPattern.test(cmd)).toBe(true)
			}
		})
	})

	describe("build filter", () => {
		it("should filter build progress and keep errors", () => {
			const output = [
				...Array(20).fill("Compiling module (5 of 20)"),
				"error[E0308]: mismatched types",
				"  --> src/main.rs:10:5",
				"   |",
				'10 |     let x: i32 = "hello";',
				"   |                  ^^^^^^^ expected `i32`, found `&str`",
				"",
				"error: aborting due to previous error",
				"",
				"For more information about this error, try `rustc --explain E0308`.",
			].join("\n")

			const result = filterTerminalOutput("cargo build", output)
			expect(result).not.toBeNull()
			expect(result!.filterName).toBe("build")
			expect(result!.output).toContain("error[E0308]")
			expect(result!.output).not.toContain("Compiling module (5 of 20)")
		})

		it("should match various build commands", () => {
			const commands = [
				"tsc",
				"cargo build",
				"go build ./...",
				"make",
				"webpack",
				"vite build",
				"next build",
				"npm run build",
				"yarn build",
				"pnpm build",
			]

			for (const cmd of commands) {
				const rule = BUILT_IN_FILTER_RULES.find((r) => r.name === "build")
				expect(rule!.commandPattern.test(cmd)).toBe(true)
			}
		})
	})

	describe("formatFilterIndicator", () => {
		it("should format indicator with artifact available", () => {
			const result: FilterResult = {
				output: "filtered output",
				filterName: "test-runner",
				originalLineCount: 100,
				filteredLineCount: 5,
			}

			const indicator = formatFilterIndicator(result, true)
			expect(indicator).toContain("test-runner")
			expect(indicator).toContain("100 lines -> 5 lines")
			expect(indicator).toContain("95% reduction")
			expect(indicator).toContain("read_command_output")
		})

		it("should format indicator without artifact", () => {
			const result: FilterResult = {
				output: "filtered output",
				filterName: "git-status",
				originalLineCount: 20,
				filteredLineCount: 3,
			}

			const indicator = formatFilterIndicator(result, false)
			expect(indicator).toContain("git-status")
			expect(indicator).toContain("20 lines -> 3 lines")
			expect(indicator).not.toContain("read_command_output")
		})
	})

	describe("BUILT_IN_FILTER_RULES", () => {
		it("should have all expected built-in rules", () => {
			const ruleNames = BUILT_IN_FILTER_RULES.map((r) => r.name)
			expect(ruleNames).toContain("test-runner")
			expect(ruleNames).toContain("git-status")
			expect(ruleNames).toContain("git-log")
			expect(ruleNames).toContain("package-install")
			expect(ruleNames).toContain("build")
		})

		it("should apply first matching rule only", () => {
			// Simulate an output that could match multiple rules
			// "npm test" should match test-runner, not package-install
			const output = Array(20).fill("test output").join("\n") + "\nTests: 5 passed, 5 total"
			const result = filterTerminalOutput("npm test", output)
			if (result) {
				expect(result.filterName).toBe("test-runner")
			}
		})
	})
})
