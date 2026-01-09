import { reasoningEffortsExtended } from "@roo-code/types"

export const DEFAULT_FLAG_OPTIONS = {
	mode: "code",
	reasoningEffort: "medium" as const,
	model: "anthropic/claude-opus-4.5",
}

export const REASONING_EFFORTS = [...reasoningEffortsExtended, "unspecified", "disabled"]

/**
 * Default timeout in seconds for auto-approving followup questions.
 * Used in both the TUI (App.tsx) and the extension host (extension-host.ts).
 */
export const FOLLOWUP_TIMEOUT_SECONDS = 60

export const ASCII_ROO = `  _,'   ___
 <__\\__/   \\
    \\_  /  _\\
      \\,\\ / \\\\
        //   \\\\
      ,/'     \`\\_,`

export const AUTH_BASE_URL = process.env.NODE_ENV === "production" ? "https://app.roocode.com" : "http://localhost:3000"

export const SDK_BASE_URL =
	process.env.NODE_ENV === "production" ? "https://cloud-api.roocode.com" : "http://localhost:3001"
