/**
 * Session view - main conversation view with message history,
 * approval prompts, and text input.
 */

import { For, Show, Switch, Match, createMemo, createSignal } from "solid-js"
import { useTerminalDimensions, useKeyboard } from "@opentui/solid"
import { type KeyEvent } from "@opentui/core"
import { useTheme } from "../../context/theme.js"
import { useExtension } from "../../context/extension.js"
import { HorizontalLine } from "../../component/border.js"
import { Prompt } from "../../component/prompt/index.js"
import { SessionHeader } from "./header.js"
import { SessionFooter } from "./footer.js"
import type { TUIMessage } from "../../types.js"

export interface SessionProps {
	version: string
	mode: string
	provider: string
	model: string
}

/** Render a single chat message */
function ChatMessage(props: { message: TUIMessage }) {
	const { theme } = useTheme()

	const headerColor = () => {
		switch (props.message.role) {
			case "user":
				return theme.userHeader
			case "assistant":
				return theme.rooHeader
			case "tool":
				return theme.toolHeader
			case "thinking":
				return theme.thinkingHeader
			default:
				return theme.text
		}
	}

	const textColor = () => {
		switch (props.message.role) {
			case "user":
				return theme.userText
			case "assistant":
				return theme.rooText
			case "tool":
				return theme.toolText
			case "thinking":
				return theme.thinkingText
			default:
				return theme.text
		}
	}

	const headerLabel = () => {
		switch (props.message.role) {
			case "user":
				return "You"
			case "assistant":
				return "Roo"
			case "tool":
				return props.message.toolDisplayName || "Tool"
			case "thinking":
				return "Thinking"
			default:
				return ""
		}
	}

	const displayContent = () => {
		if (props.message.role === "tool" && props.message.toolDisplayOutput) {
			return props.message.toolDisplayOutput
		}
		return props.message.content
	}

	return (
		<box flexDirection="column" paddingLeft={1} paddingBottom={1}>
			<text fg={headerColor()} bold>
				{headerLabel()}
				{props.message.partial ? " ..." : ""}
			</text>
			<Show when={displayContent()}>
				<text fg={textColor()} wrap="wrap">
					{displayContent()}
				</text>
			</Show>
		</box>
	)
}

/** Approval prompt for tool use / command approvals */
function ApprovalPrompt(props: { content: string }) {
	const { theme } = useTheme()
	const ext = useExtension()

	useKeyboard((event: KeyEvent) => {
		const lower = event.name?.toLowerCase()
		if (lower === "y") ext.handleApprove()
		else if (lower === "n") ext.handleReject()
	})

	return (
		<box flexDirection="column">
			<text fg={theme.rooHeader}>{props.content}</text>
			<box flexDirection="row" gap={1}>
				<text fg={theme.dimText}>Press</text>
				<text fg={theme.success}>Y</text>
				<text fg={theme.dimText}>to approve,</text>
				<text fg={theme.error}>N</text>
				<text fg={theme.dimText}>to reject</text>
			</box>
		</box>
	)
}

/** Followup question prompt */
function FollowupPrompt(props: { content: string; suggestions?: Array<{ answer: string }> }) {
	const { theme } = useTheme()
	const ext = useExtension()
	const [selectedIndex, setSelectedIndex] = createSignal(0)

	const hasSuggestions = () => props.suggestions && props.suggestions.length > 0

	useKeyboard((event: KeyEvent) => {
		if (!hasSuggestions()) return

		if (event.name === "up") {
			setSelectedIndex((i) => Math.max(0, i - 1))
		} else if (event.name === "down") {
			setSelectedIndex((i) => Math.min(props.suggestions?.length ?? 0, i + 1))
		} else if (event.name === "return") {
			const suggestions = props.suggestions || []
			const idx = selectedIndex()
			if (idx < suggestions.length && suggestions[idx]) {
				ext.handleSubmit(suggestions[idx].answer)
			}
		}
	})

	return (
		<box flexDirection="column">
			<text fg={theme.rooHeader}>{props.content}</text>
			<Show
				when={hasSuggestions()}
				fallback={
					<box flexDirection="column" marginTop={1}>
						<HorizontalLine active={true} />
						<Prompt
							placeholder="Type your response..."
							onSubmit={(text) => ext.handleSubmit(text)}
							isActive={true}
							prefix="> "
							enableTriggers={true}
						/>
						<HorizontalLine active={true} />
					</box>
				}>
				<box flexDirection="column" marginTop={1}>
					<HorizontalLine active={true} />
					<For each={props.suggestions}>
						{(suggestion, index) => (
							<text fg={index() === selectedIndex() ? theme.accent : theme.text}>
								{index() === selectedIndex() ? "❯ " : "  "}
								{suggestion.answer}
							</text>
						)}
					</For>
					<text fg={selectedIndex() === (props.suggestions?.length ?? 0) ? theme.accent : theme.dimText}>
						{selectedIndex() === (props.suggestions?.length ?? 0) ? "❯ " : "  "}Type something...
					</text>
					<HorizontalLine active={true} />
					<text fg={theme.dimText}>↑↓ navigate • Enter select</text>
				</box>
			</Show>
		</box>
	)
}

export function Session(props: SessionProps) {
	const { theme } = useTheme()
	const ext = useExtension()
	const dims = useTerminalDimensions()

	const messages = () => ext.state.messages
	const pendingAsk = () => ext.state.pendingAsk
	const isComplete = () => ext.state.isComplete
	const showApprovalPrompt = () => pendingAsk() && pendingAsk()?.type !== "followup"

	return (
		<box flexDirection="column" height={dims().height - 1}>
			{/* Header */}
			<SessionHeader version={props.version} mode={props.mode} provider={props.provider} model={props.model} />

			{/* Message history - scrollable area */}
			<scrollbox flexGrow={1} scrollbar="auto">
				<box flexDirection="column">
					<For each={messages()}>{(message) => <ChatMessage message={message} />}</For>
				</box>
			</scrollbox>

			{/* Input area */}
			<box flexDirection="column" flexShrink={0}>
				<Switch>
					{/* Followup question */}
					<Match when={pendingAsk()?.type === "followup"}>
						<FollowupPrompt
							content={pendingAsk()!.content}
							suggestions={pendingAsk()?.suggestions as Array<{ answer: string }> | undefined}
						/>
					</Match>

					{/* Approval prompt (Y/N) */}
					<Match when={showApprovalPrompt()}>
						<ApprovalPrompt content={pendingAsk()!.content} />
					</Match>

					{/* Normal text input */}
					<Match when={true}>
						<box flexDirection="column">
							<HorizontalLine active={true} />
							<Prompt
								placeholder={isComplete() ? "Type to continue..." : ""}
								onSubmit={(text) => ext.handleSubmit(text)}
								isActive={true}
								prefix="› "
								enableTriggers={true}
							/>
							<HorizontalLine active={true} />
						</box>
					</Match>
				</Switch>
			</box>

			{/* Footer */}
			<SessionFooter />
		</box>
	)
}
