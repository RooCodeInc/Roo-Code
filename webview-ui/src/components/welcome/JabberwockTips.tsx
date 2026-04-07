import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import { Trans } from "react-i18next"

import { buildDocLink } from "@src/utils/docLinks"
import { ReplaceAll, Users } from "lucide-react"

const tips = [
	{
		icon: <Users className="size-4 shrink-0 mt-0.5" />,
		href: buildDocLink("basic-usage/using-modes", "tips"),
		titleKey: "jabberwockTips.customizableModes.title",
		descriptionKey: "jabberwockTips.customizableModes.description",
	},
	{
		icon: <ReplaceAll className="size-4 shrink-0 mt-0.5" />,
		href: buildDocLink("getting-started/connecting-api-provider", "tips"),
		titleKey: "jabberwockTips.modelAgnostic.title",
		descriptionKey: "jabberwockTips.modelAgnostic.description",
	},
]

const JabberwockTips = () => {
	const { t } = useTranslation("chat")

	return (
		<div className="flex flex-col gap-2 mb-4 max-w-[500px] text-vscode-descriptionForeground">
			<p className="my-0 pr-2">
				<Trans i18nKey="chat:about" />
			</p>
			<div className="gap-4">
				{tips.map((tip) => (
					<div key={tip.titleKey} className="flex items-start gap-2 mt-2 mr-6 leading-relaxed">
						{tip.icon}
						<span>
							<VSCodeLink className="text-muted-foreground underline" href={tip.href}>
								{t(tip.titleKey)}
							</VSCodeLink>
							: {t(tip.descriptionKey)}
						</span>
					</div>
				))}
			</div>
			<p className="my-0 pr-8">
				<Trans
					i18nKey="chat:docs"
					components={{
						DocsLink: (
							<VSCodeLink
								className="text-muted-foreground underline"
								href={buildDocLink("", "welcome")}
							/>
						),
					}}
				/>
			</p>
		</div>
	)
}

export default JabberwockTips
