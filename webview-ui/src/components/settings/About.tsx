import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Info, Download, Upload } from "lucide-react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import type { TelemetrySetting } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type AboutProps = HTMLAttributes<HTMLDivElement> & {
	telemetrySetting: TelemetrySetting
	setTelemetrySetting: (setting: TelemetrySetting) => void
}

export const About = ({ telemetrySetting, setTelemetrySetting, className, ...props }: AboutProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description="Datacoves Copilot is a powerful AI assistant designed to enhance your coding experience. It's based on Roo Code, an open-source project that provides a robust foundation for AI-driven development tools.">
				<div className="flex items-center gap-2">
					<Info className="w-4" />
					<div>{t("settings:sections.about")}</div>
				</div>
			</SectionHeader>

			<Section>
				<VSCodeLink href="https://docs.datacoves.com/docs/how-tos/vs-code/datacoves-copilot/v2">
					Learn more about Datacoves Copilot
				</VSCodeLink>
				<h4>Settings file</h4>
				<div className="flex flex-wrap items-center gap-2 mt-2">
					<Button onClick={() => vscode.postMessage({ type: "exportSettings" })} className="w-28">
						<Upload className="p-0.5" />
						{t("settings:footer.settings.export")}
					</Button>
					<Button onClick={() => vscode.postMessage({ type: "importSettings" })} className="w-28">
						<Download className="p-0.5" />
						{t("settings:footer.settings.import")}
					</Button>
				</div>
			</Section>
		</div>
	)
}
