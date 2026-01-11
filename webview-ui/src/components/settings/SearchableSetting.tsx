import { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

import { SectionName } from "./SettingsView"

interface SearchableSettingProps extends HTMLAttributes<HTMLDivElement> {
	/**
	 * Unique identifier for this setting.
	 * Used for finding the element after tab navigation.
	 */
	settingId: string
	/**
	 * The section/tab this setting belongs to.
	 * Used for navigation when the setting is selected from search results.
	 */
	section: SectionName
	/**
	 * The label text for this setting, used for search matching.
	 * This should be the translated label text.
	 */
	label: string
	children: React.ReactNode
}

/**
 * Wrapper component that marks a setting as searchable.
 *
 * The search system scans the DOM for elements with `data-searchable` attribute
 * and reads the metadata from data attributes to build the search index.
 *
 * @example
 * ```tsx
 * <SearchableSetting
 *   settingId="browser-enable"
 *   section="browser"
 *   label={t("settings:browser.enable.label")}
 * >
 *   <VSCodeCheckbox>
 *     <span className="font-medium">{t("settings:browser.enable.label")}</span>
 *   </VSCodeCheckbox>
 *   <div className="text-vscode-descriptionForeground text-sm">
 *     {t("settings:browser.enable.description")}
 *   </div>
 * </SearchableSetting>
 * ```
 */
export function SearchableSetting({
	settingId,
	section,
	label,
	children,
	className,
	...props
}: SearchableSettingProps) {
	return (
		<div
			data-searchable
			data-setting-id={settingId}
			data-setting-section={section}
			data-setting-label={label}
			className={cn(className)}
			{...props}>
			{children}
		</div>
	)
}
