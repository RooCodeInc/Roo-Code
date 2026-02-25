import { reasoningEffortsExtended } from "@roo-code/types"

export const DEFAULT_FLAGS = {
	mode: "code",
	reasoningEffort: "medium" as const,
	model: "anthropic/claude-opus-4.6",
}

export const REASONING_EFFORTS = [...reasoningEffortsExtended, "unspecified", "disabled"]

/**
 * Default timeout in seconds for auto-approving followup questions.
 * Used in both the TUI (App.tsx) and the extension host (extension-host.ts).
 */
export const FOLLOWUP_TIMEOUT_SECONDS = 60

export const ASCII_JOE = `
     _     _
    | |___| |   Joe AI
    | / _ \\ |
    | \\___/ |
    |_|   |_|
`

export const ASCII_ROO = ASCII_JOE

export const AUTH_BASE_URL = process.env.ROO_AUTH_BASE_URL ?? "https://app.joe-code.dev"

export const SDK_BASE_URL = process.env.ROO_SDK_BASE_URL ?? "https://cloud-api.joe-code.dev"
