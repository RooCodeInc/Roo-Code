import { Mode } from "@roo/modes"
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react"

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
import { VolumeX } from "lucide-react"
import { getIconForFilePath, getIconUrlByName } from "vscode-material-icons"

import { MentionNode } from "./lexical/MentionNode"
import { LexicalMentionPlugin } from "./lexical/LexicalMentionPlugin"
import { LexicalSelectAllPlugin } from "./lexical/LexicalSelectAllPlugin"
import ContextMenu from "./ContextMenu"
import { ContextMenuOptionType, getContextMenuOptions, SearchResult } from "@/utils/context-mentions"
import Thumbnails from "../common/Thumbnails"
import { MAX_IMAGES_PER_MESSAGE } from "./ChatView"
import { removeLeadingNonAlphanumeric } from "@/utils/removeLeadingNonAlphanumeric"

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

export const ChatLexicalTextArea = forwardRef<HTMLTextAreaElement, ChatTextAreaProps>(
	(
		{
			inputValue,
			setInputValue,
			selectApiConfigDisabled,
			placeholderText,
			selectedImages,
			setSelectedImages,
			// onSend,
			// onSelectImages,
			shouldDisableImages,
			// onHeightChange,
			mode,
			setMode,
			modeShortcutText,
			isEditMode = false,
			// onCancel,
		},
		// ref,
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

		// Get the icons base uri on mount
		useEffect(() => {
			const w = window as any
			setMaterialIconsBaseUri(w.MATERIAL_ICONS_BASE_URI)
		}, [])

		// Extract mentions from input value for context display - only after finishing mention
		const [validMentions, setValidMentions] = useState<string[]>([])

		// Update mentions only when they are complete (not live)
		useEffect(() => {
			const mentionRegex = /@([^@\s]+)(?=\s|$)/g // Only match completed mentions (followed by space or end)
			const mentions = []
			let match
			while ((match = mentionRegex.exec(inputValue)) !== null) {
				mentions.push(match[1])
			}

			// Only update if mentions actually changed
			if (JSON.stringify(mentions) !== JSON.stringify(validMentions)) {
				setValidMentions(mentions)
			}
		}, [inputValue, validMentions])

		// Smart filename disambiguation - like VSCode tabs
		const getDisplayName = useCallback((mention: string, allMentions: string[]) => {
			// Remove leading non-alphanumeric and trailing slash
			const path = removeLeadingNonAlphanumeric(mention).replace(/\/$/, "")
			const pathList = path.split("/")
			const filename = pathList.at(-1) || mention

			// Check if there are other mentions with the same filename
			const sameFilenames = allMentions.filter((m) => {
				const otherPath = removeLeadingNonAlphanumeric(m).replace(/\/$/, "")
				const otherFilename = otherPath.split("/").at(-1) || m
				return otherFilename === filename && m !== mention
			})

			if (sameFilenames.length === 0) {
				return filename // No conflicts, just show filename
			}

			// There are conflicts, need to show directory to disambiguate
			if (pathList.length > 1) {
				// Show filename with first directory
				return `${pathList[pathList.length - 2]}/${filename}`
			}

			return filename
		}, [])

		// Get material icon for mention
		const getMaterialIconForMention = useCallback(
			(mention: string) => {
				const name = mention.split("/").filter(Boolean).at(-1) ?? ""
				const iconName = getIconForFilePath(name)
				return getIconUrlByName(iconName, materialIconsBaseUri)
			},
			[materialIconsBaseUri],
		)

		// Check if we should show the context bar
		const shouldShowContextBar = validMentions.length > 0 || selectedImages.length > 0

		// Handle image pasting
		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const items = e.clipboardData.items
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

		// Handle drag and drop
		const handleDrop = useCallback(
			async (e: React.DragEvent<HTMLDivElement>) => {
				e.preventDefault()
				setIsDraggingOver(false)

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
				}
			}

			window.addEventListener("message", messageHandler)
			return () => window.removeEventListener("message", messageHandler)
		}, [searchRequestId])

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

				// Use the global function to insert mention
				const insertMention = (window as any).__lexicalInsertMention
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
					insertMention(insertValue, trigger)
				}
			},
			[searchQuery, setMode, setInputValue],
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
					"space-y-1 bg-editor-background outline-none border border-none box-border",
					isEditMode ? "p-2 w-full" : "relative px-1.5 pb-1 w-[calc(100%-16px)] ml-auto mr-auto",
				)}>
				{/* Context Bar */}
				{shouldShowContextBar && (
					<div className="mb-2">
						<div className="flex items-center gap-1 p-2 bg-vscode-input-background border border-vscode-focusBorder rounded overflow-x-auto">
							{/* Context mentions */}
							{validMentions.map((mention, index) => {
								const displayName = getDisplayName(mention, validMentions)
								const iconUrl = getMaterialIconForMention(mention)
								return (
									<div
										key={index}
										className="flex items-center gap-1 px-2 py-1 bg-vscode-editor-background text-vscode-editor-foreground rounded text-xs whitespace-nowrap flex-shrink-0">
										<img
											src={iconUrl}
											alt="File"
											style={{
												width: "12px",
												height: "12px",
												flexShrink: 0,
											}}
										/>
										<span>{displayName}</span>
									</div>
								)
							})}

							{/* Images */}
							{selectedImages.length > 0 && (
								<Thumbnails
									images={selectedImages}
									setImages={setSelectedImages}
									style={{
										marginBottom: 0,
										display: "flex",
										gap: 4,
									}}
								/>
							)}
						</div>
					</div>
				)}

				<div
					className="relative"
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
					<LexicalComposer initialConfig={initialConfig}>
						<PlainTextPlugin
							contentEditable={
								<ContentEditable
									aria-placeholder={placeholderText}
									placeholder={
										<p className="absolute left-3 top-3 leading-none m-0">{placeholderText}</p>
									}
									className={cn(
										"relative w-full",
										"text-vscode-input-foreground",
										"font-vscode-font-family",
										"text-vscode-editor-font-size",
										"leading-vscode-editor-line-height",
										"cursor-text",
										"py-2 pl-2",
										isEditMode ? "pr-20" : "pr-9",
										isFocused
											? "border border-vscode-focusBorder outline outline-vscode-focusBorder"
											: isDraggingOver
												? "border-2 border-dashed border-vscode-focusBorder"
												: "border border-transparent",
										isDraggingOver
											? "bg-[color-mix(in_srgb,var(--vscode-input-background)_95%,var(--vscode-focusBorder))]"
											: "bg-vscode-input-background",
										"transition-background-color duration-150 ease-in-out",
										"will-change-background-color",
										"min-h-[94px]",
										"box-border",
										"rounded",
										"resize-none",
										"overflow-x-hidden",
										"overflow-y-auto",
										"flex-none flex-grow",
										"z-[2]",
										"scrollbar-none",
										"scrollbar-hide",
									)}
									onFocus={() => setIsFocused(true)}
									onBlur={() => setIsFocused(false)}
									onPaste={handlePaste}
								/>
							}
							ErrorBoundary={LexicalErrorBoundary}
						/>
						<OnChangePlugin onChange={handleEditorChange} />
						<HistoryPlugin />
						<AutoFocusPlugin />
						<LexicalMentionPlugin
							onMentionTrigger={handleMentionTrigger}
							onMentionHide={handleMentionHide}
						/>
						<LexicalSelectAllPlugin />
					</LexicalComposer>

					{showContextMenu && (
						<div
							ref={contextMenuContainerRef}
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
								onMouseDown={() => {}}
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
					<div className="flex flex-shrink-0 items-center gap-0.5 pr-2">
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
					</div>
				</div>
			</div>
		)
	},
)
