import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import { Trans } from "react-i18next"

import { buildDocLink } from "@src/utils/docLinks"
import { ListTree, Users } from "lucide-react"

const tips = [
	{
		icon: <Users className="size-4 shrink-0 mt-0.5" />,
		href: buildDocLink("basic-usage/using-modes", "tips"),
		titleKey: "rooTips.customizableModes.title",
		descriptionKey: "rooTips.customizableModes.description",
	},
	{
		icon: <ListTree className="size-4 shrink-0 mt-0.5" />,
		href: buildDocLink("features/boomerang-tasks", "tips"),
		titleKey: "rooTips.boomerangTasks.title",
		descriptionKey: "rooTips.boomerangTasks.description",
	},
]

const RooTips = () => {
	const { t } = useTranslation("chat")

	return (
		<div className="flex flex-col gap-2 mb-4 max-w-[450px]font-light text-vscode-descriptionForeground">
			<p className="my-0 pr-8">
				<Trans
					i18nKey="chat:about"
					components={{
						DocsLink: (
							<a href={buildDocLink("", "welcome")} target="_blank" rel="noopener noreferrer">
								the docs
							</a>
						),
					}}
				/>
			</p>
			<div className="gap-4">
				{tips.map((tip) => (
					<div key={tip.titleKey} className="flex items-start gap-2 mt-2 mr-6">
						{tip.icon}
						<span>
							<VSCodeLink
								className="text-vscode-editor-foreground underline forced-color-adjust-none"
								href={tip.href}>
								{t(tip.titleKey)}
							</VSCodeLink>
							: {t(tip.descriptionKey)}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}

export default RooTips
