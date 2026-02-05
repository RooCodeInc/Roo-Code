import { useCallback, useEffect, useState } from "react"
import { useEvent } from "react-use"
import { ArrowLeft } from "lucide-react"

import { vscode } from "@/utils/vscode"
import { CheckpointTimeline, CheckpointMetadataUI } from "./CheckpointTimeline"
import { ExtensionMessage } from "@roo-code/types"
import { Button } from "@/components/ui"
import { Tab, TabContent, TabHeader } from "../../common/Tab"

type CheckpointViewProps = {
	onDone: () => void
}

export const CheckpointView = ({ onDone }: CheckpointViewProps) => {
	const [checkpoints, setCheckpoints] = useState<CheckpointMetadataUI[]>([])
	const [currentCheckpointId, setCurrentCheckpointId] = useState<string | undefined>()

	const handleMessage = useCallback((event: MessageEvent) => {
		const message: ExtensionMessage = event.data
		switch (message.type) {
			case "checkpointHistory": {
				if (message.checkpoints) {
					setCheckpoints(message.checkpoints as unknown as CheckpointMetadataUI[])
				}
				if (message.currentCheckpointId) {
					setCurrentCheckpointId(message.currentCheckpointId)
				}
				break
			}
			case "currentCheckpointUpdated": {
				setCurrentCheckpointId(message.text)
				break
			}
		}
	}, [])

	useEvent("message", handleMessage)

	useEffect(() => {
		vscode.postMessage({ type: "getCheckpoints" })
	}, [])

	const handleRestore = useCallback((commitHash: string) => {
		vscode.postMessage({
			type: "checkpointRestore",
			payload: {
				ts: Date.now(),
				commitHash,
				mode: "restore",
			},
		})
	}, [])

	const handleDiff = useCallback((commitHash: string) => {
		vscode.postMessage({
			type: "checkpointDiff",
			payload: {
				ts: Date.now(),
				commitHash,
				mode: "checkpoint",
			},
		})
	}, [])

	const handleRename = useCallback((id: string, name: string) => {
		vscode.postMessage({
			type: "renameCheckpoint",
			ids: [id],
			text: name,
		})
	}, [])

	const handleStar = useCallback((id: string) => {
		vscode.postMessage({
			type: "toggleCheckpointStar",
			ids: [id],
		})
	}, [])

	const handleDelete = useCallback((id: string) => {
		vscode.postMessage({
			type: "deleteCheckpoint",
			ids: [id],
		})
	}, [])

	return (
		<Tab>
			<TabHeader>
				<div className="flex items-center gap-2">
					<Button variant="ghost" className="px-1.5 -ml-2" onClick={onDone}>
						<ArrowLeft />
					</Button>
					<h3 className="text-vscode-foreground m-0">Checkpoints</h3>
				</div>
			</TabHeader>
			<TabContent className="px-2 py-0">
				<CheckpointTimeline
					checkpoints={checkpoints}
					currentCheckpointId={currentCheckpointId}
					onRestore={handleRestore}
					onDiff={handleDiff}
					onRename={handleRename}
					onStar={handleStar}
					onDelete={handleDelete}
				/>
			</TabContent>
		</Tab>
	)
}
