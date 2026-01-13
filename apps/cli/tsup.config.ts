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
	// Bundle workspace packages and ESM-only npm dependencies to create a self-contained CLI
	noExternal: [
		// Workspace packages
		"@roo-code/core",
		"@roo-code/core/cli",
		"@roo-code/types",
		"@roo-code/vscode-shim",
		// ESM-only npm dependencies that need to be bundled
		"@agentclientprotocol/sdk",
		"p-wait-for",
		"zod",
	],
	external: [
		// Keep native modules external
		"@anthropic-ai/sdk",
		"@anthropic-ai/bedrock-sdk",
		"@anthropic-ai/vertex-sdk",
		// Keep @vscode/ripgrep external - we bundle the binary separately
		"@vscode/ripgrep",
		// Optional dev dependency of ink - not needed at runtime
		"react-devtools-core",
	],
	esbuildOptions(options) {
		// Enable JSX for React/Ink components
		options.jsx = "automatic"
		options.jsxImportSource = "react"
	},
})
