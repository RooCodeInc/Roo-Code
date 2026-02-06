/**
 * Theme provider for the SolidJS/opentui TUI.
 * Provides a hardcoded "hardcore" theme matching the current CLI look.
 * Can be extended to support JSON theme files from OpenCode.
 */

import { RGBA } from "@opentui/core"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper.js"

export interface ThemeColors {
	primary: RGBA
	secondary: RGBA
	accent: RGBA
	error: RGBA
	warning: RGBA
	success: RGBA
	info: RGBA
	text: RGBA
	textMuted: RGBA
	background: RGBA
	backgroundPanel: RGBA
	backgroundElement: RGBA
	border: RGBA
	borderActive: RGBA
	borderSubtle: RGBA
	diffAdded: RGBA
	diffRemoved: RGBA
	syntaxKeyword: RGBA
	syntaxFunction: RGBA
	syntaxString: RGBA
	syntaxComment: RGBA
	// Roo-specific semantic colors
	userHeader: RGBA
	rooHeader: RGBA
	toolHeader: RGBA
	thinkingHeader: RGBA
	userText: RGBA
	rooText: RGBA
	toolText: RGBA
	thinkingText: RGBA
	promptColor: RGBA
	promptColorActive: RGBA
	placeholderColor: RGBA
	dimText: RGBA
	scrollActiveColor: RGBA
	scrollTrackColor: RGBA
	titleColor: RGBA
	asciiColor: RGBA
	tipsHeader: RGBA
	tipsText: RGBA
}

/** The Hardcore palette - matching current theme.ts */
const hardcore: ThemeColors = {
	primary: RGBA.fromHex("#FD971F"),
	secondary: RGBA.fromHex("#9E6FFE"),
	accent: RGBA.fromHex("#66D9EF"),
	error: RGBA.fromHex("#F92672"),
	warning: RGBA.fromHex("#E6DB74"),
	success: RGBA.fromHex("#A6E22E"),
	info: RGBA.fromHex("#66D9EF"),
	text: RGBA.fromHex("#F8F8F2"),
	textMuted: RGBA.fromHex("#A3BABF"),
	background: RGBA.fromHex("#1B1D1E"),
	backgroundPanel: RGBA.fromHex("#2d2e2e"),
	backgroundElement: RGBA.fromHex("#383a3e"),
	border: RGBA.fromHex("#383a3e"),
	borderActive: RGBA.fromHex("#9E6FFE"),
	borderSubtle: RGBA.fromHex("#505354"),
	diffAdded: RGBA.fromHex("#A6E22E"),
	diffRemoved: RGBA.fromHex("#F92672"),
	syntaxKeyword: RGBA.fromHex("#F92672"),
	syntaxFunction: RGBA.fromHex("#A6E22E"),
	syntaxString: RGBA.fromHex("#E6DB74"),
	syntaxComment: RGBA.fromHex("#5E7175"),
	// Roo-specific
	userHeader: RGBA.fromHex("#9E6FFE"),
	rooHeader: RGBA.fromHex("#E6DB74"),
	toolHeader: RGBA.fromHex("#66D9EF"),
	thinkingHeader: RGBA.fromHex("#5E7175"),
	userText: RGBA.fromHex("#F8F8F2"),
	rooText: RGBA.fromHex("#F8F8F2"),
	toolText: RGBA.fromHex("#A3BABF"),
	thinkingText: RGBA.fromHex("#A3BABF"),
	promptColor: RGBA.fromHex("#A3BABF"),
	promptColorActive: RGBA.fromHex("#66D9EF"),
	placeholderColor: RGBA.fromHex("#505354"),
	dimText: RGBA.fromHex("#5E7175"),
	scrollActiveColor: RGBA.fromHex("#9E6FFE"),
	scrollTrackColor: RGBA.fromHex("#383a3e"),
	titleColor: RGBA.fromHex("#FD971F"),
	asciiColor: RGBA.fromHex("#66D9EF"),
	tipsHeader: RGBA.fromHex("#FD971F"),
	tipsText: RGBA.fromHex("#A3BABF"),
}

export const THEMES: Record<string, ThemeColors> = {
	hardcore,
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
	name: "Theme",
	init: () => {
		const [themeName, setThemeName] = createStore({ name: "hardcore" })

		return {
			get theme() {
				return THEMES[themeName.name] ?? hardcore
			},
			get name() {
				return themeName.name
			},
			setTheme(name: string) {
				if (THEMES[name]) {
					setThemeName("name", name)
				}
			},
			themes: Object.keys(THEMES),
		}
	},
})
