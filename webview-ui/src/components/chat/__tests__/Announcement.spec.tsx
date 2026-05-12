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
		version: "3.53.0",
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
	Trans: ({ i18nKey, components }: { i18nKey: string; components?: Record<string, React.ReactElement> }) => {
		if (i18nKey === "chat:announcement.finalRelease.intro") {
			return (
				<span>
					This is the last Roo Code release.{" "}
					{components?.announcementLink &&
						React.cloneElement(components.announcementLink, {}, "As we announced a few weeks ago")}
					, we{"'"}ve decided to shift our focus to{" "}
					{components?.roomoteLink && React.cloneElement(components.roomoteLink, {}, "Roomote")}, our cloud
					agent platform, which we believe to be the future of software development. Thank you so much for
					your support throughout the past year or so.
				</span>
			)
		}

		if (i18nKey === "chat:announcement.finalRelease.alternatives") {
			return (
				<span>
					If you want to use an extension, we recommend checking out{" "}
					{components?.zooCodeLink && React.cloneElement(components.zooCodeLink, {}, "ZooCode")} (a Roo Code
					fork by the community) and{" "}
					{components?.clineLink && React.cloneElement(components.clineLink, {}, "Cline")} (where Roo Code
					originally started).
				</span>
			)
		}

		return <span>{i18nKey}</span>
	},
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: { version?: string }) => {
			const translations: Record<string, string> = {
				"chat:announcement.finalRelease.title": "The last Roo Code release",
				"chat:announcement.finalRelease.continuity":
					"This extension should continue to work indefinitely, but it won't receive bug fixes, new features, or model updates.",
				"chat:announcement.finalRelease.signoff": "Happy coding!",
			}

			if (key === "chat:announcement.finalRelease.title") {
				return `${translations[key]}${options?.version ? "" : ""}`
			}

			return translations[key] ?? key
		},
	}),
}))

describe("Announcement", () => {
	it("renders the final release announcement", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		expect(screen.getByText("The last Roo Code release")).toBeInTheDocument()
		expect(screen.getByText(/This is the last Roo Code release/)).toBeInTheDocument()
		expect(
			screen.getByText(
				"This extension should continue to work indefinitely, but it won't receive bug fixes, new features, or model updates.",
			),
		).toBeInTheDocument()
		expect(screen.getByText("Happy coding!")).toBeInTheDocument()
	})

	it("renders the external links", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		expect(screen.getByRole("link", { name: "As we announced a few weeks ago" })).toHaveAttribute(
			"href",
			"https://x.com/mattrubens/status/2046636598859559114",
		)
		expect(screen.getByRole("link", { name: "ZooCode" })).toHaveAttribute(
			"href",
			"https://github.com/Zoo-Code-Org/Zoo-Code/",
		)
		expect(screen.getByRole("link", { name: "Cline" })).toHaveAttribute("href", "https://cline.bot/")
	})

	it("does not render corporate handoff or social links", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)

		expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
		expect(screen.queryByText("chat:announcement.handoff.description")).not.toBeInTheDocument()
		expect(screen.queryByRole("link", { name: "X" })).not.toBeInTheDocument()
		expect(screen.queryByRole("link", { name: "Discord" })).not.toBeInTheDocument()
		expect(screen.queryByRole("link", { name: "Reddit" })).not.toBeInTheDocument()
	})
})
