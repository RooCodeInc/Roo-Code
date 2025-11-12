"use client"

import { Search } from "lucide-react"

interface SearchBarProps {
	value: string
	onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
	return (
		<div className="relative">
			<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<input
				type="text"
				placeholder="Search models..."
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full rounded-lg border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			/>
		</div>
	)
}
