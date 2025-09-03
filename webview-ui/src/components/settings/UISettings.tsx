import { HTMLAttributes } from "react"
import React from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Monitor } from "lucide-react"

import { cn } from "@/lib/utils"

import { SectionHeader } from "./SectionHeader"

type UISettingsProps = HTMLAttributes<HTMLDivElement>

export const UISettings = ({ className, ...props }: UISettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description={t("settings:ui.description")}>
				<div className="flex items-center gap-2">
					<Monitor className="w-4" />
					<div>{t("settings:sections.ui")}</div>
				</div>
			</SectionHeader>
		</div>
	)
}
