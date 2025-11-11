import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { vi } from "vitest"

import { CodeIndexSettings } from "../CodeIndexSettings"
import { TooltipProvider } from "@src/components/ui"

/**
 * CodeIndexSettings tests:
 * - verify built-in ignore checkbox is controlled via enableBuiltInIgnore prop
 * - verify it writes back through setCachedStateField with the correct key
 *
 * These tests ensure our performance/indexing settings wiring stays stable
 * and that built-in ignore remains an explicit, optional booster configured only via Settings.
 */
describe("CodeIndexSettings - built-in ignore and performance settings", () => {
	const renderWithProps = (props?: Partial<React.ComponentProps<typeof CodeIndexSettings>>) => {
		const setCachedStateField = vi.fn()

		render(
			<TooltipProvider>
				<CodeIndexSettings
					mode={"auto"}
					maxParallelFileReads={16}
					maxParallelEmbeddings={4}
					chunkSizeTokens={2048}
					enableBuiltInIgnore={false}
					setCachedStateField={setCachedStateField}
					{...props}
				/>
			</TooltipProvider>,
		)

		return { setCachedStateField }
	}

	it("renders built-in ignore checkbox unchecked when enableBuiltInIgnore is false", () => {
		const { setCachedStateField } = renderWithProps({ enableBuiltInIgnore: false })

		const checkbox = screen.getByRole("checkbox")
		expect(checkbox).toBeInTheDocument()
		expect(checkbox).not.toBeChecked()

		fireEvent.click(checkbox)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexEnableBuiltInIgnore", true as any)
	})

	it("honors enableBuiltInIgnore=true by wiring change handler (no forced default checked)", () => {
		const { setCachedStateField } = renderWithProps({ enableBuiltInIgnore: true })

		const checkbox = screen.getByRole("checkbox")
		expect(checkbox).toBeInTheDocument()

		// Toggle off
		fireEvent.click(checkbox)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexEnableBuiltInIgnore", false as any)
	})
	it("applies lowResource preset when mode is changed to Low resource via select", () => {
		const { setCachedStateField } = renderWithProps({
			mode: "auto",
			maxParallelFileReads: 16,
			maxParallelEmbeddings: 4,
			chunkSizeTokens: 2048,
		})

		// Orient ourselves to real Radix Select:
		// trigger with combobox role, options as list elements with visible text.
		const modeSelectTrigger = screen.getByRole("combobox")
		fireEvent.click(modeSelectTrigger)

		// Select option by visible text "Low resource"
		const lowResourceOption = screen.getByText("Low resource")
		fireEvent.click(lowResourceOption)

		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMode", "lowResource")

		// Verify that applyRecommended("lowResource") applied the preset
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMaxParallelFileReads", 3 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMaxParallelEmbeddings", 1 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexChunkSizeTokens", 512 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexEnableBuiltInIgnore", true as any)
	})

	it("applies normal preset when mode is changed to Normal via select", () => {
		const { setCachedStateField } = renderWithProps({
			mode: "auto",
			maxParallelFileReads: 3,
			maxParallelEmbeddings: 1,
			chunkSizeTokens: 512,
		})

		const modeSelectTrigger = screen.getByRole("combobox")
		fireEvent.click(modeSelectTrigger)

		// Select option by visible text "Normal"
		const normalOption = screen.getByText("Normal")
		fireEvent.click(normalOption)

		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMode", "normal")

		// Verify that applyRecommended("normal") applied the preset
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMaxParallelFileReads", 12 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMaxParallelEmbeddings", 4 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexChunkSizeTokens", 2048 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexEnableBuiltInIgnore", true as any)
	})

	it("applies lowResource preset when clicking 'Use Low-resource defaults' button", () => {
		const { setCachedStateField } = renderWithProps({
			mode: "auto",
			maxParallelFileReads: 16,
			maxParallelEmbeddings: 4,
			chunkSizeTokens: 2048,
		})

		// Button renders visible text via defaultValue.
		const lowResourceButton = screen.getByText("Use Low-resource defaults")
		fireEvent.click(lowResourceButton)

		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMode", "lowResource")
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMaxParallelFileReads", 3 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMaxParallelEmbeddings", 1 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexChunkSizeTokens", 512 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexEnableBuiltInIgnore", true as any)
	})

	it("applies normal preset when clicking 'Use Normal defaults' button", () => {
		const { setCachedStateField } = renderWithProps({
			mode: "auto",
			maxParallelFileReads: 3,
			maxParallelEmbeddings: 1,
			chunkSizeTokens: 512,
		})

		const normalButton = screen.getByText("Use Normal defaults")
		fireEvent.click(normalButton)

		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMode", "normal")
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMaxParallelFileReads", 12 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexMaxParallelEmbeddings", 4 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexChunkSizeTokens", 2048 as any)
		expect(setCachedStateField).toHaveBeenCalledWith("codeIndexEnableBuiltInIgnore", true as any)
	})
})
