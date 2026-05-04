import { memo, type ReactNode, useState } from "react"
import { Trans } from "react-i18next"
import { SiDiscord, SiReddit, SiX } from "react-icons/si"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { Package } from "@roo/package"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@src/components/ui"

interface AnnouncementProps {
	hideAnnouncement: () => void
}

/**
 * You must update the `latestAnnouncementId` in ClineProvider for new
 * announcements to show to users. This new id will be compared with what's in
 * state for the 'last announcement shown', and if it's different then the
 * announcement will render. As soon as an announcement is shown, the id will be
 * updated in state. This ensures that announcements are not shown more than
 * once, even if the user doesn't close it themselves.
 */

const Announcement = ({ hideAnnouncement }: AnnouncementProps) => {
	const { t } = useAppTranslation()
	const [open, setOpen] = useState(true)

	return (
		<Dialog
			open={open}
			onOpenChange={(open) => {
				setOpen(open)

				if (!open) {
					hideAnnouncement()
				}
			}}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("chat:announcement.title", { version: Package.version })}</DialogTitle>
				</DialogHeader>
				<div>
					{/* Zoo Handoff Notice */}
					<div className="mb-4 p-3 rounded border border-vscode-textLink-foreground/40 bg-vscode-textLink-foreground/5">
						<p className="font-semibold mb-1.5 text-vscode-textLink-foreground">
							{t("chat:announcement.handoff.heading")}
						</p>
						<p className="text-sm mb-2">
							<Trans i18nKey="chat:announcement.handoff.description" components={{ bold: <strong /> }} />
						</p>
						<VSCodeLink href="https://www.reddit.com/r/RooCode/comments/1syufn1/roo_is_back_as_zoo/">
							{t("chat:announcement.handoff.readMore")}
						</VSCodeLink>
					</div>

					{/* Zoo Migration */}
					<div className="mb-4 p-3 rounded border border-vscode-button-background/40 bg-vscode-button-background/5">
						<p className="font-semibold mb-1.5">{t("chat:announcement.zooMigration.heading")}</p>
						<p className="text-sm mb-3">{t("chat:announcement.zooMigration.description")}</p>
						<div className="flex flex-wrap gap-2">
							<VSCodeButton
								onClick={() => {
									vscode.postMessage({ type: "prepareZooMigration" })
								}}>
								{t("chat:announcement.zooMigration.prepareButton")}
							</VSCodeButton>
							<VSCodeButton
								appearance="secondary"
								onClick={() => {
									vscode.postMessage({ type: "installZooExtension" })
								}}>
								{t("chat:announcement.zooMigration.installButton")}
							</VSCodeButton>
						</div>
					</div>

					{/* Migration Details */}
					<div className="mb-4">
						<p className="mb-3">{t("chat:announcement.zooMigration.detailsHeading")}</p>
						<ul className="list-disc list-inside text-sm space-y-1.5">
							<li>{t("chat:announcement.zooMigration.copiesData")}</li>
							<li>{t("chat:announcement.zooMigration.keepsOriginals")}</li>
							<li>{t("chat:announcement.zooMigration.apiKeysOptIn")}</li>
						</ul>
					</div>

					<div className="mt-4 text-sm text-center text-vscode-descriptionForeground">
						<div className="flex items-center justify-center gap-4">
							<SocialLink
								icon={<SiX className="w-4 h-4" aria-hidden />}
								label="X"
								href="https://x.com/roocode"
							/>
							<SocialLink
								icon={<SiDiscord className="w-4 h-4" aria-hidden />}
								label="Discord"
								href="https://discord.gg/rCQcvT7Fnt"
							/>
							<SocialLink
								icon={<SiReddit className="w-4 h-4" aria-hidden />}
								label="Reddit"
								href="https://www.reddit.com/r/RooCode/"
							/>
						</div>
					</div>

					<div className="mt-3 text-sm text-center text-vscode-descriptionForeground">
						<Trans i18nKey="chat:announcement.support" components={{ githubLink: <GitHubLink /> }} />
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

const SocialLink = ({ icon, label, href }: { icon: ReactNode; label: string; href: string }) => (
	<VSCodeLink
		href={href}
		className="inline-flex items-center gap-1"
		onClick={(e) => {
			e.preventDefault()
			vscode.postMessage({ type: "openExternal", url: href })
		}}>
		{icon}
		<span className="sr-only">{label}</span>
	</VSCodeLink>
)

const GitHubLink = ({ children }: { children?: ReactNode }) => (
	<VSCodeLink
		href="https://github.com/RooCodeInc/Roo-Code"
		onClick={(e) => {
			e.preventDefault()
			vscode.postMessage({ type: "openExternal", url: "https://github.com/RooCodeInc/Roo-Code" })
		}}>
		{children}
	</VSCodeLink>
)

export default memo(Announcement)
