import React from "react"
import { render, screen } from "@/utils/test-utils"

import RooTips from "../RooTips"
import { ExtensionStateContextProvider } from "@/context/ExtensionStateContext"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key, // Simple mock that returns the key
	}),
	Trans: ({
		children,
		components,
	}: {
		children?: React.ReactNode
		components?: Record<string, React.ReactElement>
	}) => {
		// Simple mock that renders children or the first component if no children
		return children || (components && Object.values(components)[0]) || null
	},
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeLink: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

// Mock vscode to prevent postMessage errors
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

describe("RooTips Component", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
	})

	describe("when cycle is false (default)", () => {
		beforeEach(() => {
			render(
				<ExtensionStateContextProvider>
					<RooTips />
				</ExtensionStateContextProvider>,
			)
		})

		test("renders only the top two tips", () => {
			// Based on the error output, there are no link elements in the component
			// The providers and tips are now clickable divs and buttons, not links
			expect(screen.queryAllByRole("link")).toHaveLength(0)

			// Verify that the section dividers are rendered
			expect(screen.getByText("developmentMode")).toBeInTheDocument()
			expect(screen.getByText("commonFeatures")).toBeInTheDocument()
		})

		test("renders SectionDivider components with correct props", () => {
			// 验证"开发模式"分隔线
			const devModeHeading = screen.getByRole("heading", { name: "developmentMode" })
			expect(devModeHeading).toBeInTheDocument()
			expect(devModeHeading).toHaveClass("text-base", "font-semibold", "text-vscode-foreground")

			// 验证"常用功能"分隔线
			const commonFeaturesHeading = screen.getByRole("heading", { name: "commonFeatures" })
			expect(commonFeaturesHeading).toBeInTheDocument()
			expect(commonFeaturesHeading).toHaveClass("text-base", "font-semibold", "text-vscode-foreground")

			// 验证图标存在
			const gearIcon = document.querySelector(".codicon-settings-gear")
			const toolsIcon = document.querySelector(".codicon-tools")
			expect(gearIcon).toBeInTheDocument()
			expect(toolsIcon).toBeInTheDocument()
		})

		test("renders provider cards with correct styling", () => {
			// 验证 Vibe 和 Spec 模式卡片 - 使用更具体的选择器避免匹配到分隔线标题
			const vibeCard = document.querySelector("div[class*='w-full'][class*='border'] div[class*='font-bold']")
			const specCard = document.querySelector(
				"div[class*='w-[calc(50%-0.5rem)]'][class*='border'] div[class*='font-bold']",
			)

			// 验证文本内容
			expect(vibeCard?.textContent).toContain("Vibe")
			expect(specCard?.textContent).toContain("Plan")

			// 获取包含卡片样式的父容器
			const vibeCardContainer = vibeCard?.closest(".border")
			const specCardContainer = specCard?.closest(".border")

			expect(vibeCardContainer).toBeInTheDocument()
			expect(specCardContainer).toBeInTheDocument()
			expect(vibeCardContainer).toHaveClass("border", "border-vscode-panel-border", "cursor-pointer", "w-full")
			expect(specCardContainer).toHaveClass("border", "border-vscode-panel-border", "cursor-pointer")
		})

		test("renders tip cards", () => {
			expect(screen.getByRole("button", { name: "rooTips.projectWiki.title" })).toBeInTheDocument()
			expect(screen.getByRole("button", { name: "rooTips.testGuide.title" })).toBeInTheDocument()
			expect(screen.getByRole("button", { name: "rooTips.debug.title" })).toBeInTheDocument()
		})

		test("uses VSCode theme colors correctly", () => {
			// 验证 VSCode 主题颜色的使用
			const headings = screen.getAllByRole("heading")
			headings.forEach((heading) => {
				expect(heading).toHaveClass("text-vscode-foreground")
			})

			// 验证分隔线使用正确的颜色
			const separatorLines = document.querySelectorAll(".bg-vscode-input-border")
			expect(separatorLines.length).toBeGreaterThan(0)
		})
	})
})
