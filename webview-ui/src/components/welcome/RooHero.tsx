import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

const RooHero = () => {
	const [imagesBaseUri] = useState(() => {
		const w = window as any
		return w.COSTRICT_BASE_URI || ""
	})
	const { t } = useTranslation()
	return (
		<div className="flex flex-col items-center justify-center pb-0 forced-color-adjust-none">
			<div className="mx-auto">
				<img src={imagesBaseUri + "/logo.svg"} alt="Costrict logo" className="h-16" />
			</div>
			<div className="title text-[16px] font-semibold text-vscode-editorInfo-foreground mb-2">
				{t("codereview:welcomePage.title")}
			</div>
			<p className="text-lg font-bold text-vscode-editor-foreground leading-tight font-vscode-font-family text-center text-balance max-w-[380px] mx-auto my-0">
				<Trans
					i18nKey="chat:about"
					components={{
						DocsLink: (
							<a href="https://costrict.ai/" target="_blank" rel="noopener noreferrer">
								the docs
							</a>
						),
					}}
				/>
			</p>
		</div>
	)
}

export default RooHero
