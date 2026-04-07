import { Box, Text } from "ink"
import type { TextProps } from "ink"

/**
 * Icon names supported by the Icon component.
 * Each icon has a Nerd Font glyph and an ASCII fallback.
 */
export type IconName =
	| "folder"
	| "file"
	| "file-edit"
	| "check"
	| "cross"
	| "arrow-right"
	| "bullet"
	| "spinner"
	// Tool-related icons
	| "search"
	| "terminal"
	| "browser"
	| "switch"
	| "question"
	| "gear"
	| "diff"
	// TODO-related icons
	| "checkbox"
	| "checkbox-checked"
	| "checkbox-progress"
	| "todo-list"

/**
 * Icon definitions with Nerd Font glyph and ASCII fallback.
 * Nerd Font glyphs are surrogate pairs (2 JS chars, 1 visual char).
 */
const ICONS: Record<IconName, { nerd: string; fallback: string }> = {
	folder: { nerd: "\uf413", fallback: "▼" },
	file: { nerd: "\uf4a5", fallback: "●" },
	"file-edit": { nerd: "\uf4d2", fallback: "✎" },
	check: { nerd: "\uf42e", fallback: "✓" },
	cross: { nerd: "\uf517", fallback: "✗" },
	"arrow-right": { nerd: "\uf432", fallback: "→" },
	bullet: { nerd: "\uf444", fallback: "•" },
	spinner: { nerd: "\uf4e3", fallback: "*" },
	// Tool-related icons
	search: { nerd: "\uf422", fallback: "🔍" },
	terminal: { nerd: "\uf489", fallback: "$" },
	browser: { nerd: "\uf488", fallback: "🌐" },
	switch: { nerd: "\uf443", fallback: "⇄" },
	question: { nerd: "\uf420", fallback: "?" },
	gear: { nerd: "\uf423", fallback: "⚙" },
	diff: { nerd: "\uf4d2", fallback: "±" },
	// TODO-related icons
	checkbox: { nerd: "\uf4aa", fallback: "○" }, // Empty checkbox
	"checkbox-checked": { nerd: "\uf4a4", fallback: "✓" }, // Checked checkbox
	"checkbox-progress": { nerd: "\uf4aa", fallback: "→" }, // In progress (dot circle)
	"todo-list": { nerd: "\uf45e", fallback: "☑" }, // List icon for TODO header
}

/**
 * Check if a string contains surrogate pairs (characters outside BMP).
 * Surrogate pairs have .length of 2 but render as 1 visual character.
 */
function containsSurrogatePair(str: string): boolean {
	// Surrogate pairs are in the range U+D800 to U+DFFF
	return /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(str)
}

/**
 * Detect if Nerd Font icons are likely supported.
 *
 * Users can override this with the JABBERWOCKCODE_NERD_FONT environment variable:
 * - JABBERWOCKCODE_NERD_FONT=0 to force ASCII fallbacks (if icons don't render correctly)
 * - JABBERWOCKCODE_NERD_FONT=1 to force Nerd Font icons
 *
 * Defaults to true because:
 * 1. Nerd Fonts are common in developer terminal setups
 * 2. Modern terminals handle missing glyphs gracefully
 * 3. Users can easily disable if icons don't render correctly
 */
function detectNerdFontSupport(): boolean {
	// Allow explicit override via environment variable
	const envOverride = process.env.JABBERWOCKCODE_NERD_FONT
	if (envOverride === "0" || envOverride === "false") return false
	if (envOverride === "1" || envOverride === "true") return true

	// Default to Nerd Font icons - they're common in developer setups
	// and users can set JABBERWOCKCODE_NERD_FONT=0 if needed
	return true
}

// Cache the detection result
let nerdFontSupported: boolean | null = null

/**
 * Get whether Nerd Font icons are supported (cached).
 */
export function isNerdFontSupported(): boolean {
	if (nerdFontSupported === null) {
		nerdFontSupported = detectNerdFontSupport()
	}
	return nerdFontSupported
}

/**
 * Reset the Nerd Font detection cache (useful for testing).
 */
export function resetNerdFontCache(): void {
	nerdFontSupported = null
}

export interface IconProps extends Omit<TextProps, "children"> {
	/** The icon to display */
	name: IconName
	/** Override the automatic Nerd Font detection */
	useNerdFont?: boolean
	/** Custom width for the icon container (default: 2) */
	width?: number
}

/**
 * Icon component that renders Nerd Font icons with ASCII fallbacks.
 *
 * Renders icons in a fixed-width Box to handle surrogate pair width
 * calculation issues in Ink. Surrogate pairs (like Nerd Font glyphs)
 * have .length of 2 in JavaScript but render as 1 visual character.
 *
 * @example
 * ```tsx
 * <Icon name="folder" color="blue" />
 * <Icon name="file" />
 * <Icon name="check" color="green" useNerdFont={false} />
 * ```
 */
export function Icon({ name, useNerdFont, width = 2, color, ...textProps }: IconProps) {
	const iconDef = ICONS[name]
	if (!iconDef) {
		return null
	}

	const shouldUseNerdFont = useNerdFont ?? isNerdFontSupported()
	const icon = shouldUseNerdFont ? iconDef.nerd : iconDef.fallback

	// Use fixed-width Box to isolate surrogate pair width calculation
	// from surrounding text. This prevents the off-by-one truncation bug.
	const needsWidthFix = containsSurrogatePair(icon)

	if (needsWidthFix) {
		return (
			<Box width={width}>
				<Text color={color} {...textProps}>
					{icon}
				</Text>
			</Box>
		)
	}

	// For BMP characters (no surrogate pairs), render directly
	return (
		<Text color={color} {...textProps}>
			{icon}
		</Text>
	)
}

/**
 * Get the raw icon character (useful for string concatenation).
 */
export function getIconChar(name: IconName, useNerdFont?: boolean): string {
	const iconDef = ICONS[name]
	if (!iconDef) return ""

	const shouldUseNerdFont = useNerdFont ?? isNerdFontSupported()
	return shouldUseNerdFont ? iconDef.nerd : iconDef.fallback
}
