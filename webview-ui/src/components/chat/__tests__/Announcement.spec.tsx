import React from "react"

import { render, screen } from "@/utils/test-utils"

import { vscode } from "@src/utils/vscode"

import Announcement from "../Announcement"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@roo/package", () => ({
	Package: {
		version: "3.53.1",
	},
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button onClick={onClick} {...props}>
			{children}
		</button>
	),
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
				"chat:announcement.handoff.heading": "Roo is back as Zoo Code.",
				"chat:announcement.handoff.readMore": "Read the Zoo announcement",
				"chat:announcement.zooMigration.heading": "Prepare your Zoo migration",
				"chat:announcement.zooMigration.description":
					"Create a handoff bundle from Roo's local storage. Roo keeps your original data in place and asks before including API keys.",
				"chat:announcement.zooMigration.prepareButton": "Prepare Migration",
				"chat:announcement.zooMigration.installButton": "Install Zoo",
				"chat:announcement.zooMigration.detailsHeading": "What this does:",
				"chat:announcement.zooMigration.copiesData":
					"Copies your Roo settings and task history into a Zoo migration folder.",
				"chat:announcement.zooMigration.keepsOriginals":
					"Leaves your existing Roo folders untouched so you can verify the handoff first.",
				"chat:announcement.zooMigration.apiKeysOptIn":
					"Includes provider profiles and API keys only if you explicitly choose to include them.",
			}

			if (key === "chat:announcement.title") {
				return `Roo Code ${options?.version ?? ""}: Move to Zoo Code`
			}

			return translations[key] ?? key
		},
	}),
}))

describe("Announcement", () => {
	it("renders the v3.53.1 Zoo migration announcement", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		expect(screen.getByText("Roo Code 3.53.1: Move to Zoo Code")).toBeInTheDocument()
		expect(screen.getByText("Roo is back as Zoo Code.")).toBeInTheDocument()
		expect(screen.getByText("Prepare your Zoo migration")).toBeInTheDocument()
		expect(
			screen.getByText(
				"Create a handoff bundle from Roo's local storage. Roo keeps your original data in place and asks before including API keys.",
			),
		).toBeInTheDocument()
	})

	it("renders exactly three release highlight bullets", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		expect(screen.getAllByRole("listitem")).toHaveLength(3)
	})

	it("posts Zoo migration actions from the announcement", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		screen.getByRole("button", { name: "Prepare Migration" }).click()
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "prepareZooMigration" })

		screen.getByRole("button", { name: "Install Zoo" }).click()
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "installZooExtension" })
	})
})
