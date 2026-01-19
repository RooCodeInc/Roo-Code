import React from "react"
import { Sparkles } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SkillsTab } from "./SkillsTab"

export const SkillsSettings: React.FC = () => {
	const { t } = useAppTranslation()

	return (
		<div>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Sparkles className="w-4" />
					<div>{t("settings:sections.skills")}</div>
				</div>
			</SectionHeader>

			<Section>
				<SkillsTab />
			</Section>
		</div>
	)
}
