import { memo, type ReactNode, useState } from "react"
import { Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

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
					<DialogTitle>{t("chat:announcement.finalRelease.title", { version: Package.version })}</DialogTitle>
				</DialogHeader>
				<div className="text-sm leading-relaxed text-vscode-descriptionForeground">
					<p className="mt-0">
						<Trans
							i18nKey="chat:announcement.finalRelease.intro"
							components={{
								announcementLink: (
									<ExternalLink href="https://x.com/mattrubens/status/2046636598859559114" />
								),
								roomoteLink: <ExternalLink href="https://roomote.dev/" />,
							}}
						/>
					</p>
					<p>{t("chat:announcement.finalRelease.continuity")}</p>
					<p>
						<Trans
							i18nKey="chat:announcement.finalRelease.alternatives"
							components={{
								zooCodeLink: <ExternalLink href="https://github.com/Zoo-Code-Org/Zoo-Code/" />,
								clineLink: <ExternalLink href="https://cline.bot/" />,
							}}
						/>
					</p>
					<p className="mb-0">{t("chat:announcement.finalRelease.signoff")}</p>
				</div>
			</DialogContent>
		</Dialog>
	)
}

const ExternalLink = ({ children, href }: { children?: ReactNode; href: string }) => (
	<VSCodeLink
		href={href}
		onClick={(e) => {
			e.preventDefault()
			vscode.postMessage({ type: "openExternal", url: href })
		}}>
		{children}
	</VSCodeLink>
)

export default memo(Announcement)
