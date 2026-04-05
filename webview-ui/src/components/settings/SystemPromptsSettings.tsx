import { useState } from "react"
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import {
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	StandardTooltip,
} from "@src/components/ui"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"

const SYSTEM_PROMPT_SECTIONS = [
	{ id: "markdownRules", label: "Markdown Rules" },
	{ id: "toolUse", label: "Tool Use" },
	{ id: "capabilities", label: "Capabilities" },
	{ id: "modes", label: "Modes" },
	{ id: "rules", label: "Rules" },
	{ id: "systemInfo", label: "System Info" },
	{ id: "objective", label: "Objective" },
]

export const SystemPromptsSettings = () => {
	const { t } = useAppTranslation()
	const { systemPromptTemplates, setSystemPromptTemplates } = useExtensionState()
	const [activeSection, setActiveSection] = useState<string>("markdownRules")

	const handleUpdateTemplate = (value: string | undefined) => {
		const newTemplates = { ...systemPromptTemplates }
		if (!value) {
			delete newTemplates[activeSection]
		} else {
			newTemplates[activeSection] = value
		}

		setSystemPromptTemplates(newTemplates)

		vscode.postMessage({
			type: "updateSystemPromptTemplate",
			systemPromptTemplateKey: activeSection,
			systemPromptTemplate: value,
		})
	}

	const handleReset = () => {
		handleUpdateTemplate(undefined)
	}

	const currentValue = systemPromptTemplates?.[activeSection] || ""

	return (
		<div>
			<SectionHeader description="Customize the core sections of the system prompt. Note that replacing these sections overrides default Jabberwock behavior. Leave empty to use default.">
				System Prompt Templates
			</SectionHeader>

			<Section>
				<SearchableSetting settingId="system-prompt-templates-select" section="prompts" label="Select Section">
					<Select value={activeSection} onValueChange={(type) => setActiveSection(type)}>
						<SelectTrigger className="w-full" data-testid="system-prompt-section-select-trigger">
							<SelectValue placeholder={t("settings:common.select")} />
						</SelectTrigger>
						<SelectContent>
							{SYSTEM_PROMPT_SECTIONS.map((section) => (
								<SelectItem key={section.id} value={section.id}>
									{section.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</SearchableSetting>

				<div className="mt-4">
					<div className="flex justify-between items-center mb-1">
						<label className="block font-medium">Template</label>
						<StandardTooltip content="Reset to default">
							<Button variant="ghost" size="icon" onClick={handleReset}>
								<span className="codicon codicon-discard"></span>
							</Button>
						</StandardTooltip>
					</div>

					<VSCodeTextArea
						resize="vertical"
						value={currentValue}
						onInput={(e) => {
							const value =
								(e as unknown as CustomEvent)?.detail?.target?.value ??
								((e as any).target as HTMLTextAreaElement).value
							handleUpdateTemplate(value)
						}}
						rows={15}
						className="w-full"
						placeholder={`Enter custom template for ${activeSection}...`}
					/>
				</div>
			</Section>
		</div>
	)
}
