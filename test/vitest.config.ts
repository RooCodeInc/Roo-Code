import { defineConfig } from "vitest/config"
import path from "path"

const root = path.resolve(__dirname, "..")

export default defineConfig({
	root,
	test: {
		globals: true,
		environment: "node",
		include: ["test/phase2/**/*.test.ts"],
		setupFiles: [path.join(root, "src/vitest.setup.ts")],
		testTimeout: 20_000,
		hookTimeout: 20_000,
	},
	resolve: {
		alias: {
			vscode: path.join(root, "src/__mocks__/vscode.js"),
		},
	},
})
