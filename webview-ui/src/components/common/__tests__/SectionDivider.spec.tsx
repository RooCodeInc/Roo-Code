import React from "react"
import { render, screen } from "@/utils/test-utils"
import SectionDivider from "../SectionDivider"

describe("SectionDivider Component", () => {
	describe("当没有标题时", () => {
		test("应该渲染简单的分隔线", () => {
			const { container } = render(<SectionDivider />)

			const divider = container.querySelector(".h-px.bg-vscode-input-border.my-1")
			expect(divider).toBeInTheDocument()
			expect(divider).toHaveClass("h-px", "bg-vscode-input-border", "my-1")
		})

		test("应该应用自定义 className", () => {
			const { container } = render(<SectionDivider className="custom-class" />)

			const divider = container.querySelector(".custom-class")
			expect(divider).toBeInTheDocument()
			expect(divider).toHaveClass("custom-class")
		})
	})

	describe("当有标题时", () => {
		test("应该渲染带标题的分隔线", () => {
			render(<SectionDivider title="测试标题" />)

			expect(screen.getByText("测试标题")).toBeInTheDocument()
			expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument()
		})

		test("应该渲染带图标和标题的分隔线", () => {
			render(<SectionDivider title="测试标题" icon="codicon-settings-gear" />)

			expect(screen.getByText("测试标题")).toBeInTheDocument()

			// 检查图标元素
			const iconElement = document.querySelector(".codicon.codicon-settings-gear")
			expect(iconElement).toBeInTheDocument()
			expect(iconElement).toHaveClass("text-lg")
		})

		test("标题应该有正确的样式类", () => {
			render(<SectionDivider title="测试标题" />)

			const heading = screen.getByRole("heading", { level: 3 })
			expect(heading).toHaveClass("text-base", "font-semibold", "text-vscode-foreground", "whitespace-nowrap")
		})

		test("应该包含分隔线元素", () => {
			render(<SectionDivider title="测试标题" />)

			// 检查分隔线元素
			const separatorLine = document.querySelector(".flex-1.h-px.bg-vscode-input-border")
			expect(separatorLine).toBeInTheDocument()
		})

		test("应该应用自定义 className", () => {
			render(<SectionDivider title="测试标题" className="custom-class" />)

			const container = document.querySelector(".flex.items-center.gap-2.my-1.custom-class")
			expect(container).toBeInTheDocument()
		})
	})

	describe("响应式和样式", () => {
		test("容器应该有正确的布局类", () => {
			render(<SectionDivider title="测试标题" />)

			const container = document.querySelector(".flex.items-center.gap-2.my-1")
			expect(container).toBeInTheDocument()
		})

		test("图标应该有正确的大小", () => {
			render(<SectionDivider title="测试标题" icon="codicon-tools" />)

			const iconElement = document.querySelector(".codicon.codicon-tools")
			expect(iconElement).toHaveClass("text-lg")
		})
	})

	describe("VSCode 主题颜色", () => {
		test("应该使用 VSCode 主题颜色变量", () => {
			const { container } = render(<SectionDivider title="测试标题" />)

			const heading = screen.getByRole("heading", { level: 3 })
			expect(heading).toHaveClass("text-vscode-foreground")

			const separatorLine = container.querySelector(".bg-vscode-input-border")
			expect(separatorLine).toBeInTheDocument()
		})

		test("简单分隔线应该使用 VSCode 主题颜色", () => {
			const { container } = render(<SectionDivider />)

			const divider = container.querySelector(".bg-vscode-input-border")
			expect(divider).toBeInTheDocument()
			expect(divider).toHaveClass("bg-vscode-input-border")
		})
	})
})
