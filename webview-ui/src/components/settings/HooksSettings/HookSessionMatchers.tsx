import React from "react"

import {
	sessionMatchers,
	sessionMatcherDescriptions,
	type SessionMatcher,
	type SessionMatchersConfig,
} from "@roo-code/types"

import { Checkbox } from "@/components/ui"

interface HookSessionMatchersProps {
	matchers: SessionMatchersConfig | undefined
	onChange: (matchers: SessionMatchersConfig) => void
	disabled?: boolean
}

/**
 * Session matcher checkboxes for SessionStart hooks.
 * Displays checkboxes for: Startup, Resume, Clear, Compact.
 */
export const HookSessionMatchers: React.FC<HookSessionMatchersProps> = ({ matchers, onChange, disabled = false }) => {
	const selectedSessionTypes = matchers?.sessionType ?? []

	const handleToggle = (sessionType: SessionMatcher) => {
		const newSessionTypes = selectedSessionTypes.includes(sessionType)
			? selectedSessionTypes.filter((s) => s !== sessionType)
			: [...selectedSessionTypes, sessionType]

		onChange({
			...matchers,
			sessionType: newSessionTypes,
		})
	}

	return (
		<div className="space-y-2">
			<label className="text-sm font-medium text-vscode-foreground">Matchers</label>
			<div className="grid grid-cols-2 gap-2">
				{sessionMatchers.map((sessionType) => {
					const isChecked = selectedSessionTypes.includes(sessionType)
					const description = sessionMatcherDescriptions[sessionType]
					const label = sessionType.charAt(0).toUpperCase() + sessionType.slice(1)

					return (
						<div key={sessionType} className="flex items-center gap-2">
							<Checkbox
								id={`session-matcher-${sessionType}`}
								checked={isChecked}
								onCheckedChange={() => handleToggle(sessionType)}
								disabled={disabled}
							/>
							<label
								htmlFor={`session-matcher-${sessionType}`}
								className="text-sm text-vscode-foreground cursor-pointer">
								{label} <span className="text-vscode-descriptionForeground">({description})</span>
							</label>
						</div>
					)
				})}
			</div>
		</div>
	)
}
