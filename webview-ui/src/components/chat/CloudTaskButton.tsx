import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { CloudUpload, Copy, Check } from "lucide-react"
import QRCode from "qrcode"

import type { HistoryItem } from "@roo-code/types"

import { useExtensionState } from "@/context/ExtensionStateContext"
import { useCopyToClipboard } from "@/utils/clipboard"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, StandardTooltip } from "@/components/ui"
import { vscode } from "@/utils/vscode"

interface CloudTaskButtonProps {
	item?: HistoryItem
	disabled?: boolean
}

export const CloudTaskButton = ({ item, disabled = false }: CloudTaskButtonProps) => {
	const [dialogOpen, setDialogOpen] = useState(false)
	const { t } = useTranslation()
	const { cloudUserInfo, cloudApiUrl } = useExtensionState()
	const { copyWithFeedback, showCopyFeedback } = useCopyToClipboard()
	const qrCodeRef = useRef<HTMLCanvasElement>(null)

	// Generate the cloud URL for the task
	const cloudTaskUrl = item?.id ? `${cloudApiUrl}/task/${item.id}` : ""

	// Generate QR code when dialog opens
	useEffect(() => {
		if (dialogOpen && qrCodeRef.current && cloudTaskUrl) {
			QRCode.toCanvas(
				qrCodeRef.current,
				cloudTaskUrl,
				{
					width: 140,
					margin: 0,
					color: {
						dark: "#000000",
						light: "#FFFFFF",
					},
				},
				(error: Error | null | undefined) => {
					if (error) {
						console.error("Error generating QR code:", error)
					}
				},
			)
		}
	}, [dialogOpen, cloudTaskUrl])

	// Check if the button should be shown
	if (!cloudUserInfo?.extensionBridgeEnabled || !item?.id) {
		return null
	}

	return (
		<>
			<StandardTooltip content={t("chat:task.openInCloud")}>
				<Button
					variant="ghost"
					size="icon"
					disabled={disabled}
					className="h-7 w-7 p-1.5 hover:bg-vscode-toolbar-hoverBackground"
					onClick={() => setDialogOpen(true)}
					data-testid="cloud-task-button"
					aria-label={t("chat:task.openInCloud")}>
					<CloudUpload className="h-4 w-4" />
				</Button>
			</StandardTooltip>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-w-100">
					<DialogHeader>
						<DialogTitle>{t("chat:task.openInCloud")}</DialogTitle>
					</DialogHeader>

					<div className="flex flex-col space-y-4 text-center">
						{qrCodeRef && (
							<div className="flex justify-center">
								<div
									className="w-[170px] h-[170px] bg-white rounded-lg border-border cursor-pointer hover:opacity-70 transition-opacity"
									onClick={() => vscode.postMessage({ type: "openExternal", url: cloudTaskUrl })}
									title={t("chat:task.openInCloud")}>
									<canvas ref={qrCodeRef} className="m-[15px]" />
								</div>
							</div>
						)}

						<div className="flex items-center space-x-2">
							<Input value={cloudTaskUrl} disabled className="flex-1 font-mono text-sm" readOnly />
							<Button
								variant="outline"
								size="icon"
								onClick={(e) => copyWithFeedback(cloudTaskUrl, e)}
								className="h-9 w-9">
								{showCopyFeedback ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}
