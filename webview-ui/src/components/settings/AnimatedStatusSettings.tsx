import React, { useState, useEffect } from "react"
import { VSCodeButton, VSCodeTextField, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Plus, Trash2 } from "lucide-react"

interface AnimatedStatusSettingsProps {
	apiStatusConfig?: {
		enabled?: boolean
		customTexts?: string[]
		emojisEnabled?: boolean
		customEmojis?: string[]
		randomMode?: boolean
		cycleInterval?: number
	}
	setApiStatusConfig: (value: any) => void
}

const DEFAULT_STATUS_TEXTS = ["Generating...", "Thinking...", "Working on it...", "Processing...", "Analyzing..."]

const DEFAULT_EMOJIS = [
	"🤔", // Thinking
	"🧠", // Brainstorming
	"⏳", // Loading
	"✨", // Magic
	"🔮", // Summoning
	"💭", // Thought bubble
	"⚡", // Lightning
	"🎯", // Target
]

export const AnimatedStatusSettings: React.FC<AnimatedStatusSettingsProps> = ({
	apiStatusConfig = {},
	setApiStatusConfig,
}) => {
	const [localConfig, setLocalConfig] = useState({
		enabled: apiStatusConfig.enabled !== false,
		customTexts: apiStatusConfig.customTexts || [],
		emojisEnabled: apiStatusConfig.emojisEnabled === true,
		customEmojis: apiStatusConfig.customEmojis || [],
		randomMode: apiStatusConfig.randomMode !== false,
		cycleInterval: apiStatusConfig.cycleInterval || 5000,
	})

	const [newStatusText, setNewStatusText] = useState("")
	const [newEmoji, setNewEmoji] = useState("")

	useEffect(() => {
		setApiStatusConfig(localConfig)
	}, [localConfig, setApiStatusConfig])

	const addStatusText = () => {
		if (newStatusText.trim()) {
			setLocalConfig((prev) => ({
				...prev,
				customTexts: [...prev.customTexts, newStatusText.trim()],
			}))
			setNewStatusText("")
		}
	}

	const removeStatusText = (index: number) => {
		setLocalConfig((prev) => ({
			...prev,
			customTexts: prev.customTexts.filter((_, i) => i !== index),
		}))
	}

	const addEmoji = () => {
		if (newEmoji.trim()) {
			setLocalConfig((prev) => ({
				...prev,
				customEmojis: [...prev.customEmojis, newEmoji.trim()],
			}))
			setNewEmoji("")
		}
	}

	const removeEmoji = (index: number) => {
		setLocalConfig((prev) => ({
			...prev,
			customEmojis: prev.customEmojis.filter((_, i) => i !== index),
		}))
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<VSCodeCheckbox
					checked={localConfig.enabled}
					onChange={(e: any) => setLocalConfig((prev) => ({ ...prev, enabled: e.target.checked }))}>
					Enable animated status indicator
				</VSCodeCheckbox>
			</div>

			{localConfig.enabled && (
				<>
					<div className="ml-6 space-y-4">
						{/* Random Mode */}
						<div className="flex items-center gap-2">
							<VSCodeCheckbox
								checked={localConfig.randomMode}
								onChange={(e: any) =>
									setLocalConfig((prev) => ({ ...prev, randomMode: e.target.checked }))
								}>
								Cycle through status messages
							</VSCodeCheckbox>
						</div>

						{localConfig.randomMode && (
							<div className="ml-6">
								<label className="block text-sm mb-1">Cycle interval (seconds)</label>
								<VSCodeTextField
									value={String(localConfig.cycleInterval / 1000)}
									onChange={(e: any) => {
										const seconds = parseFloat(e.target.value) || 5
										setLocalConfig((prev) => ({
											...prev,
											cycleInterval: seconds * 1000,
										}))
									}}
									style={{ width: "100px" }}
								/>
							</div>
						)}

						{/* Custom Status Texts */}
						<div>
							<label className="block text-sm font-medium mb-2">Status Messages</label>
							<div className="text-xs text-vscode-descriptionForeground mb-2">
								{localConfig.customTexts.length === 0
									? `Using default messages: ${DEFAULT_STATUS_TEXTS.join(", ")}`
									: "Custom messages:"}
							</div>

							{localConfig.customTexts.map((text, index) => (
								<div key={index} className="flex items-center gap-2 mb-2">
									<span className="flex-1">{text}</span>
									<VSCodeButton appearance="icon" onClick={() => removeStatusText(index)}>
										<Trash2 className="w-4 h-4" />
									</VSCodeButton>
								</div>
							))}

							<div className="flex items-center gap-2">
								<VSCodeTextField
									value={newStatusText}
									onChange={(e: any) => setNewStatusText(e.target.value)}
									placeholder="Add custom status message..."
									onKeyDown={(e: any) => {
										if (e.key === "Enter") {
											addStatusText()
										}
									}}
									style={{ flex: 1 }}
								/>
								<VSCodeButton appearance="icon" onClick={addStatusText}>
									<Plus className="w-4 h-4" />
								</VSCodeButton>
							</div>
						</div>

						{/* Emoji Mode */}
						<div className="flex items-center gap-2">
							<VSCodeCheckbox
								checked={localConfig.emojisEnabled}
								onChange={(e: any) =>
									setLocalConfig((prev) => ({ ...prev, emojisEnabled: e.target.checked }))
								}>
								Show emoji with status
							</VSCodeCheckbox>
						</div>

						{localConfig.emojisEnabled && (
							<div className="ml-6">
								<label className="block text-sm font-medium mb-2">Emojis</label>
								<div className="text-xs text-vscode-descriptionForeground mb-2">
									{localConfig.customEmojis.length === 0
										? `Using default emojis: ${DEFAULT_EMOJIS.join(" ")}`
										: "Custom emojis:"}
								</div>

								<div className="flex flex-wrap gap-2 mb-2">
									{localConfig.customEmojis.map((emoji, index) => (
										<div
											key={index}
											className="flex items-center gap-1 px-2 py-1 bg-vscode-badge-background rounded">
											<span className="text-lg">{emoji}</span>
											<VSCodeButton
												appearance="icon"
												onClick={() => removeEmoji(index)}
												style={{ minWidth: "20px", height: "20px", padding: "2px" }}>
												<Trash2 className="w-3 h-3" />
											</VSCodeButton>
										</div>
									))}
								</div>

								<div className="flex items-center gap-2">
									<VSCodeTextField
										value={newEmoji}
										onChange={(e: any) => setNewEmoji(e.target.value)}
										placeholder="Add emoji..."
										maxlength={2}
										onKeyDown={(e: any) => {
											if (e.key === "Enter") {
												addEmoji()
											}
										}}
										style={{ width: "100px" }}
									/>
									<VSCodeButton appearance="icon" onClick={addEmoji}>
										<Plus className="w-4 h-4" />
									</VSCodeButton>
								</div>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	)
}
