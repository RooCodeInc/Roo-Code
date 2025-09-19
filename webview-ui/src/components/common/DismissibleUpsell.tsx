import { memo, ReactNode } from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { DismissedUpsellsProvider, useDismissedUpsells } from "@src/context/DismissedUpsellsContext"

interface DismissibleUpsellProps {
	/** Required unique identifier for this upsell */
	upsellId: string
	/** Optional CSS class name for styling */
	className?: string
	/** Optional Icon component */
	icon?: ReactNode
	/** Content to display inside the upsell */
	children: ReactNode
	/** Visual variant of the upsell */
	variant?: "default" | "banner"
	/** Optional callback when upsell is dismissed */
	onDismiss?: () => void
	/** Optional callback when upsell is clicked */
	onClick?: () => void
	/** Whether clicking the upsell should also dismiss it (default: false) */
	dismissOnClick?: boolean
}

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

// Internal component that uses the context
const DismissibleUpsellInternal = memo(
	({
		upsellId,
		className,
		icon,
		children,
		variant = "default",
		onDismiss,
		onClick,
		dismissOnClick = false,
	}: DismissibleUpsellProps) => {
		const { t } = useAppTranslation()
		const { isUpsellVisible, dismissUpsell, isLoading } = useDismissedUpsells()

		// Check if this upsell is visible
		const isVisible = isUpsellVisible(upsellId)

		const handleDismiss = () => {
			// Dismiss the upsell through the context
			dismissUpsell(upsellId)

			// Call the optional callback
			onDismiss?.()
		}

		// Don't render if not visible or still loading
		if (!isVisible || isLoading) {
			return null
		}

		const variants = {
			banner: {
				container:
					"p-2 bg-vscode-badge-background/80 text-vscode-badge-foreground border-vscode-dropdown-border border",
				button: "text-vscode-badge-foreground",
			},
			default: {
				container: "bg-vscode-notifications-background text-vscode-notifications-foreground",
				button: "text-vscode-notifications-foreground",
			},
		}

		// Build container classes based on variant and presence of click handler
		const containerClasses = [
			"relative flex items-start justify-between gap-2",
			"text-sm",
			variants[variant].container,
			onClick && "cursor-pointer hover:opacity-90 transition-opacity duration-200",
			className,
		]
			.filter(Boolean)
			.join(" ")

		// Build button classes based on variant
		const buttonClasses = [
			"flex items-center justify-center",
			"rounded",
			"bg-transparent",
			"border-none",
			"cursor-pointer",
			"hover:opacity-50 transition-opacity duration-200",
			variants[variant].button,
			"focus:outline focus:outline-1 focus:outline-vscode-focusBorder focus:outline-offset-1",
		].join(" ")

		return (
			<div
				className={containerClasses}
				onClick={() => {
					// Call the onClick handler if provided
					onClick?.()
					// Also dismiss if dismissOnClick is true
					if (dismissOnClick) {
						handleDismiss()
					}
				}}>
				{icon && icon}
				<div>{children}</div>
				<button
					className={buttonClasses}
					onClick={(e) => {
						e.stopPropagation() // Prevent triggering the container's onClick
						handleDismiss()
					}}
					aria-label={t("common:dismiss")}
					title={t("common:dismissAndDontShowAgain")}>
					<DismissIcon />
				</button>
			</div>
		)
	},
)

DismissibleUpsellInternal.displayName = "DismissibleUpsellInternal"

// Wrapper component that provides the context
const DismissibleUpsell = memo((props: DismissibleUpsellProps) => {
	return (
		<DismissedUpsellsProvider>
			<DismissibleUpsellInternal {...props} />
		</DismissedUpsellsProvider>
	)
})

DismissibleUpsell.displayName = "DismissibleUpsell"

export default DismissibleUpsell
