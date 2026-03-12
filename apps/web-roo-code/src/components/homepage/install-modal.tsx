"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/modal"
import { motion } from "framer-motion"

interface Editor {
	name: string
	icon: React.ReactNode
	href: string
}

// VS Code icon
const VSCodeIcon = () => (
	<svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path
			d="M74.5 13.5L39.5 45L21.5 30.5L13.5 34V66L21.5 69.5L39.5 55L74.5 86.5L86.5 81.5V18.5L74.5 13.5Z"
			fill="#007ACC"
		/>
		<path d="M74.5 13.5L39.5 45L21.5 30.5L13.5 34V66L21.5 69.5L39.5 55L74.5 86.5" fill="#1F9CF0" />
		<path d="M21.5 30.5L13.5 34V66L21.5 69.5V30.5Z" fill="#0065A9" />
		<path d="M74.5 13.5L86.5 18.5V81.5L74.5 86.5V13.5Z" fill="#0065A9" />
	</svg>
)

// VS Code Insiders icon
const VSCodeInsidersIcon = () => (
	<svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path
			d="M74.5 13.5L39.5 45L21.5 30.5L13.5 34V66L21.5 69.5L39.5 55L74.5 86.5L86.5 81.5V18.5L74.5 13.5Z"
			fill="#24BFA5"
		/>
		<path d="M74.5 13.5L39.5 45L21.5 30.5L13.5 34V66L21.5 69.5L39.5 55L74.5 86.5" fill="#3DC9A9" />
		<path d="M21.5 30.5L13.5 34V66L21.5 69.5V30.5Z" fill="#1A9E82" />
		<path d="M74.5 13.5L86.5 18.5V81.5L74.5 86.5V13.5Z" fill="#1A9E82" />
	</svg>
)

// Cursor icon
const CursorIcon = () => (
	<svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect width="100" height="100" rx="12" fill="#1E1E1E" />
		<path d="M30 25L70 50L30 75V25Z" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinejoin="round" />
	</svg>
)

// Windsurf icon
const WindsurfIcon = () => (
	<svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect width="100" height="100" rx="12" fill="#0F0F0F" />
		<path
			d="M25 65L40 35L55 55L75 25"
			fill="none"
			stroke="#06B6D4"
			strokeWidth="6"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M25 75L50 50L75 75"
			fill="none"
			stroke="#8B5CF6"
			strokeWidth="6"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
)

const editors: Editor[] = [
	{
		name: "VS Code",
		icon: <VSCodeIcon />,
		href: "vscode:extension/RooVeterinaryInc.roo-cline",
	},
	{
		name: "VS Code Insiders",
		icon: <VSCodeInsidersIcon />,
		href: "vscode-insiders:extension/RooVeterinaryInc.roo-cline",
	},
	{
		name: "Cursor",
		icon: <CursorIcon />,
		href: "cursor:extension/RooVeterinaryInc.roo-cline",
	},
	{
		name: "Windsurf",
		icon: <WindsurfIcon />,
		href: "windsurf:extension/RooVeterinaryInc.roo-cline",
	},
]

interface InstallModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function InstallModal({ open, onOpenChange }: InstallModalProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px] p-6">
				<DialogHeader className="text-center pb-4">
					<DialogTitle className="text-2xl font-bold text-center">Install Roo Code</DialogTitle>
					<DialogDescription className="text-center text-muted-foreground">Select your IDE</DialogDescription>
				</DialogHeader>

				<div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
					{editors.map((editor, index) => (
						<motion.div
							key={editor.name}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: index * 0.05, duration: 0.3 }}
							className="group relative">
							<div className="relative flex items-center gap-3 p-2.5 bg-muted/30 border border-border/50 rounded-lg hover:bg-muted/50 hover:border-border transition-colors duration-150">
								<div className="relative flex-shrink-0">
									<div className="w-12 h-12 bg-background shadow-sm border border-border/50 rounded-lg p-2 overflow-hidden">
										{editor.icon}
									</div>
								</div>
								<div className="flex-grow min-w-0">
									<h3 className="text-base font-semibold text-foreground">{editor.name}</h3>
								</div>
								<div className="flex items-center">
									<a
										href={editor.href}
										target={editor.href.startsWith("http") ? "_blank" : undefined}
										rel={editor.href.startsWith("http") ? "noopener noreferrer" : undefined}
										className="px-4 py-2 bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground text-xs font-semibold rounded-md transition-colors duration-150 shadow-sm">
										Install
									</a>
								</div>
							</div>
						</motion.div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	)
}
