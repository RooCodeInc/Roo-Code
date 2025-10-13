// import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import { Trans } from "react-i18next"

// import { buildDocLink } from "@src/utils/docLinks"
import { vscode } from "@/utils/vscode"
import { useCallback } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ZgsmCodeMode } from "@roo/modes"
import SectionDivider from "@/components/common/SectionDivider"
import { StandardTooltip } from "../ui"
import { Button } from "@/components/ui"

const tips = [
	{
		icon: "codicon-debug-all",
		click: (e?: any) => {
			e?.preventDefault()
			vscode.postMessage({
				type: "mode",
				text: "debug",
			})
		},
		disabled: true,
		titleKey: "rooTips.debug.title",
		descriptionKey: "rooTips.debug.description",
	},
	{
		icon: "codicon-book",
		click: (e: any) => {
			e.preventDefault()
			vscode.postMessage({
				type: "mode",
				text: "code",
			})
			// 调用 project-wiki 自定义指令
			vscode.postMessage({
				type: "newTask",
				text: "/test-guide",
				values: {
					checkProjectWiki: true,
				},
			})
		},
		titleKey: "rooTips.testGuide.title",
		descriptionKey: "rooTips.testGuide.description",
	},
	{
		icon: "codicon-book",
		click: (e: any) => {
			e.preventDefault()
			vscode.postMessage({
				type: "mode",
				text: "code",
			})
			// 调用 project-wiki 自定义指令
			vscode.postMessage({
				type: "newTask",
				text: "/project-wiki",
				values: {
					checkProjectWiki: true,
				},
			})
		},
		titleKey: "rooTips.projectWiki.title",
		descriptionKey: "rooTips.projectWiki.description",
	},
] as {
	icon: string
	href?: string
	click: (e?: any) => void
	titleKey: string
	disabled?: boolean
	descriptionKey: string
}[]
const RooTips = () => {
	const { t } = useTranslation("chat")
	const { t: tWelcome } = useTranslation("welcome")
	const { zgsmCodeMode, setZgsmCodeMode } = useExtensionState()
	const switchMode = useCallback(
		(slug: ZgsmCodeMode) => {
			setZgsmCodeMode(slug)
			vscode.postMessage({
				type: "zgsmCodeMode",
				text: slug,
			})
			vscode.postMessage({
				type: "mode",
				text: slug === "vibe" ? "code" : "strict",
			})
		},
		[setZgsmCodeMode],
	)

	const providers = [
		{
			name: "Vibe",
			slug: "vibe",
			description: tWelcome("vibe.description"),
			switchMode: (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
				e.stopPropagation()
				switchMode("vibe")
			},
		},
		{
			name: "Strict",
			slug: "strict",
			description: tWelcome("strict.description"),
			switchMode: (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
				e.stopPropagation()
				switchMode("strict")
			},
		},
	]
	return (
		<div className="relative">
			<p className="text-lg font-bold text-vscode-editor-foreground leading-tight font-vscode-font-family text-center text-balance max-w-[380px] mx-auto my-0">
				<Trans
					i18nKey="chat:about"
					components={{
						DocsLink: (
							<a href="https://costrict.ai/" target="_blank" rel="noopener noreferrer">
								the docs
							</a>
						),
					}}
				/>
			</p>
			<SectionDivider title={tWelcome("developmentMode")} icon="codicon-settings-gear" />
			<div className="flex flex-row sm:flex-row gap-4">
				{providers.map((provider, index) => (
					<div
						key={`${index}${provider.slug}`}
						onClick={provider.switchMode}
						className={`flex-1 border border-vscode-panel-border hover:bg-secondary rounded-md py-3 px-4 flex flex-row gap-3 cursor-pointer transition-all no-underline text-inherit ${zgsmCodeMode === provider.slug ? "border border-vscode-focusBorder outline outline-vscode-focusBorder focus-visible:ring-vscode-focusBorder" : ""}`}>
						<div>
							<div className="text-base font-bold text-vscode-foreground">{provider.name}</div>
							<div className="text-sm text-vscode-descriptionForeground">{provider.description}</div>
						</div>
					</div>
				))}
			</div>
			<SectionDivider title={tWelcome("commonFeatures")} icon="codicon-tools" />
			<div className="flex flex-row sm:flex-row gap-4">
				{tips.map((tip, index) => (
					<StandardTooltip key={`${index}${tip.titleKey}`} content={t(tip.descriptionKey)} maxWidth={200}>
						<Button variant="outline" onClick={tip.click}>
							{t(tip.titleKey)}
						</Button>
					</StandardTooltip>
				))}
			</div>
		</div>
	)
}

export default RooTips
