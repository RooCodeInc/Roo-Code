import { render, screen } from "@/utils/test-utils"

import { TranslationProvider } from "@/i18n/__mocks__/TranslationContext"

import { BatchListFilesPermission } from "../BatchListFilesPermission"

describe("BatchListFilesPermission", () => {
	const mockDirs = [
		{
			key: "apps/cli",
			path: "apps/cli",
			recursive: false,
			isOutsideWorkspace: false,
		},
		{
			key: "apps/web-roo-code",
			path: "apps/web-roo-code",
			recursive: false,
			isOutsideWorkspace: false,
		},
		{
			key: "packages/core",
			path: "packages/core",
			recursive: true,
			isOutsideWorkspace: false,
		},
	]

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders directory list correctly", () => {
		render(
			<TranslationProvider>
				<BatchListFilesPermission dirs={mockDirs} ts={Date.now()} />
			</TranslationProvider>,
		)

		expect(screen.getByText("apps/cli")).toBeInTheDocument()
		expect(screen.getByText("apps/web-roo-code")).toBeInTheDocument()
		expect(screen.getByText("packages/core")).toBeInTheDocument()
	})

	it("renders nothing when dirs array is empty", () => {
		const { container } = render(
			<TranslationProvider>
				<BatchListFilesPermission dirs={[]} ts={Date.now()} />
			</TranslationProvider>,
		)

		expect(container.firstChild).toBeNull()
	})

	it("re-renders when timestamp changes", () => {
		const { rerender } = render(
			<TranslationProvider>
				<BatchListFilesPermission dirs={mockDirs} ts={1000} />
			</TranslationProvider>,
		)

		expect(screen.getByText("apps/cli")).toBeInTheDocument()

		rerender(
			<TranslationProvider>
				<BatchListFilesPermission dirs={mockDirs} ts={2000} />
			</TranslationProvider>,
		)

		expect(screen.getByText("apps/cli")).toBeInTheDocument()
	})

	it("renders all directories in a single container", () => {
		render(
			<TranslationProvider>
				<BatchListFilesPermission dirs={mockDirs} ts={Date.now()} />
			</TranslationProvider>,
		)

		// All directories should be within a single bordered container
		const container = screen.getByText("apps/cli").closest(".border.border-border.rounded-md")
		expect(container).toBeInTheDocument()

		// All 3 dirs should be inside this container
		expect(container?.querySelectorAll(".flex.items-center.gap-2")).toHaveLength(mockDirs.length)
	})
})
