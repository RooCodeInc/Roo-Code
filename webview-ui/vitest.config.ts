import { defineConfig } from "vitest/config"
import path from "path"
import { resolveVerbosity } from "../src/utils/vitest-verbosity"

const { silent, reporters, onConsoleLog } = resolveVerbosity()

export default defineConfig({
	test: {
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		watch: false,
		reporters,
		silent,
		environment: "jsdom",
		include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
		onConsoleLog,
		// Simplified environment options
		environmentOptions: {
			happyDom: {
				resources: "usable",
				runScripts: "dangerously",
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@src": path.resolve(__dirname, "./src"),
			"@roo": path.resolve(__dirname, "../src/shared"),
			// Mock the vscode module for tests since it's not available outside
			// VS Code extension context.
			vscode: path.resolve(__dirname, "./src/__mocks__/vscode.ts"),
		},
	},
	// Optimize dependencies for better performance
	optimizeDeps: {
		include: ["react", "react-dom", "react-dom/client", "react-i18next"],
		force: true,
	},
	// Ensure React is properly handled
	define: {
		"process.env.NODE_ENV": `"test"`,
	},
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
})
