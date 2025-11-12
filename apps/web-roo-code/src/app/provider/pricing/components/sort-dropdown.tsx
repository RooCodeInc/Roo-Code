"use client"

import { SortOption } from "@/lib/types/models"

interface SortDropdownProps {
	value: SortOption
	onChange: (value: SortOption) => void
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
	return (
		<div className="flex items-center gap-2">
			<label htmlFor="sort" className="text-sm font-medium whitespace-nowrap">
				Sort by:
			</label>
			<select
				id="sort"
				value={value}
				onChange={(e) => onChange(e.target.value as SortOption)}
				className="rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
				<option value="alphabetical">Alphabetical</option>
				<option value="price-asc">Price: Low to High</option>
				<option value="price-desc">Price: High to Low</option>
				<option value="context-window-asc">Context Window: Small to Large</option>
				<option value="context-window-desc">Context Window: Large to Small</option>
			</select>
		</div>
	)
}
