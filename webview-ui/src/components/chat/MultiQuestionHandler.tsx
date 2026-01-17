import React, { useState, useEffect } from "react"
import { Button, Textarea } from "@/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"

interface MultiQuestionHandlerProps {
	questions: string[]
	onSendResponse: (response: string) => void
}

export const MultiQuestionHandler = ({ questions, onSendResponse }: MultiQuestionHandlerProps) => {
	const { t } = useAppTranslation()
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
	const [answers, setAnswers] = useState<string[]>(new Array(questions.length).fill(""))
	const [inputValue, setInputValue] = useState("")

	useEffect(() => {
		setInputValue(answers[currentQuestionIndex] || "")
	}, [currentQuestionIndex, answers])

	const handleNext = () => {
		const newAnswers = [...answers]
		newAnswers[currentQuestionIndex] = inputValue
		setAnswers(newAnswers)

		if (currentQuestionIndex < questions.length - 1) {
			setCurrentQuestionIndex(currentQuestionIndex + 1)
		}
	}

	const handlePrevious = () => {
		const newAnswers = [...answers]
		newAnswers[currentQuestionIndex] = inputValue
		setAnswers(newAnswers)

		if (currentQuestionIndex > 0) {
			setCurrentQuestionIndex(currentQuestionIndex - 1)
		}
	}

	const handleFinish = () => {
		const newAnswers = [...answers]
		newAnswers[currentQuestionIndex] = inputValue
		setAnswers(newAnswers)

		const combined = questions.map((q, i) => `Question: ${q}\nAnswer: ${newAnswers[i] || "(skipped)"}`).join("\n\n")
		onSendResponse(combined)
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="font-bold">
				{t("chat:questions.questionNumberOfTotal", {
					current: currentQuestionIndex + 1,
					total: questions.length,
				})}
			</div>
			<div>{questions[currentQuestionIndex]}</div>
			<Textarea
				value={inputValue}
				onChange={(e) => setInputValue(e.target.value)}
				rows={3}
				placeholder={t("chat:questions.typeAnswer")}
				className="w-full"
			/>
			<div className="flex gap-2">
				{currentQuestionIndex > 0 && (
					<Button variant="secondary" onClick={handlePrevious}>
						{t("chat:questions.previous")}
					</Button>
				)}
				{currentQuestionIndex < questions.length - 1 ? (
					<Button variant="primary" onClick={handleNext}>
						{t("chat:questions.next")}
					</Button>
				) : (
					<Button variant="primary" onClick={handleFinish}>
						{t("chat:questions.finish")}
					</Button>
				)}
			</div>
		</div>
	)
}
