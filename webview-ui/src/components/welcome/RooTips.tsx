// import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import { delay } from "lodash-es"

// import { buildDocLink } from "@src/utils/docLinks"
import { vscode } from "@/utils/vscode"
import { useCallback } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ZgsmCodeMode } from "@roo/modes"
import SectionDivider from "@/components/common/SectionDivider"
import { StandardTooltip } from "../ui"
import { Button } from "@/components/ui"

const RooTips = () => {
	const { t } = useTranslation("chat")
	const { t: tWelcome } = useTranslation("welcome")
	const { t: tSettings } = useTranslation("settings")
	const { zgsmCodeMode, setZgsmCodeMode, apiConfiguration } = useExtensionState()
	const switchMode = useCallback(
		(slug: ZgsmCodeMode, forceMode?: string) => {
			setZgsmCodeMode(slug)
			vscode.postMessage({
				type: "zgsmCodeMode",
				text: slug,
			})
			vscode.postMessage({
				type: "mode",
				text: forceMode || (slug === "vibe" ? "code" : "strict"),
			})
		},
		[setZgsmCodeMode],
	)
	const apiProviderCheck = useCallback(
		(apiProvider: string) => {
			if (apiConfiguration.apiProvider === apiProvider) {
				return true
			}

			vscode.postMessage({
				type: "zgsmProviderTip",
				values: {
					tipType: "info",
					msg: tSettings("codebase.general.onlyCostrictProviderSupport"),
				},
			})

			return false
		},
		[apiConfiguration.apiProvider, tSettings],
	)

	const tips = [
		{
			click: (e: any) => {
				e.preventDefault()
				if (!apiProviderCheck("zgsm")) {
					return
				}

				switchMode("vibe", "code")
				delay(() => {
					vscode.postMessage({
						type: "newTask",
						text: "/project-wiki",
						// values: {
						// 	checkProjectWiki: true,
						// },
					})
				}, 300)
			},
			titleKey: "rooTips.projectWiki.title",
			descriptionKey: "rooTips.projectWiki.description",
		},
		{
			click: (e: any) => {
				e.preventDefault()
				if (!apiProviderCheck("zgsm")) {
					return
				}
				switchMode("strict", "testguide")
				delay(() => {
					vscode.postMessage({
						type: "newTask",
						text: t("rooTips.testGuide.initPrompt"),
						// values: {
						// 	checkProjectWiki: true,
						// },
					})
				}, 300)
			},
			titleKey: "rooTips.testGuide.title",
			descriptionKey: "rooTips.testGuide.description",
		},
		{
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
	] as {
		icon: string
		href?: string
		click: (e?: any) => void
		titleKey: string
		disabled?: boolean
		descriptionKey: string
	}[]

	const providers = [
		{
			name: "Vibe",
			type: "divider",
			layout: "full",
			align: "center",
		},
		{
			name: "Vibe",
			slug: "vibe",
			description: tWelcome("vibe.description"),
			switchMode: (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
				e.stopPropagation()
				switchMode("vibe")
			},
			layout: "full",
		},
		{
			name: "Strict",
			type: "divider",
			layout: "full",
			align: "center",
		},
		{
			name: "Plan",
			slug: "plan",
			description: tWelcome("plan.description"),
			switchMode: (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
				e.stopPropagation()
				if (!apiProviderCheck("zgsm")) {
					return
				}
				switchMode("plan", "plan")
			},
			layout: "half",
		},
		{
			name: "Spec",
			slug: "strict",
			description: tWelcome("strict.description"),
			switchMode: (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
				e.stopPropagation()
				if (!apiProviderCheck("zgsm")) {
					return
				}
				switchMode("strict")
			},
			layout: "half",
		},
	] as {
		name: string
		slug: ZgsmCodeMode
		description: string
		switchMode: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void
		layout: "full" | "half"
		type?: "divider"
		align?: "center"
	}[]

	return (
		<div className="relative">
			<SectionDivider title={tWelcome("developmentMode")} icon="codicon-settings-gear" hideLine />
			<div className="flex flex-row flex-wrap gap-1">
				{providers.map((provider, index) => {
					const isFull = provider.layout === "full"
					const isHalf = provider.layout === "half"

					return provider.type === "divider" ? (
						<SectionDivider title={provider.name} icon="" className="w-full" align={provider.align} />
					) : (
						<div
							key={`${index}${provider.slug}`}
							onClick={provider.switchMode}
							className={[
								"inline-flex border border-vscode-panel-border hover:bg-secondary rounded-md py-3 px-4 flex-row cursor-pointer transition-all no-underline text-inherit",
								zgsmCodeMode === provider.slug
									? "border border-vscode-focusBorder outline outline-vscode-focusBorder focus-visible:ring-vscode-focusBorder"
									: "",
								isFull ? "w-full" : "",
								isHalf ? "w-[calc(50%-0.5rem)]" : "",
							]
								.filter(Boolean)
								.join(" ")}>
							<div>
								<div className="text-base font-bold text-vscode-foreground">{provider.name}</div>
								<div className="text-sm text-vscode-descriptionForeground">{provider.description}</div>
							</div>
						</div>
					)
				})}
			</div>
			<SectionDivider title={tWelcome("commonFeatures")} icon="codicon-tools" />
			<div className="flex flex-wrap gap-3">
				{tips.map((tip, index) => (
					<StandardTooltip key={`${index}${tip.titleKey}`} content={t(tip.descriptionKey)} maxWidth={200}>
						<Button variant="outline" onClick={tip.click} className="flex-shrink-0">
							{t(tip.titleKey)}
						</Button>
					</StandardTooltip>
				))}
			</div>
		</div>
	)
}

export default RooTips
