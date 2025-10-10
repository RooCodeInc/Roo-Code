import React from "react"
import { Button } from "@src/components/ui/button"
import { Badge } from "@src/components/ui/badge"
import { StandardTooltip } from "@src/components/ui/standard-tooltip"
import { ModeFamily } from "@src/components/settings/types"
import { ChevronDown, Check } from "lucide-react"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@src/components/ui/popover"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@src/components/ui/command"

interface FamilySwitcherProps {
	families: ModeFamily[]
	activeFamily: ModeFamily | null
	onFamilyChange: (familyId: string | null) => void
	className?: string
}

export const FamilySwitcher: React.FC<FamilySwitcherProps> = ({
	families,
	activeFamily,
	onFamilyChange,
	className = "",
}) => {
	const [open, setOpen] = React.useState(false)

	// Don't show switcher if no families exist
	if (families.length === 0) {
		return null
	}

	return (
		<div className={className}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className="justify-between min-w-[150px]">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-organization text-sm"></span>
							<span className="truncate">
								{activeFamily?.name || "All Modes"}
							</span>
						</div>
						<ChevronDown className="opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="p-0 w-[200px]">
					<Command>
						<CommandList>
							<CommandEmpty>No families found.</CommandEmpty>
							<CommandGroup>
								{/* "All Modes" option */}
								<CommandItem
									value="all-modes"
									onSelect={() => {
										onFamilyChange(null)
										setOpen(false)
									}}>
									<div className="flex items-center justify-between w-full">
										<span>All Modes</span>
										{!activeFamily && (
											<Check className="h-4 w-4" />
										)}
									</div>
								</CommandItem>

								{/* Family options */}
								{families.map((family) => (
									<CommandItem
										key={family.id}
										value={family.id}
										onSelect={() => {
											onFamilyChange(family.id)
											setOpen(false)
										}}>
										<div className="flex items-center justify-between w-full">
											<div className="flex items-center gap-2">
												<span>{family.name}</span>
												<Badge variant="outline" className="text-xs">
													{family.enabledModes.length}
												</Badge>
											</div>
											{family.id === activeFamily?.id && (
												<Check className="h-4 w-4" />
											)}
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	)
}