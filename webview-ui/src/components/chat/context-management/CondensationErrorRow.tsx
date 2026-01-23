import { useTranslation } from "react-i18next"
import { ErrorRow } from "../ErrorRow"

interface CondensationErrorRowProps {
	errorText?: string
}

interface CondensationErrorData {
	message: string
	details?: string
}

/**
 * Displays an error message when context condensation fails.
 * Uses the standard ErrorRow component with the "Details" button for copy functionality.
 */
export function CondensationErrorRow({ errorText }: CondensationErrorRowProps) {
	const { t } = useTranslation()

	// Parse the incoming errorText as JSON to extract message and details
	// Fallback: if JSON parsing fails, use errorText as both message and errorDetails
	let errorData: CondensationErrorData
	try {
		errorData = errorText ? JSON.parse(errorText) : { message: "" }
	} catch {
		// JSON parsing failed, use errorText as both message and details
		errorData = {
			message: errorText || "",
			details: errorText,
		}
	}

	return (
		<ErrorRow
			type="error"
			title={t("chat:contextManagement.condensation.errorHeader")}
			message={errorData.message}
			errorDetails={errorData.details}
		/>
	)
}
