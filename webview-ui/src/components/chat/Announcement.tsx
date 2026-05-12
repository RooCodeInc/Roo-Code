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
					<DialogTitle>{t("chat:announcement.title", { version: Package.version })}</DialogTitle>
				</DialogHeader>
				<div>
					<div className="mb-4">
						<p className="mb-3">{t("chat:announcement.release.heading")}</p>
						<ul className="list-disc list-inside text-sm space-y-1.5">
							<li>{t("chat:announcement.release.gpt55")}</li>
							<li>{t("chat:announcement.release.claudeOpus47")}</li>
							<li>{t("chat:announcement.release.checkpointNav")}</li>
						</ul>
					</div>

					<div className="mt-3 text-sm text-center text-vscode-descriptionForeground">
						<Trans i18nKey="chat:announcement.support" components={{ githubLink: <GitHubLink /> }} />
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

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
