import { memo, ReactNode, useEffect, useState } from "react"
import styled from "styled-components"

import { vscode } from "@src/utils/vscode"

interface DismissibleUpsellProps {
	/** Required unique identifier for this upsell */
	className: string
	/** Content to display inside the upsell */
	children: ReactNode
	/** Visual variant of the upsell */
	variant?: "banner" | "default"
	/** Optional callback when upsell is dismissed */
	onDismiss?: () => void
}

const UpsellContainer = styled.div<{ $variant: "banner" | "default" }>`
	position: relative;
	padding: 12px 40px 12px 16px;
	border-radius: 6px;
	margin-bottom: 8px;
	display: flex;
	align-items: center;

	${(props) =>
		props.$variant === "banner"
			? `
		background-color: var(--vscode-button-background);
		color: var(--vscode-button-foreground);
	`
			: `
		background-color: var(--vscode-notifications-background);
		color: var(--vscode-notifications-foreground);
		border: 1px solid var(--vscode-notifications-border);
	`}
`

const DismissButton = styled.button<{ $variant: "banner" | "default" }>`
	position: absolute;
	top: 50%;
	right: 12px;
	transform: translateY(-50%);
	background: none;
	border: none;
	cursor: pointer;
	padding: 4px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 4px;
	transition: background-color 0.2s;

	${(props) =>
		props.$variant === "banner"
			? `
		color: var(--vscode-button-foreground);
		
		&:hover {
			background-color: rgba(255, 255, 255, 0.1);
		}
	`
			: `
		color: var(--vscode-notifications-foreground);
		
		&:hover {
			background-color: var(--vscode-toolbar-hoverBackground);
		}
	`}

	&:focus {
		outline: 1px solid var(--vscode-focusBorder);
		outline-offset: 1px;
	}
`

const DismissIcon = () => (
	<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.647 3.646.708.707L8 8.707z"
			fill="currentColor"
		/>
	</svg>
)

const DismissibleUpsell = memo(({ className, children, variant = "banner", onDismiss }: DismissibleUpsellProps) => {
	const [isVisible, setIsVisible] = useState(true)

	useEffect(() => {
		// Request the current list of dismissed upsells from the extension
		vscode.postMessage({ type: "getDismissedUpsells" })

		// Listen for the response
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "dismissedUpsells" && Array.isArray(message.list)) {
				// Check if this upsell has been dismissed
				if (message.list.includes(className)) {
					setIsVisible(false)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [className])

	const handleDismiss = () => {
		// Hide the upsell immediately
		setIsVisible(false)

		// Notify the extension to persist the dismissal
		vscode.postMessage({
			type: "dismissUpsell",
			upsellId: className,
		})

		// Call the optional callback
		onDismiss?.()
	}

	// Don't render if not visible
	if (!isVisible) {
		return null
	}

	return (
		<UpsellContainer $variant={variant} className={className}>
			{children}
			<DismissButton
				$variant={variant}
				onClick={handleDismiss}
				aria-label="Dismiss"
				title="Dismiss and don't show again">
				<DismissIcon />
			</DismissButton>
		</UpsellContainer>
	)
})

DismissibleUpsell.displayName = "DismissibleUpsell"

export default DismissibleUpsell
