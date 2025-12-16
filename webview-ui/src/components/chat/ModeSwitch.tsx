import { useExtensionState } from "@/context/ExtensionStateContext"
import styled from "styled-components"
import { cn } from "@src/lib/utils"
import { type ExtensionState } from "@roo/ExtensionMessage"
import { StandardTooltip } from "@src/components/ui"
import { useTranslation } from "react-i18next"
import { vscode } from "@/utils/vscode"
import { type ZgsmCodeMode } from "@roo/modes"

const mapDisplayToOriginal = (displayMode: "vibe" | "plan" | "spec"): string => {
	if (displayMode === "vibe") return "vibe"
	if (displayMode === "plan") return "plan"
	if (displayMode === "spec") return "strict"
	return displayMode
}

const mapModeToDisplay = (mode: ExtensionState["zgsmCodeMode"]): "vibe" | "plan" | "spec" => {
	if (mode === "vibe") return "vibe"
	if (mode === "plan") return "plan"
	if (mode === "strict") return "spec"
	return mode as "vibe" | "plan" | "spec"
}

const SwitchContainer = styled.div<{ disabled: boolean }>`
	display: flex;
	align-items: center;
	background-color: transparent;
	border: 1px solid var(--vscode-input-border);
	border-radius: 12px;
	overflow: hidden;
	cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
	opacity: ${(props) => (props.disabled ? 0.5 : 1)};
	transform: scale(1);
	transform-origin: right center;
	margin-left: 0;
	user-select: none;
`

const Slider = styled.div.withConfig({
	shouldForwardProp: (prop) => !["isVibe", "isPlan", "isSpec"].includes(prop),
})<{ isVibe: boolean; isPlan?: boolean; isSpec?: boolean }>`
	position: absolute;
	height: 100%;
	width: 33.33%;
	background-color: var(--vscode-focusBorder);
	transition: transform 0.2s ease;
	transform: translateX(${(props) => (props.isVibe ? "0%" : props.isSpec ? "200%" : "100%")});
`

export const ModeSwitch = () => {
	const { zgsmCodeMode, setZgsmCodeMode } = useExtensionState()
	const displayMode = mapModeToDisplay(zgsmCodeMode)
	const { t } = useTranslation("welcome")

	const handleModeClick = (selectedMode: "vibe" | "plan" | "spec", forceMode?: string) => {
		const originalMode = mapDisplayToOriginal(selectedMode)
		setZgsmCodeMode(originalMode as ZgsmCodeMode)

		vscode.postMessage({
			type: "zgsmCodeMode",
			text: originalMode,
		})

		vscode.postMessage({
			type: "mode",
			text: forceMode || (originalMode === "vibe" ? "code" : "strict"),
		})
	}

	const getModeTip = (mode: string) => {
		if (mode === "vibe") {
			return t("vibe.description")
		} else if (mode === "spec") {
			return t("strict.description")
		} else if (mode === "plan") {
			return t("plan.description")
		}
		return ""
	}

	return (
		<SwitchContainer data-testid="mode-switch" disabled={false}>
			<Slider isVibe={displayMode === "vibe"} isPlan={displayMode === "plan"} isSpec={displayMode === "spec"} />
			{["Vibe", "Plan", "Spec"].map((m) => (
				<StandardTooltip content={getModeTip(m.toLowerCase())} key={m}>
					<div
						aria-checked={displayMode === m.toLowerCase()}
						className={cn(
							"pt-0.5 pb-px px-2 z-10 text-xs w-1/3 text-center bg-transparent cursor-pointer",
							displayMode === m.toLowerCase() ? "text-white" : "text-input-foreground",
						)}
						onClick={() =>
							handleModeClick(
								m.toLowerCase() as "vibe" | "plan" | "spec",
								m === "Plan" ? "plan" : undefined,
							)
						}
						role="switch">
						{m}
					</div>
				</StandardTooltip>
			))}
		</SwitchContainer>
	)
}
