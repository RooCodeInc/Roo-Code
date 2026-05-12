import js from "@eslint/js"
import tseslint from "@typescript-eslint/eslint-plugin"
import tsparser from "@typescript-eslint/parser"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import unusedImports from "eslint-plugin-unused-imports"

export default [
	js.configs.recommended,
	{
		files: ["src/**/*.{js,jsx,ts,tsx}"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				console: "readonly",
				document: "readonly",
				window: "readonly",
				process: "readonly",
				module: "readonly",
				require: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly",
				fetch: "readonly",
				URL: "readonly",
				HTMLElement: "readonly",
				HTMLDivElement: "readonly",
				Element: "readonly",
				Node: "readonly",
				NodeList: "readonly",
				Event: "readonly",
				KeyboardEvent: "readonly",
				MouseEvent: "readonly",
				CustomEvent: "readonly",
				localStorage: "readonly",
				sessionStorage: "readonly",
				navigator: "readonly",
				location: "readonly",
				history: "readonly",
				MutationObserver: "readonly",
				ResizeObserver: "readonly",
				IntersectionObserver: "readonly",
				requestAnimationFrame: "readonly",
				cancelAnimationFrame: "readonly",
				JSX: "readonly",
				SVGSVGElement: "readonly",
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
			react,
			"react-hooks": reactHooks,
			"unused-imports": unusedImports,
		},
		rules: {
			...tseslint.configs.recommended.rules,
			...react.configs.recommended.rules,
			...reactHooks.configs.recommended.rules,
			"react/react-in-jsx-scope": "off",
			"react/prop-types": "off",
			"@typescript-eslint/no-unused-vars": "warn",
			"@typescript-eslint/no-explicit-any": "warn",
			"no-unused-vars": "off",
		},
		settings: {
			react: {
				version: "detect",
			},
		},
	},
	{
		ignores: ["node_modules/**", "build/**", ".docusaurus/**"],
	},
]
