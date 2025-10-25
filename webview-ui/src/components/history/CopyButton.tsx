import { useCallback } from "react"

import { useClipboard } from "@/components/ui/hooks"
import { Button, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"

type CopyButtonProps = {
	itemTask: string
	itemImages?: string[]
}

export const CopyButton = ({ itemTask, itemImages = [] }: CopyButtonProps) => {
	const { isCopied, copy } = useClipboard()
	const { t } = useAppTranslation()

	const onCopy = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()

			if (!isCopied) {
				copy({ text: itemTask, images: itemImages })
			}
		},
		[isCopied, copy, itemTask, itemImages],
	)

	return (
		<StandardTooltip content={t("history:copyPrompt")}>
			<Button
				variant="ghost"
				size="icon"
				onClick={onCopy}
				className="group-hover:opacity-100 opacity-50 transition-opacity"
				data-testid="copy-prompt-button">
				<span className={cn("codicon scale-80", { "codicon-check": isCopied, "codicon-copy": !isCopied })} />
			</Button>
		</StandardTooltip>
	)
}
