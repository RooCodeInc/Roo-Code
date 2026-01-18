import React, { useCallback, useMemo } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { MAX_MCP_TOOLS_THRESHOLD } from "@roo-code/types"
import WarningRow from "./WarningRow"

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

	const handleOpenMcpSettings = useCallback(() => {
		window.postMessage({ type: "action", action: "settingsButtonClicked", values: { section: "mcp" } }, "*")
	}, [])

	// Don't show warning if under threshold
	if (enabledToolCount <= MAX_MCP_TOOLS_THRESHOLD) {
		return null
	}

	const toolsPart = t("chat:tooManyTools.toolsPart", { count: enabledToolCount })
	const serversPart = t("chat:tooManyTools.serversPart", { count: enabledServerCount })
	const message = t("chat:tooManyTools.messageTemplate", {
		tools: toolsPart,
		servers: serversPart,
		threshold: MAX_MCP_TOOLS_THRESHOLD,
	})

	return (
		<WarningRow
			title={t("chat:tooManyTools.title")}
			message={message}
			actionText={t("chat:tooManyTools.openMcpSettings")}
			onAction={handleOpenMcpSettings}
		/>
	)
}

export default TooManyToolsWarning
