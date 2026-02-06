/**
 * Generic autocomplete overlay component.
 *
 * Renders a floating list of items above the prompt, with keyboard navigation.
 * Used for slash commands, file search, mode switching, help, and history.
 */

import { For, Show, createSignal, createEffect, createMemo, on } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { KeyEvent } from "@opentui/core"
import { useTheme } from "../../context/theme.js"

export interface AutocompleteItem {
	key: string
	label: string
	/** Secondary text shown dimmed after label */
	description?: string
	/** Left icon/emoji */
	icon?: string
	/** Right-side metadata text */
	meta?: string
}

export interface AutocompleteOverlayProps {
	/** Whether the overlay is visible */
	visible: boolean
	/** Items to display */
	items: AutocompleteItem[]
	/** Title shown at top of overlay */
	title?: string
	/** Message when no items match */
	emptyMessage?: string
	/** Max items to show before scrolling */
	maxVisible?: number
	/** Called when an item is selected (Enter) */
	onSelect: (item: AutocompleteItem, index: number) => void
	/** Called when overlay is dismissed (Escape) */
	onDismiss: () => void
}

export function AutocompleteOverlay(props: AutocompleteOverlayProps) {
	const { theme } = useTheme()
	const [selectedIndex, setSelectedIndex] = createSignal(0)
	const maxVisible = () => props.maxVisible ?? 10

	// Reset selection when items change
	createEffect(
		on(
			() => props.items.length,
			() => setSelectedIndex(0),
		),
	)

	// Reset selection when visibility changes
	createEffect(
		on(
			() => props.visible,
			(visible) => {
				if (visible) setSelectedIndex(0)
			},
		),
	)

	// Keyboard navigation
	useKeyboard((event: KeyEvent) => {
		if (!props.visible) return

		if (event.name === "up") {
			setSelectedIndex((i) => Math.max(0, i - 1))
		} else if (event.name === "down") {
			setSelectedIndex((i) => Math.min(props.items.length - 1, i + 1))
		} else if (event.name === "return") {
			const item = props.items[selectedIndex()]
			if (item) {
				props.onSelect(item, selectedIndex())
			}
		} else if (event.name === "escape") {
			props.onDismiss()
		}
	})

	// Calculate visible window for scrolling
	const visibleWindow = createMemo(() => {
		const max = maxVisible()
		const items = props.items
		const selected = selectedIndex()

		if (items.length <= max) {
			return { start: 0, end: items.length }
		}

		// Keep selected item centered in window
		let start = Math.max(0, selected - Math.floor(max / 2))
		const end = Math.min(items.length, start + max)
		start = Math.max(0, end - max)

		return { start, end }
	})

	const visibleItems = createMemo(() => {
		const { start, end } = visibleWindow()
		return props.items.slice(start, end).map((item, i) => ({
			item,
			globalIndex: start + i,
		}))
	})

	return (
		<Show when={props.visible}>
			<box
				flexDirection="column"
				borderStyle="rounded"
				borderColor={theme.borderActive}
				maxHeight={maxVisible() + 3}
				flexShrink={0}>
				{/* Title */}
				<Show when={props.title}>
					<text fg={theme.primary} bold paddingLeft={1}>
						{props.title}
					</text>
				</Show>

				{/* Items or empty message */}
				<Show
					when={props.items.length > 0}
					fallback={
						<text fg={theme.dimText} paddingLeft={2}>
							{props.emptyMessage ?? "No results"}
						</text>
					}>
					<For each={visibleItems()}>
						{({ item, globalIndex }) => {
							const isSelected = () => globalIndex === selectedIndex()
							return (
								<box flexDirection="row" paddingLeft={1}>
									<text fg={isSelected() ? theme.accent : theme.text} bold={isSelected()}>
										{isSelected() ? "❯ " : "  "}
										{item.icon ? `${item.icon} ` : ""}
										{item.label}
									</text>
									<Show when={item.description}>
										<text fg={theme.dimText}> {item.description}</text>
									</Show>
									<Show when={item.meta}>
										<text fg={theme.textMuted}> {item.meta}</text>
									</Show>
								</box>
							)
						}}
					</For>
				</Show>

				{/* Scroll indicator */}
				<Show when={props.items.length > maxVisible()}>
					<text fg={theme.dimText} paddingLeft={1}>
						{selectedIndex() + 1}/{props.items.length} ↑↓ navigate • Enter select • Esc dismiss
					</text>
				</Show>
			</box>
		</Show>
	)
}
