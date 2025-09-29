import { reactConfig } from "@roo-code/config-eslint/react"

export default [
	...reactConfig,
	{
		ignores: [
			".docusaurus/**",
			"build/**",
			"static/**",
			"*.config.js",
			"*.config.ts",
			"*.config.mjs"
		]
	}
]