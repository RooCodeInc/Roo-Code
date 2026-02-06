#!/usr/bin/env bun

/**
 * Build script for the SolidJS/opentui TUI.
 *
 * Uses Bun.build with the solid plugin to properly transform SolidJS JSX.
 *
 * Usage:
 *   cd apps/cli && bun scripts/build-ui-next.ts
 *
 * Output:
 *   dist/ui-next/main.js
 */

import solidPlugin from "../node_modules/@opentui/solid/scripts/solid-plugin"
import path from "path"

const dir = path.resolve(import.meta.dir, "..")

process.chdir(dir)

const result = await Bun.build({
	entrypoints: ["./src/ui-next/main.tsx"],
	outdir: "./dist/ui-next",
	target: "bun",
	plugins: [solidPlugin],
	external: [
		// Keep native modules external
		"@vscode/ripgrep",
		"@anthropic-ai/sdk",
		"@anthropic-ai/bedrock-sdk",
		"@anthropic-ai/vertex-sdk",
	],
	sourcemap: "external",
})

if (!result.success) {
	console.error("Build failed:")
	for (const msg of result.logs) {
		console.error(msg)
	}
	process.exit(1)
}

console.log(`Build succeeded: ${result.outputs.length} outputs`)
for (const output of result.outputs) {
	const size = output.size
	const sizeStr =
		size > 1024 * 1024
			? `${(size / (1024 * 1024)).toFixed(2)} MB`
			: size > 1024
				? `${(size / 1024).toFixed(2)} KB`
				: `${size} B`

	console.log(`  ${path.relative(dir, output.path)} (${sizeStr})`)
}
