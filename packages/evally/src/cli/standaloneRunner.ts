#!/usr/bin/env node
import * as path from "path"
import { pathToFileURL } from "url"

async function main() {
	const file = process.argv[2]
	if (!file) {
		console.error("Usage: standaloneRunner <test-file>")
		process.exit(1)
	}
	const absPath = path.resolve(process.cwd(), file)
	let mod
	try {
		mod = await import(pathToFileURL(absPath).toString())
	} catch (err) {
		console.error(`Failed to load test file: ${err}`)
		process.exit(1)
	}
	if (!mod.default || !mod.default.variables || typeof mod.default.tests !== "function") {
		console.error("Test file does not export a valid matrix test definition as default.")
		process.exit(1)
	}
	const { runMatrix } = await import("../runner/TestMatrixRunner")
	const results = await runMatrix(mod.default)
	console.log("\n--- MATRIX TEST RESULTS ---")
	for (const r of results) {
		const vdesc = JSON.stringify(r.variable)
		if (r.passed) {
			console.log(`PASS  [${vdesc}] [iteration: ${r.iteration}] ${r.testName}`)
		} else {
			console.log(`FAIL  [${vdesc}] [iteration: ${r.iteration}] ${r.testName}  Error: ${r.error}`)
		}
	}
	const suiteSummary = new Map()
	for (const r of results) {
		if (!suiteSummary.has(r.suite)) suiteSummary.set(r.suite, new Map())
		const testMap = suiteSummary.get(r.suite)
		if (!testMap.has(r.testName)) testMap.set(r.testName, new Map())
		const varKey = JSON.stringify(r.variable)
		const varMap = testMap.get(r.testName)
		if (!varMap.has(varKey)) varMap.set(varKey, { variable: r.variable, total: 0, passes: 0, fails: 0 })
		const counts = varMap.get(varKey)
		counts.total++
		if (r.passed) counts.passes++
		else counts.fails++
	}
	console.log("\n--- SUITE/TEST-LEVEL SUMMARY (Pass Rate per variable set, grouped by suite/test) ---")
	for (const [suite, testMap] of suiteSummary.entries()) {
		console.log(`Suite: ${suite}`)
		for (const [testName, varMap] of testMap.entries()) {
			console.log(`  Test: ${testName}`)
			for (const { variable, total, passes, fails } of varMap.values()) {
				const percent = ((passes / total) * 100).toFixed(1)
				console.log(
					`    Vars: ${JSON.stringify(variable)}\n      Pass: ${passes}/${total} (${percent}%)  Fail: ${fails}/${total}`,
				)
			}
		}
	}
	const passes = results.filter((r) => r.passed).length
	const fails = results.length - passes
	console.log(`\nGlobal summary: ${passes} passed, ${fails} failed, total ${results.length}`)
	process.exit(0)
}

main()
