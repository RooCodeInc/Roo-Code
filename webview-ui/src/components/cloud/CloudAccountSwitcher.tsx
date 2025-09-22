import React, { useMemo } from "react"
import { User } from "lucide-react"

import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"

import type { CloudUserInfo, CloudOrganizationMembership } from "@roo-code/types"

import { StandardTooltip, Button } from "@src/components/ui"

interface CloudAccountSwitcherProps {
	className?: string
	userInfo: CloudUserInfo | null
	organizationMemberships?: CloudOrganizationMembership[]
}

export const CloudAccountSwitcher: React.FC<CloudAccountSwitcherProps> = ({
	className,
	userInfo,
	organizationMemberships = [],
}) => {
	const { t } = useAppTranslation()

	// Calculate if user has multiple accounts
	// User has multiple accounts if:
	// 1. They have 2+ organization memberships, OR
	// 2. They have 1+ organization membership and can also use personal account
	const hasMultipleAccounts = useMemo(() => {
		if (!userInfo) return false

		// If user has multiple org memberships
		if (organizationMemberships.length >= 2) return true

		// If user has at least one org membership, they also have personal account access
		if (organizationMemberships.length >= 1) return true

		return false
	}, [userInfo, organizationMemberships])

	// Don't render if user doesn't have multiple accounts
	if (!hasMultipleAccounts) {
		return null
	}

	const handleAccountSwitch = () => {
		vscode.postMessage({ type: "rooCloudAccountSwitch" })
	}

	// Determine which icon to show
	const renderAccountIcon = () => {
		// If in organization context and has org image
		if (userInfo?.organizationId && userInfo?.organizationImageUrl) {
			return (
				<img
					src={userInfo.organizationImageUrl}
					alt={userInfo.organizationName || "Organization"}
					className="w-4 h-4 rounded-full object-cover"
				/>
			)
		}

		// If user has profile picture
		if (userInfo?.picture) {
			return (
				<img
					src={userInfo.picture}
					alt={userInfo.name || userInfo.email || "User"}
					className="w-4 h-4 rounded-full object-cover"
				/>
			)
		}

		// Default user icon
		return <User className="w-4 h-4" />
	}

	return (
		<StandardTooltip content={t("cloud:switchAccount")}>
			<Button
				variant="ghost"
				size="sm"
				onClick={handleAccountSwitch}
				aria-label={t("cloud:switchAccount")}
				className={cn(
					"relative h-5 w-5 p-0",
					"text-vscode-foreground opacity-85",
					"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]",
					"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
					className,
				)}>
				{renderAccountIcon()}
			</Button>
		</StandardTooltip>
	)
}
