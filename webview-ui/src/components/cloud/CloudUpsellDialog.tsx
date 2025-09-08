import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@/components/ui"

interface CloudUpsellDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onConnect: () => void
}

export const CloudUpsellDialog = ({ open, onOpenChange, onConnect }: CloudUpsellDialogProps) => {
	const { t } = useTranslation()

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader className="text-center">
					<DialogTitle className="text-lg font-medium text-vscode-foreground">
						{t("cloud:cloudBenefitsTitle")}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col space-y-6">
					<div>
						<p className="text-md text-vscode-descriptionForeground mb-4">
							{t("cloud:cloudBenefitsSubtitle")}
						</p>
						<ul className="text-sm text-vscode-descriptionForeground space-y-2">
							<li className="flex items-start">
								<span className="mr-2 text-vscode-foreground">•</span>
								{t("cloud:cloudBenefitSharing")}
							</li>
							<li className="flex items-start">
								<span className="mr-2 text-vscode-foreground">•</span>
								{t("cloud:cloudBenefitHistory")}
							</li>
							<li className="flex items-start">
								<span className="mr-2 text-vscode-foreground">•</span>
								{t("cloud:cloudBenefitMetrics")}
							</li>
						</ul>
					</div>

					<div className="flex flex-col gap-4">
						<Button onClick={onConnect} className="w-full">
							{t("cloud:connect")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
