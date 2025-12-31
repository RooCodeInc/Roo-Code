import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import { Trans } from "react-i18next"

import { ReplaceAll, Users } from "lucide-react"

const tips = [
	{
		icon: <Users className="size-4 shrink-0 mt-0.5" />,
		titleKey: "rooTips.customizableModes.title",
		descriptionKey: "rooTips.customizableModes.description",
	},
	{
		icon: <ReplaceAll className="size-4 shrink-0 mt-0.5" />,
		titleKey: "rooTips.modelAgnostic.title",
		descriptionKey: "rooTips.modelAgnostic.description",
	},
]

const RooTips = () => {
	const { t } = useTranslation("chat")

	return (
		<div className="flex flex-col items-center gap-4 mb-4 w-full text-vscode-descriptionForeground">
			<p className="my-0 text-center text-base">
				<Trans
					i18nKey="chat:about"
					components={{
						DocsLink: (
							<VSCodeLink
								className="text-muted-foreground underline"
								href="https://docs.datacoves.com/docs/how-tos/vs-code/datacoves-copilot/v2"
							/>
						),
					}}
				/>
			</p>
			<div className="flex flex-col gap-3 mt-2">
				{tips.map((tip) => (
					<div key={tip.titleKey} className="flex items-start gap-3 leading-relaxed text-base">
						<span className="mt-0.5">{tip.icon}</span>
						<span>
							<strong>{t(tip.titleKey)}</strong>: {t(tip.descriptionKey)}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}

export default RooTips
