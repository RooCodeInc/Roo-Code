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
				"chat:announcement.handoff.heading": "Roo Code is winding down.",
				"chat:announcement.handoff.readMore": "Read the Zoo Code announcement",
				"chat:announcement.zooMigration.heading": "Prepare a Zoo Code handoff",
				"chat:announcement.zooMigration.description":
					"Create a local handoff bundle from Roo's storage. Roo keeps your original data in place and asks before including API keys.",
				"chat:announcement.zooMigration.prepareButton": "Prepare Handoff",
				"chat:announcement.zooMigration.installButton": "Install Zoo",
				"chat:announcement.zooMigration.detailsHeading": "What this does:",
				"chat:announcement.zooMigration.copiesData":
					"Copies your Roo settings and task history into a Zoo handoff folder.",
				"chat:announcement.zooMigration.keepsOriginals":
					"Leaves your existing Roo folders untouched so you can verify the handoff first.",
				"chat:announcement.zooMigration.apiKeysOptIn":
					"Includes provider profiles and API keys only if you explicitly choose to include them.",
			}

			if (key === "chat:announcement.title") {
				return `Roo Code ${options?.version ?? ""}: Community handoff option`
			}

			return translations[key] ?? key
		},
	}),
}))

describe("Announcement", () => {
	it("renders the v3.53.1 Zoo migration announcement", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		expect(screen.getByText("Roo Code 3.53.1: Community handoff option")).toBeInTheDocument()
		expect(screen.getByText("Roo Code is winding down.")).toBeInTheDocument()
		expect(screen.getByText("Prepare a Zoo Code handoff")).toBeInTheDocument()
		expect(
			screen.getByText(
				"Create a local handoff bundle from Roo's storage. Roo keeps your original data in place and asks before including API keys.",
			),
		).toBeInTheDocument()
	})

	it("renders exactly three release highlight bullets", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		expect(screen.getAllByRole("listitem")).toHaveLength(3)
	})

	it("posts Zoo migration actions from the announcement", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		screen.getByRole("button", { name: "Prepare Handoff" }).click()
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "prepareZooMigration" })

		screen.getByRole("button", { name: "Install Zoo" }).click()
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "installZooExtension" })
	})
})
