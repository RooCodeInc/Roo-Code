import * as React from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

type PasswordInputFieldProps = {
	value: string
	onChange: (event: { target: { value: string } }) => void
	placeholder?: string
	label?: string
	className?: string
	disabled?: boolean
}

export const PasswordInputField: React.FC<PasswordInputFieldProps> = ({
	value,
	onChange,
	placeholder,
	label,
	className = "",
	disabled = false,
}) => {
	const [isPasswordVisible, setIsPasswordVisible] = React.useState(false)

	const togglePasswordVisibility = () => {
		setIsPasswordVisible(!isPasswordVisible)
	}

	return (
		<div className="relative">
			{label && <label className="block font-medium mb-1">{label}</label>}
			<div className="relative">
				<VSCodeTextField
					value={value}
					type={isPasswordVisible ? "text" : "password"}
					onInput={(e) => onChange({ target: { value: (e.target as HTMLInputElement).value } })}
					placeholder={placeholder}
					className={className}
					disabled={disabled}
				/>
				<button
					type="button"
					onClick={togglePasswordVisibility}
					className="absolute right-3 top-1/2 transform -translate-y-1/2 text-vscode-descriptionForeground hover:text-vscode-button-foreground cursor-pointer"
					aria-label={isPasswordVisible ? "Hide password" : "Show password"}>
					<span className={`codicon ${isPasswordVisible ? "codicon-eye-closed" : "codicon-eye"}`} />
				</button>
			</div>
		</div>
	)
}
