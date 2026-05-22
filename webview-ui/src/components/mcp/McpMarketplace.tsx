import React, { useState } from "react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { mcpMarketplaceCatalog, type McpMarketplaceItem } from "../../../../src/shared/mcpMarketplaceCatalog"

const McpMarketplace = () => {
	const { mcpServers: servers } = useExtensionState()
	const { t } = useAppTranslation()

	const installedServerNames = new Set(servers.map((s) => s.name))

	return (
		<div style={{ marginTop: "15px" }}>
			<div
				style={{
					fontWeight: 500,
					fontSize: "13px",
					color: "var(--vscode-foreground)",
					marginBottom: "6px",
				}}>
				{t("mcp:marketplace.title")}
			</div>
			<div
				style={{
					fontSize: "12px",
					color: "var(--vscode-descriptionForeground)",
					marginBottom: "10px",
				}}>
				{t("mcp:marketplace.description")}
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				{mcpMarketplaceCatalog.map((item) => (
					<MarketplaceRow key={item.name} item={item} isInstalled={installedServerNames.has(item.name)} />
				))}
			</div>
		</div>
	)
}

const MarketplaceRow = ({ item, isInstalled }: { item: McpMarketplaceItem; isInstalled: boolean }) => {
	const { t } = useAppTranslation()
	const [envValues, setEnvValues] = useState<Record<string, string>>(() => {
		const initial: Record<string, string> = {}
		if (item.setupEnvKeys) {
			for (const key of item.setupEnvKeys) {
				initial[key] = item.config.env?.[key] ?? ""
			}
		}
		return initial
	})

	const handleInstall = () => {
		const config = { ...item.config }
		if (item.requiresSetup && item.setupEnvKeys) {
			config.env = { ...config.env }
			for (const key of item.setupEnvKeys) {
				if (envValues[key]) {
					config.env[key] = envValues[key]
				}
			}
		}
		vscode.postMessage({
			type: "installMcpServer",
			serverName: item.name,
			config,
		})
	}

	return (
		<div
			className="rounded bg-vscode-textCodeBlock-background p-2"
			style={{
				opacity: isInstalled ? 0.6 : 1,
			}}>
			<div className="flex items-center justify-between gap-2">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1.5">
						<span className="codicon codicon-search text-xs" />
						<span className="font-medium text-[13px] text-vscode-foreground">{item.displayName}</span>
						{item.requiresSetup && (
							<span
								className="text-[10px] px-1 py-0.5 rounded"
								style={{
									background: "var(--vscode-editorWarning-foreground)",
									color: "var(--vscode-editor-background)",
								}}
								title={t("mcp:marketplace.requiresSetupHint", {
									keys: item.setupEnvKeys?.join(", ") ?? "",
								})}>
								{t("mcp:marketplace.requiresSetup")}
							</span>
						)}
					</div>
					<div className="text-xs text-vscode-descriptionForeground mt-0.5">{item.description}</div>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					{item.url && (
						<VSCodeLink href={item.url} style={{ fontSize: "11px" }}>
							{t("mcp:marketplace.learnMore")}
						</VSCodeLink>
					)}
					<Button
						variant="secondary"
						disabled={isInstalled}
						onClick={handleInstall}
						style={{ minWidth: "60px", fontSize: "12px" }}>
						{isInstalled ? (
							<>
								<span className="codicon codicon-check mr-1" />
								Added
							</>
						) : (
							<>
								<span className="codicon codicon-add mr-1" />
								{t("mcp:marketplace.install")}
							</>
						)}
					</Button>
				</div>
			</div>
			{item.requiresSetup && item.setupEnvKeys && !isInstalled && (
				<div className="mt-2 flex flex-col gap-1.5">
					{item.setupEnvKeys.map((key) => (
						<div key={key} className="flex items-center gap-2">
							<label
								className="text-[11px] text-vscode-descriptionForeground shrink-0"
								style={{ minWidth: "90px" }}>
								{key}:
							</label>
							<input
								type="text"
								value={envValues[key] ?? ""}
								onChange={(e) =>
									setEnvValues((prev) => ({
										...prev,
										[key]: e.target.value,
									}))
								}
								placeholder={item.config.env?.[key] ?? ""}
								className="flex-1 rounded px-1.5 py-0.5 text-xs"
								style={{
									background: "var(--vscode-input-background)",
									color: "var(--vscode-input-foreground)",
									border: "1px solid var(--vscode-input-border, transparent)",
								}}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default McpMarketplace
