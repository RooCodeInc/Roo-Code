import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		watch: false,
		testTimeout: 120_000, // 2m for integration tests.
		include: ["src/**/*.test.ts"],
	},
})
