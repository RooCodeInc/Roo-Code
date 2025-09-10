import { memo, ReactNode, useEffect, useState, useRef } from "react"
import styled from "styled-components"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"

interface DismissibleUpsellProps {
	/** Required unique identifier for this upsell */
	id: string
	/** Optional CSS class name for styling */
	className?: string
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

const DismissibleUpsell = memo(({ id, className, children, variant = "banner", onDismiss }: DismissibleUpsellProps) => {
	const { t } = useAppTranslation()
	const [isVisible, setIsVisible] = useState(true)
	const isMountedRef = useRef(true)

	useEffect(() => {
		// Track mounted state
		isMountedRef.current = true

		// Request the current list of dismissed upsells from the extension
		vscode.postMessage({ type: "getDismissedUpsells" })

		// Listen for the response
		const handleMessage = (event: MessageEvent) => {
			// Only update state if component is still mounted
			if (!isMountedRef.current) return

			const message = event.data
			// Add null/undefined check for message
			if (message && message.type === "dismissedUpsells" && Array.isArray(message.list)) {
				// Check if this upsell has been dismissed
				if (message.list.includes(id)) {
					setIsVisible(false)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			isMountedRef.current = false
			window.removeEventListener("message", handleMessage)
		}
	}, [id])

	const handleDismiss = async () => {
		// First notify the extension to persist the dismissal
		// This ensures the message is sent even if the component unmounts quickly
		vscode.postMessage({
			type: "dismissUpsell",
			upsellId: id,
		})

		// Then hide the upsell
		setIsVisible(false)

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
				aria-label={t("common:dismiss")}
				title={t("common:dismissAndDontShowAgain")}>
				<DismissIcon />
			</DismissButton>
		</UpsellContainer>
	)
})

DismissibleUpsell.displayName = "DismissibleUpsell"

export default DismissibleUpsell
