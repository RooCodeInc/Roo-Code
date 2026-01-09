import React from "react"
import { Trans } from "react-i18next"
import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Webhook } from "lucide-react"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button, StandardTooltip } from "@src/components/ui"
import { buildDocLink } from "@src/utils/docLinks"
import { Section } from "@src/components/settings/Section"
import { SectionHeader } from "@src/components/settings/SectionHeader"

import McpEnabledToggle from "./McpEnabledToggle"
import MCPServerRow from "./MCPServerRow"

const McpView = () => {
	const {
		mcpServers: servers,
		alwaysAllowMcp,
		mcpEnabled,
		enableMcpServerCreation,
		setEnableMcpServerCreation,
	} = useExtensionState()

	const { t } = useAppTranslation()

	return (
		<div>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Webhook className="w-4" />
					<div>{t("mcp:title")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div
					style={{
						color: "var(--vscode-foreground)",
						fontSize: "13px",
						marginBottom: "10px",
						marginTop: "5px",
					}}>
					<Trans i18nKey="mcp:description">
						<VSCodeLink
							href={buildDocLink("features/mcp/using-mcp-in-roo", "mcp_settings")}
							style={{ display: "inline" }}>
							Learn More
						</VSCodeLink>
					</Trans>
				</div>

				<McpEnabledToggle />

				{mcpEnabled && (
					<>
						<div style={{ marginBottom: 15 }}>
							<VSCodeCheckbox
								checked={enableMcpServerCreation}
								onChange={(e: any) => {
									setEnableMcpServerCreation(e.target.checked)
									vscode.postMessage({ type: "enableMcpServerCreation", bool: e.target.checked })
								}}>
								<span style={{ fontWeight: "500" }}>{t("mcp:enableServerCreation.title")}</span>
							</VSCodeCheckbox>
							<div
								style={{
									fontSize: "12px",
									marginTop: "5px",
									color: "var(--vscode-descriptionForeground)",
								}}>
								<Trans i18nKey="mcp:enableServerCreation.description">
									<VSCodeLink
										href={buildDocLink(
											"features/mcp/using-mcp-in-roo#how-to-use-roo-to-create-an-mcp-server",
											"mcp_server_creation",
										)}
										style={{ display: "inline" }}>
										Learn about server creation
									</VSCodeLink>
									<strong>new</strong>
								</Trans>
								<p style={{ marginTop: "8px" }}>{t("mcp:enableServerCreation.hint")}</p>
							</div>
						</div>

						{/* Server List */}
						{servers.length > 0 && (
							<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
								{servers.map((server) => (
									<MCPServerRow
										key={`${server.name}-${server.source || "global"}`}
										server={server}
										alwaysAllowMcp={alwaysAllowMcp}
									/>
								))}
							</div>
						)}

						{/* Edit Settings Buttons */}
						<div
							style={{
								marginTop: "10px",
								width: "100%",
								display: "grid",
								gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
								gap: "10px",
							}}>
							<Button
								variant="secondary"
								style={{ width: "100%" }}
								onClick={() => {
									vscode.postMessage({ type: "openMcpSettings" })
								}}>
								<span className="codicon codicon-edit" style={{ marginRight: "6px" }}></span>
								{t("mcp:editGlobalMCP")}
							</Button>
							<Button
								variant="secondary"
								style={{ width: "100%" }}
								onClick={() => {
									vscode.postMessage({ type: "openProjectMcpSettings" })
								}}>
								<span className="codicon codicon-edit" style={{ marginRight: "6px" }}></span>
								{t("mcp:editProjectMCP")}
							</Button>
							<Button
								variant="secondary"
								style={{ width: "100%" }}
								onClick={() => {
									vscode.postMessage({ type: "refreshAllMcpServers" })
								}}>
								<span className="codicon codicon-refresh" style={{ marginRight: "6px" }}></span>
								{t("mcp:refreshMCP")}
							</Button>
							<StandardTooltip content={t("mcp:marketplace")}>
								<Button
									variant="secondary"
									style={{ width: "100%" }}
									onClick={() => {
										window.postMessage(
											{
												type: "action",
												action: "marketplaceButtonClicked",
												values: { marketplaceTab: "mcp" },
											},
											"*",
										)
									}}>
									<span className="codicon codicon-extensions" style={{ marginRight: "6px" }}></span>
									{t("mcp:marketplace")}
								</Button>
							</StandardTooltip>
						</div>
						<div
							style={{
								marginTop: "15px",
								fontSize: "12px",
								color: "var(--vscode-descriptionForeground)",
							}}>
							<VSCodeLink
								href={buildDocLink(
									"features/mcp/using-mcp-in-roo#editing-mcp-settings-files",
									"mcp_edit_settings",
								)}
								style={{ display: "inline" }}>
								{t("mcp:learnMoreEditingSettings")}
							</VSCodeLink>
						</div>
					</>
				)}
			</Section>
		</div>
	)
}

export default McpView
