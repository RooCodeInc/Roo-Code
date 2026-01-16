import React, { useMemo } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import WarningRow from "./WarningRow"

/**
 * The maximum number of MCP tools recommended before warning the user.
 * Having too many tools can confuse LLMs and lead to errors.
 */
export const MAX_MCP_TOOLS_THRESHOLD = 40

/**
 * Displays a warning when the user has too many MCP tools enabled.
 * LLMs get confused when offered too many tools, which can lead to errors.
 *
 * The warning is shown when:
 * - The total number of enabled tools across all enabled MCP servers exceeds the threshold
 *
 * @example
 * <TooManyToolsWarning />
 */
export const TooManyToolsWarning: React.FC = () => {
	const { t } = useAppTranslation()
	const { mcpServers } = useExtensionState()

	const { enabledServerCount, enabledToolCount } = useMemo(() => {
		let serverCount = 0
		let toolCount = 0

		for (const server of mcpServers) {
			// Skip disabled servers
			if (server.disabled) continue

			// Skip servers that are not connected
			if (server.status !== "connected") continue

			serverCount++

			// Count enabled tools on this server
			if (server.tools) {
				for (const tool of server.tools) {
					// Tool is enabled if enabledForPrompt is undefined (default) or true
					if (tool.enabledForPrompt !== false) {
						toolCount++
					}
				}
			}
		}

		return { enabledServerCount: serverCount, enabledToolCount: toolCount }
	}, [mcpServers])

	// Don't show warning if under threshold
	if (enabledToolCount <= MAX_MCP_TOOLS_THRESHOLD) {
		return null
	}

	const message = t("chat:tooManyTools.message", {
		toolCount: enabledToolCount,
		serverCount: enabledServerCount,
		threshold: MAX_MCP_TOOLS_THRESHOLD,
	})

	return <WarningRow title={t("chat:tooManyTools.title")} message={message} />
}

export default TooManyToolsWarning
