import { memo } from "react"

import { ToolUseBlock, ToolUseBlockHeader } from "../common/ToolUseBlock"
import { PathTooltip } from "../ui/PathTooltip"

interface DirPermissionItem {
	path: string
	key: string
}

interface BatchListFilesPermissionProps {
	dirs: DirPermissionItem[]
	ts: number
}

export const BatchListFilesPermission = memo(({ dirs = [], ts }: BatchListFilesPermissionProps) => {
	if (!dirs?.length) {
		return null
	}

	return (
		<div className="pt-[5px]">
			<div className="flex flex-col gap-0 border border-border rounded-md p-1">
				{dirs.map((dir, index) => {
					return (
						<div key={`${dir.path}-${index}-${ts}`} className="flex items-center gap-2">
							<ToolUseBlock className="flex-1">
								<ToolUseBlockHeader>
									<PathTooltip content={dir.path}>
										<span className="whitespace-nowrap overflow-hidden text-ellipsis text-left mr-2 rtl">
											{dir.path}
										</span>
									</PathTooltip>
									<div className="flex-grow"></div>
								</ToolUseBlockHeader>
							</ToolUseBlock>
						</div>
					)
				})}
			</div>
		</div>
	)
})

BatchListFilesPermission.displayName = "BatchListFilesPermission"
