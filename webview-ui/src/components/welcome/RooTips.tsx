import { Trans } from "react-i18next"
import { buildDocLink } from "@src/utils/docLinks"

const RooTips = () => {
	return (
		<div>
			<p className="text-vscode-editor-foreground leading-tight font-vscode-font-family text-center text-balance max-w-[380px] mx-auto my-0">
				<Trans
					i18nKey="chat:about"
					components={{
						DocsLink: (
							<a href={buildDocLink("", "welcome")} target="_blank" rel="noopener noreferrer">
								the docs
							</a>
						),
					}}
				/>
			</p>
		</div>
	)
}

export default RooTips
