"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

interface CopySettingsButtonProps {
	settings: {
		provider: string
		model: string
		temperature: number
		reasoningEffort?: string
	}
}

export function CopySettingsButton({ settings }: CopySettingsButtonProps) {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		const json = JSON.stringify(settings, null, 2)
		await navigator.clipboard.writeText(json)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	return (
		<button
			onClick={handleCopy}
			className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/50 bg-card/50 px-4 py-2.5 text-sm font-medium text-foreground/80 backdrop-blur-sm transition-all duration-200 hover:bg-card/80 hover:text-foreground hover:border-border active:scale-[0.98]">
			{copied ? (
				<>
					<Check className="size-4 text-green-400" />
					Copied!
				</>
			) : (
				<>
					<Copy className="size-4 text-muted-foreground" />
					Copy Roo Code Cloud Config
				</>
			)}
		</button>
	)
}
