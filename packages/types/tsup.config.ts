import { defineConfig } from "tsup"

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["cjs", "esm"],
	dts: true,
	splitting: false,
	sourcemap: process.env.NODE_ENV !== "production",
	clean: true,
	outDir: "dist",
})
