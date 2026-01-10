// npx vitest run src/components/settings/__tests__/SettingsSearchResults.spec.tsx

import { render, screen, fireEvent } from "@/utils/test-utils"
import type { LucideIcon } from "lucide-react"

import { SettingsSearchResults } from "../SettingsSearchResults"
import type { SearchResult } from "@/hooks/useSettingsSearch"
import type { SectionName } from "@/utils/parseSettingsI18nKeys"

// Mock useAppTranslation
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: Record<string, any>) => {
			const translations: Record<string, string> = {
				"settings:sections.browser": "Browser",
				"settings:sections.notifications": "Notifications",
				"settings:sections.checkpoints": "Checkpoints",
				"settings:search.noResults": `No results found for "${options?.query}"`,
			}
			return translations[key] || key
		},
		i18n: {},
	}),
}))

// Mock icon component - cast to LucideIcon for type compatibility in tests
const MockIcon = (({ className, ...props }: { className?: string }) => (
	<div data-testid="section-icon" className={className} {...props} />
)) as unknown as LucideIcon

describe("SettingsSearchResults", () => {
	// Mock data
	const mockBrowserResults: SearchResult[] = [
		{
			id: "browser.enable",
			tab: "browser",
			labelKey: "settings:browser.enable.label",
			descriptionKey: "settings:browser.enable.description",
			translatedLabel: "Enable browser tool",
			translatedDescription: "Allows Roo to use a browser",
			matchScore: 15,
		},
		{
			id: "browser.viewport",
			tab: "browser",
			labelKey: "settings:browser.viewport.label",
			descriptionKey: "settings:browser.viewport.description",
			translatedLabel: "Browser viewport",
			translatedDescription: "Configure the browser window size",
			matchScore: 15,
		},
	]

	const mockNotificationsResults: SearchResult[] = [
		{
			id: "notifications.sound",
			tab: "notifications",
			labelKey: "settings:notifications.sound.label",
			descriptionKey: "settings:notifications.sound.description",
			translatedLabel: "Sound effects",
			translatedDescription: "Play sound when Roo needs attention",
			matchScore: 10,
		},
	]

	const mockCheckpointsResults: SearchResult[] = [
		{
			id: "checkpoints.timeout",
			tab: "checkpoints",
			labelKey: "settings:checkpoints.timeout.label",
			descriptionKey: undefined,
			translatedLabel: "Checkpoint timeout",
			translatedDescription: undefined,
			matchScore: 10,
		},
	]

	const mockSections = [
		{ id: "browser" as SectionName, icon: MockIcon },
		{ id: "notifications" as SectionName, icon: MockIcon },
		{ id: "checkpoints" as SectionName, icon: MockIcon },
	]

	describe("empty results", () => {
		it('should show "no results" message when results array is empty', () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={[]}
					query="nonexistent"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			const noResultsMessage = screen.getByText(/No results found for/i)
			expect(noResultsMessage).toBeInTheDocument()
			expect(noResultsMessage).toHaveTextContent('No results found for "nonexistent"')
		})

		it("should not render any result items when empty", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={[]}
					query="test"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			const options = screen.queryAllByRole("option")
			expect(options).toHaveLength(0)
		})
	})

	describe("grouping by tab", () => {
		it("should group results by tab", () => {
			const onSelectResult = vi.fn()
			const allResults = [...mockBrowserResults, ...mockNotificationsResults]

			render(
				<SettingsSearchResults
					results={allResults}
					query="test"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			// Check for tab headers
			expect(screen.getByText("Browser")).toBeInTheDocument()
			expect(screen.getByText("Notifications")).toBeInTheDocument()
		})

		it("should display results under their respective tabs", () => {
			const onSelectResult = vi.fn()
			const allResults = [...mockBrowserResults, ...mockNotificationsResults]

			render(
				<SettingsSearchResults
					results={allResults}
					query="test"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			// Browser results
			expect(screen.getByText("Enable browser tool")).toBeInTheDocument()
			expect(screen.getByText("Browser viewport")).toBeInTheDocument()

			// Notifications results
			expect(screen.getByText("Sound effects")).toBeInTheDocument()
		})
	})

	describe("tab headers", () => {
		it("should display tab headers with icons", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={mockBrowserResults}
					query="browser"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			// Use getAllByText since "Browser" appears in both the tab header and highlighted in results
			const browserElements = screen.getAllByText(/Browser/i)
			expect(browserElements.length).toBeGreaterThan(0)

			const icons = screen.getAllByTestId("section-icon")
			expect(icons.length).toBeGreaterThan(0)
		})

		it("should display translated tab names", () => {
			const onSelectResult = vi.fn()
			const allResults = [...mockBrowserResults, ...mockNotificationsResults, ...mockCheckpointsResults]

			render(
				<SettingsSearchResults
					results={allResults}
					query="test"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			expect(screen.getByText("Browser")).toBeInTheDocument()
			expect(screen.getByText("Notifications")).toBeInTheDocument()
			expect(screen.getByText("Checkpoints")).toBeInTheDocument()
		})
	})

	describe("result items", () => {
		it("should display translated labels for each result", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={mockBrowserResults}
					query="browser"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			// Use flexible matchers since HighlightMatch splits text across elements
			expect(
				screen.getByText((_, element) => {
					return element?.textContent === "Enable browser tool"
				}),
			).toBeInTheDocument()
			expect(
				screen.getByText((_, element) => {
					return element?.textContent === "Browser viewport"
				}),
			).toBeInTheDocument()
		})

		it("should display descriptions when available", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={mockBrowserResults}
					query="browser"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			// Use flexible matchers since HighlightMatch splits text across elements
			expect(
				screen.getByText((_, element) => {
					return element?.textContent === "Allows Roo to use a browser"
				}),
			).toBeInTheDocument()
			expect(
				screen.getByText((_, element) => {
					return element?.textContent === "Configure the browser window size"
				}),
			).toBeInTheDocument()
		})

		it("should not display descriptions when not available", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={mockCheckpointsResults}
					query="checkpoint"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			// Label should be present - check that option exists
			const checkpointButton = screen.getByRole("option")
			expect(checkpointButton).toBeInTheDocument()
			expect(checkpointButton.textContent).toContain("Checkpoint timeout")

			// Description should not be present (it's undefined for this setting)
			const descriptionElements = checkpointButton.querySelectorAll(".text-xs.text-vscode-descriptionForeground")
			expect(descriptionElements).toHaveLength(0)
		})

		it("should render results as clickable listbox options", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={mockBrowserResults}
					query="browser"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			const options = screen.getAllByRole("option")
			expect(options.length).toBe(mockBrowserResults.length)
		})
	})

	describe("clicking results", () => {
		it("should call onSelectResult with the result when clicked", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={mockBrowserResults}
					query="browser"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			// Click the first option (the result item itself is a button with role option)
			const options = screen.getAllByRole("option")
			fireEvent.click(options[0])

			expect(onSelectResult).toHaveBeenCalledTimes(1)
			expect(onSelectResult).toHaveBeenCalledWith(mockBrowserResults[0])
		})

		it("should call onSelectResult with the correct result for each click", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={mockBrowserResults}
					query="browser"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			const options = screen.getAllByRole("option")

			// Click first result
			fireEvent.click(options[0])
			expect(onSelectResult).toHaveBeenLastCalledWith(mockBrowserResults[0])

			// Click second result
			fireEvent.click(options[1])
			expect(onSelectResult).toHaveBeenLastCalledWith(mockBrowserResults[1])

			expect(onSelectResult).toHaveBeenCalledTimes(2)
		})
	})

	describe("HighlightMatch component", () => {
		it("should highlight matching text in labels", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={mockBrowserResults}
					query="browser"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			// Check for <mark> elements (used for highlighting)
			const marks = screen.getAllByText((_content, element) => {
				return element?.tagName.toLowerCase() === "mark"
			})

			expect(marks.length).toBeGreaterThan(0)
		})

		it("should highlight matching text in descriptions", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={mockBrowserResults}
					query="browser"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			// Query "browser" appears in descriptions too
			const marks = screen.getAllByText((_content, element) => {
				return element?.tagName.toLowerCase() === "mark"
			})

			// Should have highlights in both labels and descriptions
			expect(marks.length).toBeGreaterThan(mockBrowserResults.length)
		})

		it("should be case-insensitive when highlighting", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={mockBrowserResults}
					query="BROWSER"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			// Should still highlight "browser" text even though query is uppercase
			const marks = screen.getAllByText((_content, element) => {
				return element?.tagName.toLowerCase() === "mark"
			})

			expect(marks.length).toBeGreaterThan(0)
		})

		it("should not highlight when query is empty", () => {
			const onSelectResult = vi.fn()
			render(
				<SettingsSearchResults
					results={mockBrowserResults}
					query=""
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			const marks = screen.queryAllByText((_content, element) => {
				return element?.tagName.toLowerCase() === "mark"
			})

			expect(marks).toHaveLength(0)
		})
	})

	describe("multiple tabs with mixed results", () => {
		it("should handle results from multiple tabs correctly", () => {
			const onSelectResult = vi.fn()
			const allResults = [...mockBrowserResults, ...mockNotificationsResults, ...mockCheckpointsResults]

			render(
				<SettingsSearchResults
					results={allResults}
					query="test"
					onSelectResult={onSelectResult}
					sections={mockSections}
				/>,
			)

			// All tab headers should be present
			expect(screen.getByText("Browser")).toBeInTheDocument()
			expect(screen.getByText("Notifications")).toBeInTheDocument()
			expect(screen.getByText("Checkpoints")).toBeInTheDocument()

			// All results should be present
			expect(screen.getByText("Enable browser tool")).toBeInTheDocument()
			expect(screen.getByText("Browser viewport")).toBeInTheDocument()
			expect(screen.getByText("Sound effects")).toBeInTheDocument()
			expect(screen.getByText("Checkpoint timeout")).toBeInTheDocument()

			// Should have correct number of clickable results
			const options = screen.getAllByRole("option")
			expect(options).toHaveLength(allResults.length)
		})
	})
})
