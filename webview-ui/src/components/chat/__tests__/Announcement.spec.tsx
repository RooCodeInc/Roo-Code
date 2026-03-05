import React from "react"

import { render, screen } from "@/utils/test-utils"

import Announcement from "../Announcement"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@roo/package", () => ({
	Package: {
		version: "3.51.0",
	},
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeLink: ({ children, href, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a href={href} onClick={onClick} {...props}>
			{children}
		</a>
	),
}))

vi.mock("react-i18next", () => ({
	Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: { version?: string }) => {
			const translations: Record<string, string> = {
				"chat:announcement.release.heading": "What's New:",
				"chat:announcement.release.gpt54":
					"OpenAI GPT-5.4 Support: Added OpenAI GPT-5.4 and GPT-5.3 Chat Latest so you can use the newest OpenAI chat models in Roo Code.",
				"chat:announcement.release.slashSkills":
					"Slash Command Skills: Skills can now be exposed as slash commands with fallback execution for faster workflows.",
			}

			if (key === "chat:announcement.title") {
				return `Roo Code ${options?.version ?? ""} Released`
			}

			return translations[key] ?? key
		},
	}),
}))

describe("Announcement", () => {
	it("renders the v3.51.0 announcement title and highlights", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		expect(screen.getByText("Roo Code 3.51.0 Released")).toBeInTheDocument()
		expect(
			screen.getByText(
				"OpenAI GPT-5.4 Support: Added OpenAI GPT-5.4 and GPT-5.3 Chat Latest so you can use the newest OpenAI chat models in Roo Code.",
			),
		).toBeInTheDocument()
		expect(
			screen.getByText(
				"Slash Command Skills: Skills can now be exposed as slash commands with fallback execution for faster workflows.",
			),
		).toBeInTheDocument()
	})

	it("renders exactly two release highlight bullets", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		expect(screen.getAllByRole("listitem")).toHaveLength(2)
	})
})
