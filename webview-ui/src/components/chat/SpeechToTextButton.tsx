import React, { useState, useCallback, useRef } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"

import { cn } from "@src/lib/utils"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { StandardTooltip } from "@src/components/ui"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useEvent } from "react-use"
import { ExtensionMessage } from "@roo/ExtensionMessage"

interface SpeechToTextButtonProps {
	onTranscript: (text: string, isFinal: boolean) => void
	disabled?: boolean
}

type RecordingState = "idle" | "connecting" | "recording" | "error"

export const SpeechToTextButton: React.FC<SpeechToTextButtonProps> = ({ onTranscript, disabled }) => {
	const { t } = useAppTranslation()
	const { speechToTextEnabled, deepgramApiKey } = useExtensionState()

	const [recordingState, setRecordingState] = useState<RecordingState>("idle")
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [showErrorDialog, setShowErrorDialog] = useState(false)

	// Track last interim result to avoid duplicates
	const lastInterimRef = useRef<string>("")

	const isConfigured = speechToTextEnabled && deepgramApiKey

	// Check if error is a long installation message (contains newlines)
	const isInstallationError = errorMessage?.includes("\n") || errorMessage?.includes("ffmpeg")

	// Handle messages from extension
	const handleMessage = useCallback(
		(event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			switch (message.type) {
				case "speechToTextTranscript":
					if (message.text) {
						const isFinal = message.isFinal ?? false

						if (isFinal) {
							// Final result - send it and reset interim tracking
							onTranscript(message.text, true)
							lastInterimRef.current = ""
						} else {
							// Interim result - only send if different from last interim
							if (message.text !== lastInterimRef.current) {
								lastInterimRef.current = message.text
								onTranscript(message.text, false)
							}
						}
					}
					break

				case "speechToTextError":
					console.error("Roo Code <STT>: Error from extension:", message.text)
					setErrorMessage(message.text ?? "Unknown error")
					setRecordingState("error")
					lastInterimRef.current = ""
					// Show dialog for installation errors
					if (message.text?.includes("ffmpeg") || message.text?.includes("\n")) {
						setShowErrorDialog(true)
					}
					break

				case "speechToTextStateChange":
					if (message.speechToTextState) {
						console.log("Roo Code <STT>: State change:", message.speechToTextState)
						setRecordingState(message.speechToTextState)
						if (message.speechToTextState !== "error") {
							setErrorMessage(null)
						}
						if (message.speechToTextState === "idle") {
							lastInterimRef.current = ""
						}
					}
					break
			}
		},
		[onTranscript],
	)

	// Listen for messages from extension
	useEvent("message", handleMessage)

	const startRecording = useCallback(() => {
		if (!isConfigured) {
			setErrorMessage(t("chat:speechToText.notConfiguredError"))
			setRecordingState("error")
			return
		}

		console.log("Roo Code <STT>: Sending startSpeechToText message to extension")
		setRecordingState("connecting")
		setErrorMessage(null)
		vscode.postMessage({ type: "startSpeechToText" })
	}, [isConfigured, t])

	const stopRecording = useCallback(() => {
		console.log("Roo Code <STT>: Sending stopSpeechToText message to extension")
		vscode.postMessage({ type: "stopSpeechToText" })
	}, [])

	const handleClick = useCallback(() => {
		if (recordingState === "idle" || recordingState === "error") {
			startRecording()
		} else if (recordingState === "recording") {
			stopRecording()
		}
	}, [recordingState, startRecording, stopRecording])

	const isRecording = recordingState === "recording"
	const isLoading = recordingState === "connecting"
	const hasError = recordingState === "error"

	// For installation errors, show a short tooltip and offer to show details
	const shortErrorMessage = isInstallationError ? t("chat:speechToText.ffmpegRequired") : errorMessage

	const tooltipContent = !isConfigured
		? t("chat:speechToText.notConfigured")
		: isRecording
			? t("chat:speechToText.stopRecording")
			: isLoading
				? t("chat:speechToText.connecting")
				: hasError && shortErrorMessage
					? shortErrorMessage
					: t("chat:speechToText.startRecording")

	return (
		<>
			<StandardTooltip content={tooltipContent}>
				<button
					aria-label={tooltipContent}
					disabled={disabled || isLoading || !isConfigured}
					onClick={hasError && isInstallationError ? () => setShowErrorDialog(true) : handleClick}
					className={cn(
						"relative inline-flex items-center justify-center",
						"bg-transparent border-none p-1.5",
						"rounded-md min-w-[28px] min-h-[28px]",
						"text-vscode-descriptionForeground hover:text-vscode-foreground",
						"transition-all duration-200",
						"opacity-50 hover:opacity-100 pointer-events-auto",
						"hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
						"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
						"active:bg-[rgba(255,255,255,0.1)]",
						"cursor-pointer",
						isRecording && "text-red-500 opacity-100 animate-pulse",
						hasError && "text-yellow-500",
						(disabled || !isConfigured) && "opacity-20 cursor-not-allowed",
					)}>
					{isLoading ? (
						<Loader2 className="w-4 h-4 animate-spin" />
					) : isRecording ? (
						<MicOff className="w-4 h-4" />
					) : (
						<Mic className="w-4 h-4" />
					)}
				</button>
			</StandardTooltip>

			{/* Installation Instructions Dialog */}
			{showErrorDialog && errorMessage && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setShowErrorDialog(false)}>
					<div
						className="bg-vscode-editor-background border border-vscode-panel-border rounded-lg p-6 max-w-lg mx-4 shadow-xl"
						onClick={(e) => e.stopPropagation()}>
						<h3 className="text-lg font-semibold text-vscode-foreground mb-4">
							{t("chat:speechToText.setupRequired")}
						</h3>
						<pre className="text-sm text-vscode-foreground whitespace-pre-wrap font-mono bg-vscode-input-background p-4 rounded border border-vscode-input-border overflow-auto max-h-80">
							{errorMessage}
						</pre>
						<div className="mt-4 flex justify-end gap-2">
							<button
								onClick={() => {
									navigator.clipboard.writeText(errorMessage)
								}}
								className="px-4 py-2 text-sm bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground rounded hover:bg-vscode-button-secondaryHoverBackground">
								{t("chat:speechToText.copyInstructions")}
							</button>
							<button
								onClick={() => {
									setShowErrorDialog(false)
									setRecordingState("idle")
									setErrorMessage(null)
								}}
								className="px-4 py-2 text-sm bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground">
								{t("chat:speechToText.close")}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	)
}
