import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		watch: false,
	},
	resolve: {
		alias: {
			// `URL.pathname` is not a valid Windows filesystem path (it starts with `/C:/...`).
			// Use `fileURLToPath` so Vitest/Vite can resolve the mock consistently across platforms.
			vscode: fileURLToPath(new URL("./src/__mocks__/vscode.ts", import.meta.url)),
		},
	},
})
