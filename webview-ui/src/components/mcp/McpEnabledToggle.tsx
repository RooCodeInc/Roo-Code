import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { Checkbox } from "@/components/ui/checkbox"

const McpEnabledToggle = () => {
	const { mcpEnabled, setMcpEnabled } = useExtensionState()
	const { t } = useAppTranslation()

	const handleChange = (checked: boolean) => {
		setMcpEnabled(checked)
		vscode.postMessage({ type: "mcpEnabled", bool: checked })
	}

	return (
		<div style={{ marginBottom: "20px" }}>
			<div className="flex items-center space-x-2">
				<Checkbox checked={mcpEnabled} onCheckedChange={handleChange} />
				<span style={{ fontWeight: "500" }}>{t("mcp:enableToggle.title")}</span>
			</div>
			<p
				style={{
					fontSize: "calc(12px * var(--roo-font-size-multiplier, 1))",
					marginTop: "5px",
					color: "var(--vscode-descriptionForeground)",
				}}>
				{t("mcp:enableToggle.description")}
			</p>
		</div>
	)
}

export default McpEnabledToggle
