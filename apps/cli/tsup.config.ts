import { defineConfig } from "tsup"

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	target: "node20",
	platform: "node",
	banner: {
		js: "#!/usr/bin/env node",
	},
	// Bundle these workspace packages that export TypeScript.
	noExternal: ["@roo-code/types", "@roo-code/vscode-shim"],
	external: [
		// Keep native modules external.
		"@anthropic-ai/sdk",
		"@anthropic-ai/bedrock-sdk",
		"@anthropic-ai/vertex-sdk",
	],
})
