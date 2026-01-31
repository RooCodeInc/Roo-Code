import { useState, useEffect } from "react"
import { Button, AutosizeTextarea } from "@/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"

interface Question {
	text: string
	options?: string[]
}

interface MultiQuestionHandlerProps {
	questions: Array<string | Question>
	onSendResponse: (response: string) => void
}

interface QuestionItemProps {
	question: string | Question
	title: string
	textValue: string
	selectedOption?: string
	onTextChange: (value: string) => void
	onOptionClick: (option: string) => void
}

const QuestionItem = ({
	question,
	title,
	textValue,
	selectedOption,
	onTextChange,
	onOptionClick,
}: QuestionItemProps) => {
	const { t } = useAppTranslation()
	const qText = typeof question === "string" ? question : question.text
	const options = typeof question === "string" ? undefined : question.options

	return (
		<div className="flex flex-col gap-3">
			<div className="font-bold">{title}</div>
			<div>{qText}</div>
			{options && options.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{options.map((option, idx) => (
						<button
							key={idx}
							onClick={() => onOptionClick(option)}
							className={`px-3 py-1.5 rounded text-sm transition-colors border ${
								selectedOption === option
									? "bg-vscode-button-background text-vscode-button-foreground border-vscode-button-background"
									: "bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground border-vscode-button-secondaryHoverBackground hover:bg-vscode-button-secondaryHoverBackground"
							}`}>
							{option}
						</button>
					))}
				</div>
			)}
			<AutosizeTextarea
				value={textValue}
				onChange={(e) => onTextChange(e.target.value)}
				minHeight={21}
				maxHeight={200}
				placeholder={t("chat:questions.typeAnswer")}
				className="w-full py-2 pl-3 pr-3 rounded border border-transparent"
			/>
		</div>
	)
}

export const MultiQuestionHandler = ({ questions, onSendResponse }: MultiQuestionHandlerProps) => {
	const { t } = useAppTranslation()
	const { showQuestionsOneByOne } = useExtensionState()
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
	const [selectedOptions, setSelectedOptions] = useState<(string | undefined)[]>(
		new Array(questions.length).fill(undefined),
	)
	const [textAnswers, setTextAnswers] = useState<string[]>(new Array(questions.length).fill(""))
	const [oneByOneInputValue, setOneByOneInputValue] = useState("")

	useEffect(() => {
		if (showQuestionsOneByOne) {
			setOneByOneInputValue(textAnswers[currentQuestionIndex] || "")
		}
	}, [currentQuestionIndex, textAnswers, showQuestionsOneByOne])

	const updateTextAnswer = (index: number, value: string) => {
		const next = [...textAnswers]
		next[index] = value
		setTextAnswers(next)
	}

	const handleNext = () => {
		updateTextAnswer(currentQuestionIndex, oneByOneInputValue)
		if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(currentQuestionIndex + 1)
	}

	const handlePrevious = () => {
		updateTextAnswer(currentQuestionIndex, oneByOneInputValue)
		if (currentQuestionIndex > 0) setCurrentQuestionIndex(currentQuestionIndex - 1)
	}

	const handleOptionClick = (index: number, option: string) => {
		setSelectedOptions((prev) => {
			const next = [...prev]
			next[index] = next[index] === option ? undefined : option
			return next
		})
	}

	const handleFinish = () => {
		let finalAnswers = textAnswers
		if (showQuestionsOneByOne) {
			finalAnswers = [...textAnswers]
			finalAnswers[currentQuestionIndex] = oneByOneInputValue
		}

		const combined = questions
			.map((q, i) => {
				const qText = typeof q === "string" ? q : q.text
				const text = finalAnswers[i].trim()
				const option = selectedOptions[i]
				const answer = option && text ? `${option}: ${text}` : option || text || "(skipped)"
				return `Question: ${qText}\nAnswer: ${answer}`
			})
			.join("\n\n")
		onSendResponse(combined)
	}

	if (showQuestionsOneByOne) {
		return (
			<div className="flex flex-col gap-3">
				<QuestionItem
					question={questions[currentQuestionIndex]}
					title={t("chat:questions.questionNumberOfTotal", {
						current: currentQuestionIndex + 1,
						total: questions.length,
					})}
					textValue={oneByOneInputValue}
					selectedOption={selectedOptions[currentQuestionIndex]}
					onTextChange={setOneByOneInputValue}
					onOptionClick={(opt) => handleOptionClick(currentQuestionIndex, opt)}
				/>
				<div className="flex gap-2">
					{currentQuestionIndex > 0 && (
						<Button variant="secondary" onClick={handlePrevious}>
							{t("chat:questions.previous")}
						</Button>
					)}
					<Button
						variant="primary"
						onClick={currentQuestionIndex < questions.length - 1 ? handleNext : handleFinish}>
						{t(
							currentQuestionIndex < questions.length - 1
								? "chat:questions.next"
								: "chat:questions.finish",
						)}
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6">
			{questions.map((q, i) => (
				<QuestionItem
					key={i}
					question={q}
					title={t("chat:questions.questionNumber", { number: i + 1 })}
					textValue={textAnswers[i]}
					selectedOption={selectedOptions[i]}
					onTextChange={(val) => updateTextAnswer(i, val)}
					onOptionClick={(opt) => handleOptionClick(i, opt)}
				/>
			))}
			<div className="flex justify-end">
				<Button variant="primary" onClick={handleFinish}>
					{t("chat:questions.finish")}
				</Button>
			</div>
		</div>
	)
}
