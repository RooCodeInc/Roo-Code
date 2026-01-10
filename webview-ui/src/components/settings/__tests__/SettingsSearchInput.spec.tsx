// npx vitest run src/components/settings/__tests__/SettingsSearchInput.spec.tsx

import { render, screen, fireEvent } from "@/utils/test-utils"
import { SettingsSearchInput } from "../SettingsSearchInput"

// Mock useAppTranslation
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			if (key === "settings:search.placeholder") {
				return "Search settings..."
			}
			return key
		},
		i18n: {},
	}),
}))

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	Search: ({ className, ...props }: any) => <div data-testid="search-icon" className={className} {...props} />,
	X: ({ className, ...props }: any) => <div data-testid="x-icon" className={className} {...props} />,
}))

describe("SettingsSearchInput", () => {
	describe("rendering", () => {
		it("should render input with placeholder text", () => {
			const onChange = vi.fn()
			render(<SettingsSearchInput value="" onChange={onChange} />)

			const input = screen.getByTestId("settings-search-input")
			expect(input).toBeInTheDocument()
			expect(input).toHaveAttribute("placeholder", "Search settings...")
		})

		it("should display search icon", () => {
			const onChange = vi.fn()
			render(<SettingsSearchInput value="" onChange={onChange} />)

			const searchIcon = screen.getByTestId("search-icon")
			expect(searchIcon).toBeInTheDocument()
		})

		it("should render input with correct type", () => {
			const onChange = vi.fn()
			render(<SettingsSearchInput value="" onChange={onChange} />)

			const input = screen.getByTestId("settings-search-input")
			expect(input).toHaveAttribute("type", "text")
		})
	})

	describe("clear button", () => {
		it("should hide clear button when input is empty", () => {
			const onChange = vi.fn()
			render(<SettingsSearchInput value="" onChange={onChange} />)

			const clearButton = screen.queryByRole("button", { name: /clear search/i })
			expect(clearButton).not.toBeInTheDocument()
		})

		it("should show clear button when there is text", () => {
			const onChange = vi.fn()
			render(<SettingsSearchInput value="browser" onChange={onChange} />)

			const clearButton = screen.getByRole("button", { name: /clear search/i })
			expect(clearButton).toBeInTheDocument()
		})

		it("should display X icon in clear button", () => {
			const onChange = vi.fn()
			render(<SettingsSearchInput value="test" onChange={onChange} />)

			const xIcon = screen.getByTestId("x-icon")
			expect(xIcon).toBeInTheDocument()
		})

		it("should call onChange with empty string when clear button is clicked", () => {
			const onChange = vi.fn()
			render(<SettingsSearchInput value="browser" onChange={onChange} />)

			const clearButton = screen.getByRole("button", { name: /clear search/i })
			fireEvent.click(clearButton)

			expect(onChange).toHaveBeenCalledWith("")
			expect(onChange).toHaveBeenCalledTimes(1)
		})
	})

	describe("controlled input", () => {
		it("should display the value prop", () => {
			const onChange = vi.fn()
			render(<SettingsSearchInput value="test value" onChange={onChange} />)

			const input = screen.getByTestId("settings-search-input")
			expect(input).toHaveValue("test value")
		})

		it("should call onChange when user types", () => {
			const onChange = vi.fn()
			render(<SettingsSearchInput value="" onChange={onChange} />)

			const input = screen.getByTestId("settings-search-input")
			fireEvent.change(input, { target: { value: "new text" } })

			expect(onChange).toHaveBeenCalledWith("new text")
			expect(onChange).toHaveBeenCalledTimes(1)
		})

		it("should update when value prop changes", () => {
			const onChange = vi.fn()
			const { rerender } = render(<SettingsSearchInput value="initial" onChange={onChange} />)

			const input = screen.getByTestId("settings-search-input")
			expect(input).toHaveValue("initial")

			rerender(<SettingsSearchInput value="updated" onChange={onChange} />)
			expect(input).toHaveValue("updated")
		})
	})

	describe("focus and blur callbacks", () => {
		it("should call onFocus when input is focused", () => {
			const onChange = vi.fn()
			const onFocus = vi.fn()
			render(<SettingsSearchInput value="" onChange={onChange} onFocus={onFocus} />)

			const input = screen.getByTestId("settings-search-input")
			fireEvent.focus(input)

			expect(onFocus).toHaveBeenCalledTimes(1)
		})

		it("should call onBlur when input loses focus", () => {
			const onChange = vi.fn()
			const onBlur = vi.fn()
			render(<SettingsSearchInput value="" onChange={onChange} onBlur={onBlur} />)

			const input = screen.getByTestId("settings-search-input")
			fireEvent.focus(input)
			fireEvent.blur(input)

			expect(onBlur).toHaveBeenCalledTimes(1)
		})

		it("should work without onFocus callback", () => {
			const onChange = vi.fn()
			render(<SettingsSearchInput value="" onChange={onChange} />)

			const input = screen.getByTestId("settings-search-input")
			expect(() => fireEvent.focus(input)).not.toThrow()
		})

		it("should work without onBlur callback", () => {
			const onChange = vi.fn()
			render(<SettingsSearchInput value="" onChange={onChange} />)

			const input = screen.getByTestId("settings-search-input")
			expect(() => {
				fireEvent.focus(input)
				fireEvent.blur(input)
			}).not.toThrow()
		})
	})

	describe("integration scenarios", () => {
		it("should handle typing and clearing in sequence", () => {
			const onChange = vi.fn()
			const { rerender } = render(<SettingsSearchInput value="" onChange={onChange} />)

			const input = screen.getByTestId("settings-search-input")

			// Type something
			fireEvent.change(input, { target: { value: "browser" } })
			expect(onChange).toHaveBeenCalledWith("browser")

			// Now render with the new value (simulating parent state update)
			rerender(<SettingsSearchInput value="browser" onChange={onChange} />)

			// Clear button should now be visible
			const clearButton = screen.getByRole("button", { name: /clear search/i })
			expect(clearButton).toBeInTheDocument()

			// Click clear
			fireEvent.click(clearButton)
			expect(onChange).toHaveBeenCalledWith("")
		})

		it("should handle focus, type, and blur flow", () => {
			const onChange = vi.fn()
			const onFocus = vi.fn()
			const onBlur = vi.fn()
			render(<SettingsSearchInput value="" onChange={onChange} onFocus={onFocus} onBlur={onBlur} />)

			const input = screen.getByTestId("settings-search-input")

			// Focus
			fireEvent.focus(input)
			expect(onFocus).toHaveBeenCalledTimes(1)

			// Type
			fireEvent.change(input, { target: { value: "test" } })
			expect(onChange).toHaveBeenCalledWith("test")

			// Blur
			fireEvent.blur(input)
			expect(onBlur).toHaveBeenCalledTimes(1)
		})
	})
})
