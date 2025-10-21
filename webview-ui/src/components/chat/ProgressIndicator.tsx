import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { KangarooLoader } from "./KangarooLoader"

export const ProgressIndicator = () => {
	const { useKangarooAnimation } = useExtensionState()

	if (useKangarooAnimation) {
		return (
			<div
				style={{
					width: "16px",
					height: "16px",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}>
				<KangarooLoader />
			</div>
		)
	}

	return (
		<div
			style={{
				width: "16px",
				height: "16px",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}>
			<div style={{ transform: "scale(0.55)", transformOrigin: "center" }}>
				<VSCodeProgressRing />
			</div>
		</div>
	)
}
