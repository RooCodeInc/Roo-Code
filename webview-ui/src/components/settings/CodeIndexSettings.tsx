import React, { useCallback } from "react"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import type { ExtensionStateContextType } from "@src/context/ExtensionStateContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui/select"
import { Button, StandardTooltip } from "@src/components/ui"
import { Section } from "./Section"
import { SectionHeader } from "./SectionHeader"
import { SetCachedStateField } from "./types"

type CodeIndexMode = "auto" | "normal" | "lowResource"

type Props = {
	mode: CodeIndexMode
	maxParallelFileReads: number
	maxParallelEmbeddings: number
	chunkSizeTokens: number
	enableBuiltInIgnore: boolean
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

/**
 * UI for managing code indexing performance profile.
 * Wraps rooCode.codeIndex.* settings:
 * - mode: auto / normal / lowResource
 * - maxParallelFileReads
 * - maxParallelEmbeddings
 * - chunkSizeTokens
 * - enableBuiltInIgnore
 */
export const CodeIndexSettings: React.FC<Props> = ({
	mode,
	maxParallelFileReads,
	maxParallelEmbeddings,
	chunkSizeTokens,
	enableBuiltInIgnore,
	setCachedStateField,
}) => {
	const { t } = useTranslation("settings")

	const applyRecommended = useCallback(
		(targetMode: CodeIndexMode) => {
			setCachedStateField("codeIndexMode", targetMode)

			if (targetMode === "lowResource") {
				// Profile for weak machines / local models (including your i5)
				setCachedStateField("codeIndexMaxParallelFileReads", 3 as any)
				setCachedStateField("codeIndexMaxParallelEmbeddings", 1 as any)
				setCachedStateField("codeIndexChunkSizeTokens", 512 as any)
				setCachedStateField("codeIndexEnableBuiltInIgnore", true as any)
			} else if (targetMode === "normal") {
				// Standard profile for normal machines
				setCachedStateField("codeIndexMaxParallelFileReads", 12 as any)
				setCachedStateField("codeIndexMaxParallelEmbeddings", 4 as any)
				setCachedStateField("codeIndexChunkSizeTokens", 2048 as any)
				setCachedStateField("codeIndexEnableBuiltInIgnore", true as any)
			}
		},
		[setCachedStateField],
	)

	const handleModeChange = useCallback(
		(value: CodeIndexMode) => {
			setCachedStateField("codeIndexMode", value)

			// Automatically apply presets when mode is changed
			applyRecommended(value)
		},
		[setCachedStateField, applyRecommended],
	)

	const handleNumberChange = useCallback(
		(key: keyof ExtensionStateContextType, raw: string, fallback: number, min: number, max?: number) => {
			const parsed = Number(raw)
			if (Number.isNaN(parsed)) {
				setCachedStateField(key, fallback)
				return
			}
			const clamped = Math.max(min, max !== undefined ? Math.min(parsed, max) : parsed)
			setCachedStateField(key, clamped as any)
		},
		[setCachedStateField],
	)

	return (
		<Section className="flex flex-col gap-3">
			<SectionHeader
				description={t("codeIndex.description", {
					defaultValue:
						"Configure how aggressively Roo indexes your codebase so that indexing does not freeze your editor or local embedding models.",
				})}>
				<div className="flex items-center gap-2">
					<div>{t("settings:sections.codeIndex") || "Code Index"}</div>
				</div>
			</SectionHeader>

			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-4">
					<div className="flex flex-col gap-1">
						<div className="font-medium">
							{t("codeIndex.mode.label", {
								defaultValue: "Indexing mode",
							})}
						</div>
						<div className="text-sm text-vscode-descriptionForeground">
							{t("codeIndex.mode.description", {
								defaultValue:
									"Auto detects your machine and chooses safe limits. Low resource keeps indexing lightweight for local models.",
							})}
						</div>
					</div>
					<Select value={mode} onValueChange={(value) => handleModeChange(value as CodeIndexMode)}>
						<SelectTrigger className="w-40">
							<SelectValue placeholder={t("settings:common.select")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="auto">{t("codeIndex.mode.auto", { defaultValue: "Auto" })}</SelectItem>
							<SelectItem value="normal">
								{t("codeIndex.mode.normal", { defaultValue: "Normal" })}
							</SelectItem>
							<SelectItem value="lowResource">
								{t("codeIndex.mode.lowResource", { defaultValue: "Low resource" })}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-wrap gap-2">
					<StandardTooltip
						content={t("codeIndex.mode.recommendedLowResource.tooltip", {
							defaultValue:
								"Apply conservative defaults tuned for 4-core CPUs and local embedding models.",
						})}>
						<Button
							variant="secondary"
							size="sm"
							className="h-7 px-2"
							onClick={() => applyRecommended("lowResource")}>
							{t("codeIndex.mode.recommendedLowResource", { defaultValue: "Use Low-resource defaults" })}
						</Button>
					</StandardTooltip>
					<StandardTooltip
						content={t("codeIndex.mode.recommendedNormal.tooltip", {
							defaultValue: "Apply defaults for typical modern desktops.",
						})}>
						<Button
							variant="secondary"
							size="sm"
							className="h-7 px-2"
							onClick={() => applyRecommended("normal")}>
							{t("codeIndex.mode.recommendedNormal", { defaultValue: "Use Normal defaults" })}
						</Button>
					</StandardTooltip>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
				<div className="flex flex-col gap-1">
					<label className="text-sm font-medium">
						{t("codeIndex.maxParallelFileReads.label", {
							defaultValue: "Max parallel file reads",
						})}
					</label>
					<VSCodeTextField
						value={String(maxParallelFileReads ?? "")}
						inputMode="numeric"
						onInput={(e: any) =>
							handleNumberChange("codeIndexMaxParallelFileReads", e.target.value, 16, 1, 64)
						}
					/>
					<div className="text-xs text-vscode-descriptionForeground">
						{t("codeIndex.maxParallelFileReads.description", {
							defaultValue:
								"Limits concurrent filesystem reads during indexing. Lower on HDD/slow SSD or when using local models.",
						})}
					</div>
				</div>

				<div className="flex flex-col gap-1">
					<label className="text-sm font-medium">
						{t("codeIndex.maxParallelEmbeddings.label", {
							defaultValue: "Max parallel embeddings",
						})}
					</label>
					<VSCodeTextField
						value={String(maxParallelEmbeddings ?? "")}
						inputMode="numeric"
						onInput={(e: any) =>
							handleNumberChange("codeIndexMaxParallelEmbeddings", e.target.value, 4, 1, 32)
						}
					/>
					<div className="text-xs text-vscode-descriptionForeground">
						{t("codeIndex.maxParallelEmbeddings.description", {
							defaultValue:
								"Limits concurrent embedding requests. Set to 1–2 for local CPU/GPU models to avoid freezes.",
						})}
					</div>
				</div>

				<div className="flex flex-col gap-1">
					<label className="text-sm font-medium">
						{t("codeIndex.chunkSizeTokens.label", {
							defaultValue: "Chunk size (tokens)",
						})}
					</label>
					<VSCodeTextField
						value={String(chunkSizeTokens ?? "")}
						inputMode="numeric"
						onInput={(e: any) =>
							handleNumberChange("codeIndexChunkSizeTokens", e.target.value, 2048, 128, 8192)
						}
					/>
					<div className="text-xs text-vscode-descriptionForeground">
						{t("codeIndex.chunkSizeTokens.description", {
							defaultValue:
								"Target size of code chunks sent to the embedder. Smaller chunks reduce memory/CPU usage.",
						})}
					</div>
				</div>

				<div className="flex flex-col gap-1">
					<VSCodeCheckbox
						checked={enableBuiltInIgnore}
						onChange={(e: any) =>
							setCachedStateField("codeIndexEnableBuiltInIgnore", Boolean(e.target.checked) as any)
						}>
						<span className="font-medium">
							{t("codeIndex.enableBuiltInIgnore.label", {
								defaultValue: "Enable built-in ignore (node_modules, build, media, archives, etc.)",
							})}
						</span>
					</VSCodeCheckbox>
					<div className="text-xs text-vscode-descriptionForeground">
						{t("codeIndex.enableBuiltInIgnore.description", {
							defaultValue:
								"Skips heavy and irrelevant paths to reduce indexing time and resource usage.",
						})}
					</div>
				</div>
			</div>
		</Section>
	)
}
