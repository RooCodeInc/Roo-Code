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
		version: "3.52.0",
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
					"Poe Provider: Added Poe as an AI provider so you can access Poe models directly in Roo Code.",
				"chat:announcement.release.slashSkills":
					"xAI and MiniMax Improvements: Migrated the xAI provider to the Responses API, added Grok-4.20 defaults, and fixed MiniMax model listings and context window handling for a more reliable setup.",
			}

			if (key === "chat:announcement.title") {
				return `Roo Code ${options?.version ?? ""} Released`
			}

			return translations[key] ?? key
		},
	}),
}))

describe("Announcement", () => {
	it("renders the v3.52.0 announcement title and highlights", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		expect(screen.getByText("Roo Code 3.52.0 Released")).toBeInTheDocument()
		expect(
			screen.getByText(
				"Poe Provider: Added Poe as an AI provider so you can access Poe models directly in Roo Code.",
			),
		).toBeInTheDocument()
		expect(
			screen.getByText(
				"xAI and MiniMax Improvements: Migrated the xAI provider to the Responses API, added Grok-4.20 defaults, and fixed MiniMax model listings and context window handling for a more reliable setup.",
			),
		).toBeInTheDocument()
	})

	it("renders exactly two release highlight bullets", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		expect(screen.getAllByRole("listitem")).toHaveLength(2)
	})
})
