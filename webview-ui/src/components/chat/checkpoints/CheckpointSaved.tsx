import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { CheckpointMenu } from "./CheckpointMenu"
import { checkpointSchema } from "./schema"
import { GitCommitVertical } from "lucide-react"

type CheckpointSavedProps = {
	ts: number
	commitHash: string
	currentHash?: string
	checkpoint?: Record<string, unknown>
}

export const CheckpointSaved = ({ checkpoint, ...props }: CheckpointSavedProps) => {
	const { t } = useTranslation()
	const isCurrent = props.currentHash === props.commitHash
	const [isPopoverOpen, setIsPopoverOpen] = useState(false)

	const metadata = useMemo(() => {
		if (!checkpoint) {
			return undefined
		}

		const result = checkpointSchema.safeParse(checkpoint)

		if (!result.success) {
			return undefined
		}

		return result.data
	}, [checkpoint])

	if (!metadata) {
		return null
	}

	return (
		<div className="group flex items-center justify-between gap-2 pt-2 pb-3 ">
			<div className="flex items-center gap-2 text-blue-400">
				<GitCommitVertical className="w-4" />
				<span className="font-semibold">{t("chat:checkpoint.regular")}</span>
				{isCurrent && <span className="text-muted">({t("chat:checkpoint.current")})</span>}
			</div>
			<span
				className="block w-full h-[2px] mt-[2px] text-xs"
				style={{
					backgroundImage:
						"linear-gradient(90deg, rgba(0, 188, 255, .65), rgba(0, 188, 255, .65) 80%, rgba(0, 188, 255, 0) 99%)",
				}}></span>

			<div className={`h-4 -mt-2 ${isPopoverOpen ? "block" : "hidden group-hover:block"}`}>
				<CheckpointMenu {...props} checkpoint={metadata} onPopoverOpenChange={setIsPopoverOpen} />
			</div>
		</div>
	)
}
