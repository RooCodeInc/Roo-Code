import React from "react"

import type { HookWithMetadata, HookAction } from "@roo-code/types"

import { HookActionEditor } from "./HookActionEditor"

interface HookCommandTabProps {
	hook: HookWithMetadata
	onChange: (updates: Partial<HookWithMetadata>) => void
	disabled?: boolean
}

/**
 * Command/Action tab content for a hook item.
 * Uses HookActionEditor for shell/slash command editing.
 */
export const HookCommandTab: React.FC<HookCommandTabProps> = ({ hook, onChange, disabled = false }) => {
	const handleActionChange = (action: HookAction) => {
		onChange({ action })
	}

	return (
		<div className="space-y-4">
			<HookActionEditor action={hook.action} onChange={handleActionChange} disabled={disabled} />
		</div>
	)
}
