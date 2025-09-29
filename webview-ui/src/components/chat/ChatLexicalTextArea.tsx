import { Mode } from "@roo/modes"
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { VolumeX, Image, WandSparkles, SendHorizontal, MessageSquareX } from "lucide-react"

import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { $getRoot, EditorState } from "lexical"

import { cn } from "@/lib/utils"
import { ModeSelector } from "./ModeSelector"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { ApiConfigSelector } from "./ApiConfigSelector"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import { AutoApproveDropdown } from "./AutoApproveDropdown"
import { StandardTooltip } from "../ui"
import { IndexingStatusBadge } from "./IndexingStatusBadge"

import { MentionNode } from "./lexical/MentionNode"
import { LexicalMentionPlugin, type MentionInfo, type LexicalMentionPluginRef } from "./lexical/LexicalMentionPlugin"
import { LexicalSelectAllPlugin } from "./lexical/LexicalSelectAllPlugin"
import ContextMenu from "./ContextMenu"
import { ContextMenuOptionType, getContextMenuOptions, SearchResult } from "@/utils/context-mentions"
import { MAX_IMAGES_PER_MESSAGE } from "./ChatView"
import { CloudAccountSwitcher } from "../cloud/CloudAccountSwitcher"
import { ChatContextBar } from "./ChatContextBar"

type ChatTextAreaProps = {
	inputValue: string
	setInputValue: (value: string) => void
	sendingDisabled: boolean
	selectApiConfigDisabled: boolean
	placeholderText: string
	selectedImages: string[]
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
	onSend: () => void
	onSelectImages: () => void
	shouldDisableImages: boolean
	onHeightChange?: (height: number) => void
	mode: Mode
	setMode: (value: Mode) => void
	modeShortcutText: string
	// Edit mode props
	isEditMode?: boolean
	onCancel?: () => void
}

function onError(error: unknown) {
	console.error(error)
}

export const ChatLexicalTextArea = forwardRef<HTMLDivElement, ChatTextAreaProps>(
	(
		{
			inputValue,
			setInputValue,
			sendingDisabled,
			selectApiConfigDisabled,
			placeholderText,
			selectedImages,
			setSelectedImages,
			onSend,
			onSelectImages,
			shouldDisableImages,
			mode,
			setMode,
			modeShortcutText,
			isEditMode = false,
			onCancel,
		},
		ref,
	) => {
		const { t } = useAppTranslation()
		const {
			filePaths,
			openedTabs,
			currentApiConfigName,
			listApiConfigMeta,
			customModes,
			customModePrompts,
			// cwd,
			pinnedApiConfigs,
			togglePinnedApiConfig,
			// taskHistory,
			// clineMessages,
			commands,
			cloudUserInfo,
		} = useExtensionState()

		const [isFocused, setIsFocused] = useState(false)
		const [showContextMenu, setShowContextMenu] = useState(false)
		const [searchQuery, setSearchQuery] = useState("")
		const [selectedMenuIndex, setSelectedMenuIndex] = useState(-1)
		const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null)
		const [fileSearchResults, setFileSearchResults] = useState<SearchResult[]>([])
		const [searchLoading, setSearchLoading] = useState(false)
		const [searchRequestId, setSearchRequestId] = useState<string>("")
		const [gitCommits, setGitCommits] = useState<any[]>([])
		const contextMenuContainerRef = useRef<HTMLDivElement>(null)
		const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
		const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false)
		const [isMouseDownOnMenu, setIsMouseDownOnMenu] = useState(false)

		// Find the ID and display text for the currently selected API configuration.
		const { currentConfigId, displayName } = useMemo(() => {
			const currentConfig = listApiConfigMeta?.find((config) => config.name === currentApiConfigName)
			return {
				currentConfigId: currentConfig?.id || "",
				displayName: currentApiConfigName || "", // Use the name directly for display.
			}
		}, [listApiConfigMeta, currentApiConfigName])

		const handleModeChange = useCallback(
			(value: Mode) => {
				setMode(value)
				vscode.postMessage({ type: "mode", text: value })
			},
			[setMode],
		)

		const handleApiConfigChange = useCallback((value: string) => {
			vscode.postMessage({ type: "loadApiConfigurationById", text: value })
		}, [])

		const [isTtsPlaying, setIsTtsPlaying] = useState(false)
		const [isDraggingOver, setIsDraggingOver] = useState(false)
		const [materialIconsBaseUri, setMaterialIconsBaseUri] = useState("")
		const mentionPluginRef = useRef<LexicalMentionPluginRef>(null)

		useEffect(() => {
			const w = window as any
			setMaterialIconsBaseUri(w.MATERIAL_ICONS_BASE_URI)
		}, [])

		const hasInputContent = useMemo(() => {
			return inputValue.trim().length > 0
		}, [inputValue])

		const handleEnhancePrompt = useCallback(() => {
			const trimmedInput = inputValue.trim()

			if (trimmedInput) {
				setIsEnhancingPrompt(true)
				vscode.postMessage({ type: "enhancePrompt" as const, text: trimmedInput })
			} else {
				setInputValue(t("chat:enhancePromptDescription"))
			}
		}, [inputValue, setInputValue, t])

		const [validMentions, setValidMentions] = useState<MentionInfo[]>([])

		const handleMentionUpdate = useCallback((mentions: MentionInfo[]) => {
			console.log({ mentions })
			setValidMentions(mentions)
		}, [])

		const handleRemoveMention = useCallback(
			(indexToRemove: number) => {
				const mentionToRemove = validMentions[indexToRemove]
				if (mentionToRemove && mentionPluginRef.current?.removeMention) {
					// Remove the mention from the editor content
					mentionPluginRef.current.removeMention(mentionToRemove)
					// The mention update callback will automatically update the validMentions state
				}
			},
			[validMentions],
		)

		const handleRemoveImage = useCallback(
			(indexToRemove: number) => {
				setSelectedImages((prevImages) => prevImages.filter((_, index) => index !== indexToRemove))
			},
			[setSelectedImages],
		)

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const items = e.clipboardData.items
				const pastedText = e.clipboardData.getData("text")

				const urlRegex = /^\S+:\/\/\S+$/
				if (urlRegex.test(pastedText.trim())) {
					e.preventDefault()
					// Lexical will handle inserting text, but we may need to adjust cursor
					// or ensure the space is added, depending on how Lexical handles pastes.
					// For now, let Lexical's default paste handle it.
					return
				}

				const acceptedTypes = ["png", "jpeg", "webp"]

				const imageItems = Array.from(items).filter((item) => {
					const [type, subtype] = item.type.split("/")
					return type === "image" && acceptedTypes.includes(subtype)
				})

				if (!shouldDisableImages && imageItems.length > 0) {
					e.preventDefault()

					const imagePromises = imageItems.map((item) => {
						return new Promise<string | null>((resolve) => {
							const blob = item.getAsFile()

							if (!blob) {
								resolve(null)
								return
							}

							const reader = new FileReader()

							reader.onloadend = () => {
								if (reader.error) {
									console.error(t("chat:errorReadingFile"), reader.error)
									resolve(null)
								} else {
									const result = reader.result
									resolve(typeof result === "string" ? result : null)
								}
							}

							reader.readAsDataURL(blob)
						})
					})

					const imageDataArray = await Promise.all(imagePromises)
					const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)

					if (dataUrls.length > 0) {
						setSelectedImages((prevImages) => [...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
					} else {
						console.warn(t("chat:noValidImages"))
					}
				}
			},
			[shouldDisableImages, setSelectedImages, t],
		)

		const handleDrop = useCallback(
			async (e: React.DragEvent<HTMLDivElement>) => {
				e.preventDefault()
				setIsDraggingOver(false)

				const textFieldList = e.dataTransfer.getData("text")
				const textUriList = e.dataTransfer.getData("application/vnd.code.uri-list")
				const text = textFieldList || textUriList

				// Lexical handles text drops intrinsically.
				if (text) {
					// We'll let Lexical's default drop behavior handle the text content.
					return
				}

				const files = Array.from(e.dataTransfer.files)

				if (files.length > 0) {
					const acceptedTypes = ["png", "jpeg", "webp"]

					const imageFiles = files.filter((file) => {
						const [type, subtype] = file.type.split("/")
						return type === "image" && acceptedTypes.includes(subtype)
					})

					if (!shouldDisableImages && imageFiles.length > 0) {
						const imagePromises = imageFiles.map((file) => {
							return new Promise<string | null>((resolve) => {
								const reader = new FileReader()

								reader.onloadend = () => {
									if (reader.error) {
										console.error(t("chat:errorReadingFile"), reader.error)
										resolve(null)
									} else {
										const result = reader.result
										resolve(typeof result === "string" ? result : null)
									}
								}

								reader.readAsDataURL(file)
							})
						})

						const imageDataArray = await Promise.all(imagePromises)
						const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)

						if (dataUrls.length > 0) {
							setSelectedImages((prevImages) =>
								[...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE),
							)
						} else {
							console.warn(t("chat:noValidImages"))
						}
					}
				}
			},
			[shouldDisableImages, setSelectedImages, t],
		)

		useEffect(() => {
			const messageHandler = (event: MessageEvent) => {
				const message = event.data

				if (message.type === "ttsStart") {
					setIsTtsPlaying(true)
				} else if (message.type === "ttsStop") {
					setIsTtsPlaying(false)
				} else if (message.type === "enhancedPrompt") {
					if (message.text) {
						setInputValue(message.text)
					}
					setIsEnhancingPrompt(false)
				} else if (message.type === "commitSearchResults") {
					const commits = message.commits.map((commit: any) => ({
						type: ContextMenuOptionType.Git,
						value: commit.hash,
						label: commit.subject,
						description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
						icon: "$(git-commit)",
					}))

					setGitCommits(commits)
				} else if (message.type === "fileSearchResults") {
					setSearchLoading(false)
					if (message.requestId === searchRequestId) {
						setFileSearchResults(message.results || [])
					}
				} else if (message.type === "insertTextIntoTextarea") {
					// Lexical editor handles inserts differently. Future improvement.
					console.log("Insert text requested for Lexical, but not yet implemented:", message.text)
				}
			}

			window.addEventListener("message", messageHandler)
			return () => window.removeEventListener("message", messageHandler)
		}, [searchRequestId, setInputValue])

		const queryItems = useMemo(() => {
			return [
				{ type: ContextMenuOptionType.Problems, value: "problems" },
				{ type: ContextMenuOptionType.Terminal, value: "terminal" },
				...gitCommits,
				...openedTabs
					.filter((tab) => tab.path)
					.map((tab) => ({
						type: ContextMenuOptionType.OpenedFile,
						value: "/" + tab.path,
					})),
				...filePaths
					.map((file) => "/" + file)
					.filter((path) => !openedTabs.some((tab) => tab.path && "/" + tab.path === path))
					.map((path) => ({
						type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path,
					})),
			]
		}, [filePaths, gitCommits, openedTabs])

		const handleMentionTrigger = useCallback((fullText: string, _position: { x: number; y: number }) => {
			setShowContextMenu(true)

			// Extract query like the original ChatTextArea
			if (fullText.startsWith("/") && !fullText.includes(" ")) {
				// Handle slash command
				const query = fullText
				setSearchQuery(query)
				setSelectedMenuIndex(1) // Skip section header, select first command
				vscode.postMessage({ type: "requestCommands" })
			} else {
				// Handle @ mention
				const lastAtIndex = fullText.lastIndexOf("@")
				if (lastAtIndex !== -1) {
					const query = fullText.slice(lastAtIndex + 1)
					setSearchQuery(query)

					// Send file search request if query is not empty
					if (query.length > 0) {
						setSelectedMenuIndex(0)

						// Clear any existing timeout
						if (searchTimeoutRef.current) {
							clearTimeout(searchTimeoutRef.current)
						}

						// Set a timeout to debounce the search requests
						searchTimeoutRef.current = setTimeout(() => {
							const reqId = Math.random().toString(36).substring(2, 9)
							setSearchRequestId(reqId)
							setSearchLoading(true)

							vscode.postMessage({
								type: "searchFiles",
								query: query,
								requestId: reqId,
							})
						}, 200) // 200ms debounce
					} else {
						setSelectedMenuIndex(3) // Set to "File" option by default
					}
				}
			}
		}, [])

		const handleMentionHide = useCallback(() => {
			setShowContextMenu(false)
			setSearchQuery("")
			setSelectedMenuIndex(-1)
			setFileSearchResults([])
		}, [])

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (type === ContextMenuOptionType.Mode && value) {
					setMode(value)
					setInputValue("")
					setShowContextMenu(false)
					vscode.postMessage({ type: "mode", text: value })
					return
				}

				if (type === ContextMenuOptionType.Command && value) {
					setSelectedMenuIndex(-1)
					setInputValue("")
					setShowContextMenu(false)
					const commandMention = `/${value}`
					setInputValue(commandMention + " ")
					return
				}

				if (
					type === ContextMenuOptionType.File ||
					type === ContextMenuOptionType.Folder ||
					type === ContextMenuOptionType.Git
				) {
					if (!value) {
						setSelectedType(type)
						setSearchQuery("")
						setSelectedMenuIndex(0)
						return
					}
				}

				setShowContextMenu(false)
				setSelectedType(null)

				const insertMention = mentionPluginRef.current?.insertMention
				if (insertMention && value) {
					let insertValue = value || ""

					if (type === ContextMenuOptionType.URL) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.Problems) {
						insertValue = "problems"
					} else if (type === ContextMenuOptionType.Terminal) {
						insertValue = "terminal"
					} else if (type === ContextMenuOptionType.Git) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.Command) {
						insertValue = value ? `/${value}` : ""
					}

					const trigger = searchQuery.startsWith("/") ? "/" : "@"
					insertMention(insertValue, trigger, type)
				}
				setIsMouseDownOnMenu(false) // Reset this state
			},
			[searchQuery, setMode, setInputValue, mentionPluginRef],
		)

		// Handle keyboard navigation for context menu
		useEffect(() => {
			const handleKeyDown = (event: KeyboardEvent) => {
				if (!showContextMenu) return

				if (event.key === "Escape") {
					setSelectedType(null)
					setSelectedMenuIndex(3) // File by default
					return
				}

				if (event.key === "ArrowUp" || event.key === "ArrowDown") {
					event.preventDefault()
					setSelectedMenuIndex((prevIndex) => {
						const direction = event.key === "ArrowUp" ? -1 : 1
						const options = getContextMenuOptions(
							searchQuery,
							selectedType,
							queryItems,
							fileSearchResults,
							customModes,
							commands,
						)
						const optionsLength = options.length

						if (optionsLength === 0) return prevIndex

						// Find selectable options (non-URL types)
						const selectableOptions = options.filter(
							(option) =>
								option.type !== ContextMenuOptionType.URL &&
								option.type !== ContextMenuOptionType.NoResults &&
								option.type !== ContextMenuOptionType.SectionHeader,
						)

						if (selectableOptions.length === 0) return -1 // No selectable options

						// Find the index of the next selectable option
						const currentSelectableIndex = selectableOptions.findIndex(
							(option) => option === options[prevIndex],
						)

						const newSelectableIndex =
							(currentSelectableIndex + direction + selectableOptions.length) % selectableOptions.length

						// Find the index of the selected option in the original options array
						return options.findIndex((option) => option === selectableOptions[newSelectableIndex])
					})
					return
				}

				if ((event.key === "Enter" || event.key === "Tab") && selectedMenuIndex !== -1) {
					event.preventDefault()
					event.stopPropagation()
					const selectedOption = getContextMenuOptions(
						searchQuery,
						selectedType,
						queryItems,
						fileSearchResults,
						customModes,
						commands,
					)[selectedMenuIndex]
					if (
						selectedOption &&
						selectedOption.type !== ContextMenuOptionType.URL &&
						selectedOption.type !== ContextMenuOptionType.NoResults &&
						selectedOption.type !== ContextMenuOptionType.SectionHeader
					) {
						handleMentionSelect(selectedOption.type, selectedOption.value)
					}
					return
				}
			}

			document.addEventListener("keydown", handleKeyDown, { capture: true })
			return () => document.removeEventListener("keydown", handleKeyDown, { capture: true })
		}, [
			showContextMenu,
			searchQuery,
			selectedMenuIndex,
			selectedType,
			queryItems,
			fileSearchResults,
			customModes,
			commands,
			handleMentionSelect,
		])

		// Effect to handle clicks outside the context menu to close it
		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (
					contextMenuContainerRef.current &&
					!contextMenuContainerRef.current.contains(event.target as Node) &&
					!isMouseDownOnMenu
				) {
					setShowContextMenu(false)
				}
			}

			if (showContextMenu) {
				document.addEventListener("mousedown", handleClickOutside)
			}

			return () => {
				document.removeEventListener("mousedown", handleClickOutside)
			}
		}, [showContextMenu, isMouseDownOnMenu])

		const handleMenuMouseDown = useCallback(() => {
			setIsMouseDownOnMenu(true)
		}, [])

		const handleEditorChange = useCallback(
			(editorState: EditorState) => {
				editorState.read(() => {
					const root = $getRoot()
					const textContent = root.getTextContent()
					setInputValue(textContent)
				})
			},
			[setInputValue],
		)

		const placeholderBottomText = `\n(${t("chat:addContext")}${shouldDisableImages ? `, ${t("chat:dragFiles")}` : `, ${t("chat:dragFilesImages")}`})`

		const initialConfig = {
			namespace: "roo-editor",
			nodes: [MentionNode],
			theme: {
				paragraph: "m-0 align-middle",
			},
			onError,
		}

		return (
			<div
				className={cn(
					"flex flex-col gap-1 bg-editor-background outline-none border border-none box-border",
					isEditMode ? "p-2 w-full" : "relative px-1.5 pb-1 w-[calc(100%-16px)] ml-auto mr-auto",
				)}>
				<div className={cn(!isEditMode && "relative")}>
					{/* Context Bar */}
					<ChatContextBar
						validMentions={validMentions}
						selectedImages={selectedImages}
						onRemoveMention={handleRemoveMention}
						onRemoveImage={handleRemoveImage}
					/>
					<div
						className={cn("chat-text-area", !isEditMode && "relative", "flex", "flex-col", "outline-none")}
						onDrop={handleDrop}
						onDragOver={(e) => {
							// Only allowed to drop images/files on shift key pressed.
							if (!e.shiftKey) {
								setIsDraggingOver(false)
								return
							}

							e.preventDefault()
							setIsDraggingOver(true)
							e.dataTransfer.dropEffect = "copy"
						}}
						onDragLeave={(e) => {
							e.preventDefault()
							const rect = e.currentTarget.getBoundingClientRect()

							if (
								e.clientX <= rect.left ||
								e.clientX >= rect.right ||
								e.clientY <= rect.top ||
								e.clientY >= rect.bottom
							) {
								setIsDraggingOver(false)
							}
						}}>
						{showContextMenu && (
							<div
								ref={contextMenuContainerRef}
								onMouseDown={handleMenuMouseDown}
								className={cn(
									"absolute",
									"bottom-full",
									isEditMode ? "left-6" : "left-0",
									"right-0",
									"z-[1000]",
									isEditMode ? "-mb-3" : "mb-2",
									"filter",
									"drop-shadow-md",
								)}>
								<ContextMenu
									onSelect={handleMentionSelect}
									searchQuery={searchQuery}
									inputValue={inputValue}
									onMouseDown={handleMenuMouseDown}
									selectedIndex={selectedMenuIndex}
									setSelectedIndex={setSelectedMenuIndex}
									selectedType={selectedType}
									queryItems={queryItems}
									modes={customModes}
									loading={searchLoading}
									dynamicSearchResults={fileSearchResults}
									commands={commands}
								/>
							</div>
						)}
						<div
							className={cn(
								"relative",
								"flex-1",
								"flex",
								"flex-col-reverse",
								"min-h-0",
								"overflow-hidden",
								"rounded",
							)}>
							<LexicalComposer initialConfig={initialConfig}>
								<PlainTextPlugin
									contentEditable={
										<ContentEditable
											aria-placeholder={placeholderText}
											placeholder={
												<div className="absolute inset-0">
													<p className="absolute left-2 top-2 leading-none m-0 opacity-70">
														{placeholderText}
													</p>
													<p
														className={cn(
															"absolute left-2 -bottom-0 z-30 flex items-center h-8 font-vscode-font-family text-vscode-editor-font-size leading-vscode-editor-line-height pointer-events-none",
															isEditMode ? "pr-20" : "pr-9",
														)}
														style={{
															color: "color-mix(in oklab, var(--vscode-input-foreground) 50%, transparent)",
															userSelect: "none",
														}}>
														{placeholderBottomText}
													</p>
												</div>
											}
											className={cn(
												"relative w-full outline-none",
												"text-vscode-input-foreground",
												"font-vscode-font-family",
												"text-vscode-editor-font-size",
												"leading-vscode-editor-line-height",
												"cursor-text",
												"transition-background-color duration-150 ease-in-out",
												"will-change-background-color",
												"min-h-[94px]",
												"box-border",
												"resize-none",
												"overflow-x-hidden",
												"overflow-y-auto",
												"flex-none flex-grow",
												"z-[2]",
												"scrollbar-none",
												"scrollbar-hide",
												isFocused
													? "border border-vscode-focusBorder outline outline-vscode-focusBorder"
													: isDraggingOver
														? "border-2 border-dashed border-vscode-focusBorder"
														: "border border-transparent",
												isDraggingOver
													? "bg-[color-mix(in_srgb,var(--vscode-input-background)_95%,var(--vscode-focusBorder))]"
													: "bg-vscode-input-background",
												"pl-2 py-2",
												isEditMode ? "pr-20" : "pr-9",
											)}
											onFocus={() => setIsFocused(true)}
											onBlur={() => {
												setIsFocused(false)
												setIsMouseDownOnMenu(false)
											}}
											onPaste={handlePaste}
											ref={ref}
										/>
									}
									ErrorBoundary={LexicalErrorBoundary}
								/>
								<OnChangePlugin onChange={handleEditorChange} />
								<HistoryPlugin />
								<AutoFocusPlugin />
								<LexicalMentionPlugin
									ref={mentionPluginRef}
									onMentionTrigger={handleMentionTrigger}
									onMentionHide={handleMentionHide}
									onMentionUpdate={handleMentionUpdate}
									materialIconsBaseUri={materialIconsBaseUri}
								/>
								<LexicalSelectAllPlugin />
							</LexicalComposer>

							<div className="absolute bottom-2 right-1 z-30 flex flex-col items-center gap-0">
								<StandardTooltip content={t("chat:addImages")}>
									<button
										aria-label={t("chat:addImages")}
										disabled={shouldDisableImages}
										onClick={!shouldDisableImages ? onSelectImages : undefined}
										className={cn(
											"relative inline-flex items-center justify-center",
											"bg-transparent border-none p-1.5",
											"rounded-md min-w-[28px] min-h-[28px]",
											"text-vscode-descriptionForeground hover:text-vscode-foreground",
											"transition-all duration-1000",
											"cursor-pointer",
											!shouldDisableImages
												? "opacity-50 hover:opacity-100 delay-750 pointer-events-auto"
												: "opacity-0 pointer-events-none duration-200 delay-0",
											!shouldDisableImages &&
												"hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
											"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
											!shouldDisableImages && "active:bg-[rgba(255,255,255,0.1)]",
											shouldDisableImages &&
												"opacity-40 cursor-not-allowed grayscale-[30%] hover:bg-transparent hover:border-[rgba(255,255,255,0.08)] active:bg-transparent",
										)}>
										<Image className="w-4 h-4" />
									</button>
								</StandardTooltip>
								<StandardTooltip content={t("chat:enhancePrompt")}>
									<button
										aria-label={t("chat:enhancePrompt")}
										disabled={false}
										onClick={handleEnhancePrompt}
										className={cn(
											"relative inline-flex items-center justify-center",
											"bg-transparent border-none p-1.5",
											"rounded-md min-w-[28px] min-h-[28px]",
											"text-vscode-descriptionForeground hover:text-vscode-foreground",
											"transition-all duration-1000",
											"cursor-pointer",
											hasInputContent
												? "opacity-50 hover:opacity-100 delay-750 pointer-events-auto"
												: "opacity-0 pointer-events-none duration-200 delay-0",
											hasInputContent &&
												"hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
											"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
											hasInputContent && "active:bg-[rgba(255,255,255,0.1)]",
										)}>
										<WandSparkles className={cn("w-4 h-4", isEnhancingPrompt && "animate-spin")} />
									</button>
								</StandardTooltip>
								{isEditMode && (
									<StandardTooltip content={t("chat:cancel.title")}>
										<button
											aria-label={t("chat:cancel.title")}
											disabled={false}
											onClick={onCancel}
											className={cn(
												"relative inline-flex items-center justify-center",
												"bg-transparent border-none p-1.5",
												"rounded-md min-w-[28px] min-h-[28px]",
												"opacity-60 hover:opacity-100 text-vscode-descriptionForeground hover:text-vscode-foreground",
												"transition-all duration-150",
												"hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
												"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
												"active:bg-[rgba(255,255,255,0.1)]",
												"cursor-pointer",
											)}>
											<MessageSquareX className="w-4 h-4" />
										</button>
									</StandardTooltip>
								)}
								<StandardTooltip content={t("chat:sendMessage")}>
									<button
										aria-label={t("chat:sendMessage")}
										disabled={sendingDisabled || !hasInputContent}
										onClick={onSend}
										className={cn(
											"relative inline-flex items-center justify-center",
											"bg-transparent border-none p-1.5",
											"rounded-md min-w-[28px] min-h-[28px]",
											"text-vscode-descriptionForeground hover:text-vscode-foreground",
											"transition-all duration-200",
											hasInputContent && !sendingDisabled
												? "opacity-100 hover:opacity-100 pointer-events-auto"
												: "opacity-0 pointer-events-none",
											hasInputContent &&
												!sendingDisabled &&
												"hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
											"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
											hasInputContent && !sendingDisabled && "active:bg-[rgba(255,255,255,0.1)]",
											hasInputContent && !sendingDisabled && "cursor-pointer",
										)}>
										<SendHorizontal className="w-4 h-4" />
									</button>
								</StandardTooltip>
							</div>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<div className="flex items-center gap-2 min-w-0 overflow-clip flex-1">
						<ModeSelector
							value={mode}
							title={t("chat:selectMode")}
							onChange={handleModeChange}
							triggerClassName="text-ellipsis overflow-hidden flex-shrink-0"
							modeShortcutText={modeShortcutText}
							customModes={customModes}
							customModePrompts={customModePrompts}
						/>
						<ApiConfigSelector
							value={currentConfigId}
							displayName={displayName}
							disabled={selectApiConfigDisabled}
							title={t("chat:selectApiConfig")}
							onChange={handleApiConfigChange}
							triggerClassName="min-w-[28px] text-ellipsis overflow-hidden flex-shrink"
							listApiConfigMeta={listApiConfigMeta || []}
							pinnedApiConfigs={pinnedApiConfigs}
							togglePinnedApiConfig={togglePinnedApiConfig}
						/>
						<AutoApproveDropdown triggerClassName="min-w-[28px] text-ellipsis overflow-hidden flex-shrink" />
					</div>
					<div
						className={cn(
							"flex flex-shrink-0 items-center gap-0.5",
							!isEditMode && cloudUserInfo ? "" : "pr-2",
						)}>
						{isTtsPlaying && (
							<StandardTooltip content={t("chat:stopTts")}>
								<button
									aria-label={t("chat:stopTts")}
									onClick={() => vscode.postMessage({ type: "stopTts" })}
									className={cn(
										"relative inline-flex items-center justify-center",
										"bg-transparent border-none p-1.5",
										"rounded-md min-w-[28px] min-h-[28px]",
										"text-vscode-foreground opacity-85",
										"transition-all duration-150",
										"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
										"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
										"active:bg-[rgba(255,255,255,0.1)]",
										"cursor-pointer",
									)}>
									<VolumeX className="w-4 h-4" />
								</button>
							</StandardTooltip>
						)}
						{!isEditMode ? <IndexingStatusBadge /> : null}
						{!isEditMode && cloudUserInfo && <CloudAccountSwitcher />}
					</div>
				</div>
			</div>
		)
	},
)
