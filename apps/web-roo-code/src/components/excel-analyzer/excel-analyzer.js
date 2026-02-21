// Excel Analyzer - JavaScript Implementation
class FileUploadService {
	constructor() {
		this.maxFileSize = 10 * 1024 * 1024 // 10MB
	}

	validateFile(file) {
		const errors = []
		const warnings = []

		// Check file size
		if (file.size > this.maxFileSize) {
			errors.push(`File size exceeds limit of ${this.maxFileSize / (1024 * 1024)}MB`)
		}

		// Check file type
		const fileType = file.type.toLowerCase()
		const fileName = file.name.toLowerCase()
		const isExcel = fileType.includes("sheet") || fileType.includes("spreadsheet") || fileName.endsWith(".xlsx")
		const isCSV = fileType.includes("csv") || fileName.endsWith(".csv")

		if (!isExcel && !isCSV) {
			errors.push("Invalid file format. Only .xlsx and .csv files are supported.")
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	async getFilePreview(file) {
		const data = await this.parseFile(file)
		const firstRow = data[0] || []
		const sampleData = data.slice(1, 6) // First 5 rows of data

		// Infer column types
		const columnTypes = {}
		firstRow.forEach((col, index) => {
			const sampleValues = data.slice(1, 20).map((row) => row[index]) // Sample 20 rows
			const types = new Set(sampleValues.map(this.inferType))
			columnTypes[col] = Array.from(types).join(" | ")
		})

		return {
			columns: firstRow,
			sampleData,
			rowCount: data.length - 1, // Exclude header row
			columnTypes,
		}
	}

	async uploadFile(file) {
		const data = await this.parseFile(file)
		const preview = await this.getFilePreview(file)

		return {
			id: this.generateId(),
			name: file.name,
			size: file.size,
			type: file.type,
			preview,
			data,
		}
	}

	async parseFile(file) {
		const fileType = file.name.toLowerCase().split(".").pop()

		if (fileType === "xlsx") {
			return this.parseExcel(file)
		} else if (fileType === "csv") {
			return this.parseCSV(file)
		} else {
			throw new Error("Unsupported file format")
		}
	}

	async parseExcel(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()

			reader.onload = (e) => {
				if (!e.target?.result) {
					reject(new Error("Failed to read file"))
					return
				}

				try {
					const data = new Uint8Array(e.target.result)
					const workbook = XLSX.read(data, { type: "array" })
					const firstSheetName = workbook.SheetNames[0]
					const worksheet = workbook.Sheets[firstSheetName]
					const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

					resolve(jsonData)
				} catch (error) {
					reject(new Error("Failed to parse Excel file"))
				}
			}

			reader.onerror = () => {
				reject(new Error("Failed to read file"))
			}

			reader.readAsArrayBuffer(file)
		})
	}

	async parseCSV(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()

			reader.onload = (e) => {
				if (!e.target?.result) {
					reject(new Error("Failed to read file"))
					return
				}

				try {
					const csvData = e.target.result
					const result = Papa.parse(csvData, {
						header: true,
						skipEmptyLines: true,
						dynamicTyping: true,
					})

					if (result.errors.length > 0) {
						reject(new Error(result.errors.map((e) => e.message).join(", ")))
						return
					}

					// Convert to array of arrays format
					const data = []
					if (result.data.length > 0) {
						const headers = Object.keys(result.data[0])
						data.push(headers)
						result.data.forEach((row) => {
							data.push(headers.map((header) => row[header]))
						})
					}

					resolve(data)
				} catch (error) {
					reject(new Error("Failed to parse CSV file"))
				}
			}

			reader.onerror = () => {
				reject(new Error("Failed to read file"))
			}

			reader.readAsText(file)
		})
	}

	inferType(value) {
		if (value === null || value === undefined || value === "") return "empty"
		if (!isNaN(Date.parse(value))) return "date"
		if (!isNaN(parseFloat(value)) && isFinite(value)) return "number"
		if (typeof value === "boolean" || value === "true" || value === "false") return "boolean"
		return "string"
	}

	generateId() {
		return Math.random().toString(36).substr(2, 9)
	}
}

class AIService {
	constructor() {
		this.openAiApiKey = "" // No API key for mock implementation
	}

	async recognizeIntent(userInput) {
		// Mock implementation - replace with actual OpenAI API call
		const mockIntents = [
			{
				type: "descriptive",
				parameters: { columns: ["Sales", "Profit"] },
				context: "Analyze sales and profit data",
			},
			{
				type: "predictive",
				parameters: { target: "Sales", timePeriod: "next quarter" },
				context: "Forecast future sales based on historical data",
			},
			{
				type: "diagnostic",
				parameters: { issue: "declining sales", timeframe: "last 6 months" },
				context: "Investigate reasons for declining sales",
			},
			{
				type: "prescriptive",
				parameters: { goal: "increase profit", budget: 10000 },
				context: "Recommend actions to increase profit",
			},
		]

		// Simple intent recognition based on keywords
		const lowerInput = userInput.toLowerCase()

		if (lowerInput.includes("forecast") || lowerInput.includes("predict")) {
			return mockIntents[1] || mockIntents[0]
		} else if (lowerInput.includes("why") || lowerInput.includes("reason")) {
			return mockIntents[2] || mockIntents[0]
		} else if (lowerInput.includes("recommend") || lowerInput.includes("suggest")) {
			return mockIntents[3] || mockIntents[0]
		} else {
			return mockIntents[0]
		}
	}

	async extractParameters(intent) {
		// Mock implementation - replace with actual parameter extraction
		const mockParameters = {
			filters: [],
			aggregations: [],
			transformations: [],
		}

		// Add default filters based on intent type
		if (intent.type === "descriptive") {
			mockParameters.aggregations.push({
				type: "sum",
				column: "Sales",
				alias: "Total Sales",
			})
			mockParameters.aggregations.push({
				type: "average",
				column: "Profit",
				alias: "Average Profit",
			})
		}

		if (intent.type === "predictive") {
			mockParameters.filters.push({
				column: "Date",
				operator: "greaterThan",
				value: "2023-01-01",
			})
		}

		return mockParameters
	}

	async analyzeData(data, intent) {
		// Mock implementation - replace with actual data analysis
		const mockResults = {
			summary: {
				metrics: {
					totalRows: data.length - 1,
					totalColumns: data[0]?.length || 0,
					completeness: 0.95,
				},
				trends: [],
				patterns: [],
				anomalies: [],
			},
			charts: [],
			tables: [],
			insights: [],
			recommendations: [],
		}

		// Generate mock insights based on intent type
		if (intent.type === "descriptive") {
			mockResults.insights.push({
				type: "pattern",
				description: "Sales show a consistent upward trend",
				severity: "medium",
				data: { trend: "upward", confidence: 0.8 },
			})
		}

		if (intent.type === "predictive") {
			mockResults.recommendations.push({
				type: "action",
				description: "Increase marketing budget by 10% to boost sales",
				priority: "high",
				steps: ["Review current marketing spend", "Allocate additional budget", "Monitor results"],
			})
		}

		return mockResults
	}

	async getSimilarRequests(intent) {
		// Mock implementation - replace with actual similar request generation
		const similarRequests = [
			"Show me the total sales by region",
			"What are the top performing products?",
			"Analyze profit margins by category",
			"Compare sales performance year over year",
			"Identify trends in customer behavior",
		]

		return similarRequests
	}
}

class ExcelAnalyzer {
	constructor() {
		this.fileUploadService = new FileUploadService()
		this.aiService = new AIService()
		this.uploadedFile = null
		this.analysisResults = null
		this.currentView = "chart"

		this.initializeEventListeners()
	}

	initializeEventListeners() {
		// Upload Component Events
		const fileInput = document.getElementById("fileInput")
		const uploadArea = document.getElementById("uploadArea")
		const removeFileBtn = document.getElementById("removeFileBtn")
		const uploadFileBtn = document.getElementById("uploadFileBtn")

		if (fileInput) {
			fileInput.addEventListener("change", (e) => {
				const files = e.target.files
				if (files && files.length > 0) {
					this.handleFileSelect(files[0])
				}
			})
		}

		if (uploadArea) {
			uploadArea.addEventListener("dragenter", (e) => this.handleDragEnter(e))
			uploadArea.addEventListener("dragleave", (e) => this.handleDragLeave(e))
			uploadArea.addEventListener("drop", (e) => this.handleDrop(e))
			uploadArea.addEventListener("dragover", (e) => e.preventDefault())
		}

		if (removeFileBtn) {
			removeFileBtn.addEventListener("click", () => this.clearFile())
		}

		if (uploadFileBtn) {
			uploadFileBtn.addEventListener("click", () => this.uploadFile())
		}

		// Intent Input Component Events
		const analyzeBtn = document.getElementById("analyzeBtn")
		const clearIntentBtn = document.getElementById("clearIntentBtn")
		const userInput = document.getElementById("userInput")

		if (analyzeBtn) {
			analyzeBtn.addEventListener("click", () => this.recognizeIntent())
		}

		if (clearIntentBtn) {
			clearIntentBtn.addEventListener("click", () => this.clearIntent())
		}

		if (userInput) {
			userInput.addEventListener("input", (e) => this.handleInputChange(e))
		}

		// Dashboard Component Events
		const chartViewBtn = document.getElementById("chartViewBtn")
		const tableViewBtn = document.getElementById("tableViewBtn")
		const summaryViewBtn = document.getElementById("summaryViewBtn")

		if (chartViewBtn) {
			chartViewBtn.addEventListener("click", () => this.switchView("chart"))
		}

		if (tableViewBtn) {
			tableViewBtn.addEventListener("click", () => this.switchView("table"))
		}

		if (summaryViewBtn) {
			summaryViewBtn.addEventListener("click", () => this.switchView("summary"))
		}

		// Export Buttons
		const exportExcelBtn = document.getElementById("exportExcelBtn")
		const exportPDFBtn = document.getElementById("exportPDFBtn")
		const exportCSVBtn = document.getElementById("exportCSVBtn")
		const exportJSONBtn = document.getElementById("exportJSONBtn")

		if (exportExcelBtn) {
			exportExcelBtn.addEventListener("click", () => this.exportData("excel"))
		}

		if (exportPDFBtn) {
			exportPDFBtn.addEventListener("click", () => this.exportData("pdf"))
		}

		if (exportCSVBtn) {
			exportCSVBtn.addEventListener("click", () => this.exportData("csv"))
		}

		if (exportJSONBtn) {
			exportJSONBtn.addEventListener("click", () => this.exportData("json"))
		}
	}

	handleDragEnter(e) {
		e.preventDefault()
		const uploadArea = document.getElementById("uploadArea")
		if (uploadArea) {
			uploadArea.classList.add("border-blue-500", "bg-blue-50")
		}
	}

	handleDragLeave(e) {
		e.preventDefault()
		const uploadArea = document.getElementById("uploadArea")
		if (uploadArea) {
			uploadArea.classList.remove("border-blue-500", "bg-blue-50")
		}
	}

	handleDrop(e) {
		e.preventDefault()
		const uploadArea = document.getElementById("uploadArea")
		if (uploadArea) {
			uploadArea.classList.remove("border-blue-500", "bg-blue-50")
		}

		const files = e.dataTransfer.files
		if (files.length === 0) return

		const file = files[0]
		this.handleFileSelect(file)
	}

	async handleFileSelect(file) {
		const errorMessage = document.getElementById("errorMessage")
		if (errorMessage) {
			errorMessage.classList.add("hidden")
		}

		// Validate file
		const validation = this.fileUploadService.validateFile(file)
		if (!validation.isValid) {
			if (errorMessage) {
				errorMessage.textContent = validation.errors.join(", ")
				errorMessage.classList.remove("hidden")
			}
			return
		}

		// Check file size
		if (file.size > this.fileUploadService.maxFileSize) {
			if (errorMessage) {
				errorMessage.textContent = `File size exceeds limit of ${this.fileUploadService.maxFileSize / (1024 * 1024)}MB`
				errorMessage.classList.remove("hidden")
			}
			return
		}

		// Check file format
		const fileExtension = file.name.split(".").pop()?.toLowerCase()
		const acceptedFormats = [".xlsx", ".csv"]
		if (!acceptedFormats.includes(`.${fileExtension}`)) {
			if (errorMessage) {
				errorMessage.textContent = `Invalid file format. Accepted formats: ${acceptedFormats.join(", ")}`
				errorMessage.classList.remove("hidden")
			}
			return
		}

		// Show selected file info
		const selectedFileInfo = document.getElementById("selectedFileInfo")
		const selectedFileName = document.getElementById("selectedFileName")
		if (selectedFileInfo && selectedFileName) {
			selectedFileInfo.classList.remove("hidden")
			selectedFileName.textContent = file.name
		}

		// Get file preview
		try {
			const preview = await this.fileUploadService.getFilePreview(file)
			this.updateFilePreview(preview, file)
		} catch (err) {
			if (errorMessage) {
				errorMessage.textContent = "Failed to preview file"
				errorMessage.classList.remove("hidden")
			}
		}
	}

	updateFilePreview(preview, file) {
		const filePreview = document.getElementById("filePreview")
		const previewName = document.getElementById("previewName")
		const previewSize = document.getElementById("previewSize")
		const previewColumns = document.getElementById("previewColumns")
		const previewRows = document.getElementById("previewRows")
		const uploadButton = document.getElementById("uploadButton")

		if (filePreview) filePreview.classList.remove("hidden")
		if (previewName) previewName.textContent = file.name
		if (previewSize) previewSize.textContent = Math.round(file.size / 1024)
		if (previewColumns) previewColumns.textContent = preview.columns.join(", ")
		if (previewRows) previewRows.textContent = preview.rowCount
		if (uploadButton) uploadButton.classList.remove("hidden")
	}

	clearFile() {
		this.uploadedFile = null
		this.analysisResults = null

		// Hide components
		const uploadComponent = document.getElementById("uploadComponent")
		const intentInputComponent = document.getElementById("intentInputComponent")
		const dashboardComponent = document.getElementById("dashboardComponent")

		if (uploadComponent) uploadComponent.classList.remove("hidden")
		if (intentInputComponent) intentInputComponent.classList.add("hidden")
		if (dashboardComponent) dashboardComponent.classList.add("hidden")

		// Reset upload area
		const uploadArea = document.getElementById("uploadArea")
		if (uploadArea) {
			uploadArea.classList.remove("border-blue-500", "bg-blue-50")
		}

		// Clear file preview and selected file info
		const filePreview = document.getElementById("filePreview")
		const selectedFileInfo = document.getElementById("selectedFileInfo")
		const errorMessage = document.getElementById("errorMessage")
		const uploadButton = document.getElementById("uploadButton")

		if (filePreview) filePreview.classList.add("hidden")
		if (selectedFileInfo) selectedFileInfo.classList.add("hidden")
		if (errorMessage) errorMessage.classList.add("hidden")
		if (uploadButton) uploadButton.classList.add("hidden")
	}

	async uploadFile() {
		const selectedFileInfo = document.getElementById("selectedFileInfo")
		const selectedFileName = document.getElementById("selectedFileName")

		if (!selectedFileInfo || !selectedFileName) return

		const fileName = selectedFileName.textContent
		const fileInput = document.getElementById("fileInput")
		const file = fileInput?.files?.[0]

		if (!file) {
			const errorMessage = document.getElementById("errorMessage")
			if (errorMessage) {
				errorMessage.textContent = "No file selected"
				errorMessage.classList.remove("hidden")
			}
			return
		}

		try {
			// Show upload progress
			const uploadFileBtn = document.getElementById("uploadFileBtn")
			if (uploadFileBtn) {
				uploadFileBtn.textContent = "Uploading..."
				uploadFileBtn.disabled = true
			}

			// Upload file
			this.uploadedFile = await this.fileUploadService.uploadFile(file)

			// Show next component
			const intentInputComponent = document.getElementById("intentInputComponent")
			if (intentInputComponent) {
				intentInputComponent.classList.remove("hidden")
			}

			// Hide upload component
			if (uploadFileBtn) {
				uploadFileBtn.textContent = "Upload File"
				uploadFileBtn.disabled = false
			}
		} catch (err) {
			const errorMessage = document.getElementById("errorMessage")
			if (errorMessage) {
				errorMessage.textContent = "Failed to upload file"
				errorMessage.classList.remove("hidden")
			}
		}
	}

	handleInputChange(e) {
		const userInput = e.target.value
		const errorMessage = document.getElementById("errorMessage")
		const recognizedIntent = document.getElementById("recognizedIntent")
		const suggestions = document.getElementById("suggestions")

		if (errorMessage) errorMessage.classList.add("hidden")
		if (recognizedIntent) recognizedIntent.classList.add("hidden")
		if (suggestions) suggestions.classList.add("hidden")
	}

	async recognizeIntent() {
		const userInput = document.getElementById("userInput")
		const analyzeBtn = document.getElementById("analyzeBtn")
		const processingIndicator = document.getElementById("processingIndicator")

		if (!userInput || !analyzeBtn || !processingIndicator) return

		const input = userInput.value.trim()
		if (!input) {
			const errorMessage = document.getElementById("errorMessage")
			if (errorMessage) {
				errorMessage.textContent = "Please enter your analysis request"
				errorMessage.classList.remove("hidden")
			}
			return
		}

		// Show processing indicator
		if (processingIndicator) processingIndicator.classList.remove("hidden")
		if (analyzeBtn) {
			analyzeBtn.textContent = "Analyzing..."
			analyzeBtn.disabled = true
		}

		try {
			const intent = await this.aiService.recognizeIntent(input)
			const parameters = await this.aiService.extractParameters(intent)

			this.analysisResults = await this.aiService.analyzeData(this.uploadedFile.data, intent)

			// Show recognized intent
			const intentType = document.getElementById("intentType")
			const intentContext = document.getElementById("intentContext")
			const intentParameters = document.getElementById("intentParameters")
			const recognizedIntent = document.getElementById("recognizedIntent")

			if (intentType) intentType.textContent = intent.type
			if (intentContext) intentContext.textContent = intent.context
			if (intentParameters) intentParameters.textContent = JSON.stringify(intent.parameters, null, 2)
			if (recognizedIntent) recognizedIntent.classList.remove("hidden")

			// Show suggestions
			const suggestionsList = document.getElementById("suggestionsList")
			const suggestions = await this.aiService.getSimilarRequests(intent)

			if (suggestionsList) {
				suggestionsList.innerHTML = suggestions
					.map(
						(suggestion) =>
							`<button class="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors" 
                            onclick="excelAnalyzer.handleSuggestionClick('${suggestion.replace(/'/g, "\\'")}')">${suggestion}</button>`,
					)
					.join("")
				const suggestionsContainer = document.getElementById("suggestions")
				if (suggestionsContainer) suggestionsContainer.classList.remove("hidden")
			}

			// Show dashboard component
			const dashboardComponent = document.getElementById("dashboardComponent")
			if (dashboardComponent) {
				dashboardComponent.classList.remove("hidden")
			}
		} catch (err) {
			const errorMessage = document.getElementById("errorMessage")
			if (errorMessage) {
				errorMessage.textContent = "Failed to recognize intent. Please try again."
				errorMessage.classList.remove("hidden")
			}
		} finally {
			if (processingIndicator) processingIndicator.classList.add("hidden")
			if (analyzeBtn) {
				analyzeBtn.textContent = "Analyze"
				analyzeBtn.disabled = false
			}
		}
	}

	handleSuggestionClick(suggestion) {
		const userInput = document.getElementById("userInput")
		const suggestionsList = document.getElementById("suggestionsList")

		if (userInput) {
			userInput.value = suggestion
		}

		if (suggestionsList) {
			suggestionsList.innerHTML = ""
			const suggestions = document.getElementById("suggestions")
			if (suggestions) suggestions.classList.add("hidden")
		}
	}

	clearIntent() {
		const userInput = document.getElementById("userInput")
		const recognizedIntent = document.getElementById("recognizedIntent")
		const suggestions = document.getElementById("suggestions")
		const processingIndicator = document.getElementById("processingIndicator")
		const errorMessage = document.getElementById("errorMessage")

		if (userInput) userInput.value = ""
		if (recognizedIntent) recognizedIntent.classList.add("hidden")
		if (suggestions) suggestions.classList.add("hidden")
		if (processingIndicator) processingIndicator.classList.add("hidden")
		if (errorMessage) errorMessage.classList.add("hidden")
	}

	switchView(view) {
		const chartViewBtn = document.getElementById("chartViewBtn")
		const tableViewBtn = document.getElementById("tableViewBtn")
		const summaryViewBtn = document.getElementById("summaryViewBtn")

		// Update button styles
		if (chartViewBtn) {
			chartViewBtn.className = `px-4 py-2 rounded-lg transition-colors ${view === "chart" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`
		}
		if (tableViewBtn) {
			tableViewBtn.className = `px-4 py-2 rounded-lg transition-colors ${view === "table" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`
		}
		if (summaryViewBtn) {
			summaryViewBtn.className = `px-4 py-2 rounded-lg transition-colors ${view === "summary" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`
		}

		this.currentView = view
		this.renderView()
	}

	renderView() {
		const mainContent = document.getElementById("mainContent")

		if (!mainContent || !this.analysisResults) return

		let viewContent

		switch (this.currentView) {
			case "chart":
				viewContent = this.renderChart()
				break
			case "table":
				viewContent = this.renderTable()
				break
			case "summary":
				viewContent = this.renderSummary()
				break
			default:
				viewContent =
					'<div class="text-center py-8 text-gray-500"><p>No analysis results available. Please upload a file and perform analysis.</p></div>'
		}

		mainContent.innerHTML = viewContent
	}

	renderChart() {
		if (!this.analysisResults || !this.analysisResults.charts || this.analysisResults.charts.length === 0) {
			return '<div class="text-center py-8 text-gray-500"><p>No chart data available</p></div>'
		}

		const chartData = this.analysisResults.charts[0]
		const chartId = "analysisChart"

		// Create canvas element
		const canvas = document.createElement("canvas")
		canvas.id = chartId
		canvas.className = "relative h-64"

		// Append to main content
		const mainContent = document.getElementById("mainContent")
		mainContent.innerHTML = ""
		mainContent.appendChild(canvas)

		// Create chart
		const ctx = canvas.getContext("2d")
		if (ctx) {
			const chartConfig = {
				type: chartData.type,
				data: {
					labels: chartData.data.map((row) => row[0]),
					datasets: [
						{
							label: chartData.title,
							data: chartData.data.map((row) => row[1]),
							backgroundColor: "rgba(54, 162, 235, 0.5)",
							borderColor: "rgba(54, 162, 235, 1)",
							borderWidth: 1,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					scales: {
						y: {
							beginAtZero: true,
						},
					},
				},
			}

			return new Chart(ctx, chartConfig)
		}

		return '<div class="text-center py-8 text-gray-500"><p>Failed to render chart</p></div>'
	}

	renderTable() {
		if (!this.analysisResults || !this.analysisResults.tables || this.analysisResults.tables.length === 0) {
			return '<div class="text-center py-8 text-gray-500"><p>No table data available</p></div>'
		}

		const tables = this.analysisResults.tables
		let tableContent = ""

		tables.forEach((table, index) => {
			tableContent += `
                <div class="mb-4">
                    <h4 class="font-medium mb-2">${table.title}</h4>
                    <div class="overflow-x-auto">
                        <table class="w-full border-collapse">
                            <thead>
                                <tr class="border-b">
                                    ${table.columns
										.map((column) => `<th class="px-4 py-2 text-left">${column}</th>`)
										.join("")}
                                </tr>
                            </thead>
                            <tbody>
                                ${table.data
									.map(
										(row, rowIndex) =>
											`<tr class="border-b hover:bg-gray-50">
                                        ${row.map((cell, cellIndex) => `<td class="px-4 py-2">${cell}</td>`).join("")}
                                    </tr>`,
									)
									.join("")}
                            </tbody>
                        </table>
                    </div>
                </div>
            `
		})

		return `
            <div class="p-4">
                <h3 class="text-lg font-semibold mb-3">Data Table</h3>
                ${tableContent || '<p class="text-gray-500">No table data available</p>'}
            </div>
        `
	}

	renderSummary() {
		if (!this.analysisResults || !this.analysisResults.summary) {
			return '<div class="text-center py-8 text-gray-500"><p>No summary data available</p></div>'
		}

		const summary = this.analysisResults.summary

		return `
            <div class="p-4">
                <h3 class="text-lg font-semibold mb-3">Analysis Summary</h3>
                <div class="space-y-4">
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-2">Key Metrics</h4>
                        <div class="space-y-2">
                            ${Object.entries(summary.metrics || {})
								.map(
									([metric, value]) =>
										`<div class="flex justify-between">
                                    <span class="text-gray-600">${metric}:</span>
                                    <span class="font-medium">${value}</span>
                                </div>`,
								)
								.join("")}
                        </div>
                    </div>

                    <div class="bg-green-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-2">Insights</h4>
                        ${
							summary.insights && summary.insights.length > 0
								? `
                            ${summary.insights
								.map(
									(insight, index) =>
										`<div class="mb-2 p-2 bg-white rounded">
                                    <p class="text-sm font-medium text-green-800">${insight.description}</p>
                                    <p class="text-xs text-gray-600">Severity: ${insight.severity}</p>
                                </div>`,
								)
								.join("")}
                        `
								: '<p class="text-gray-500">No insights available</p>'
						}
                    </div>

                    <div class="bg-purple-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-2">Recommendations</h4>
                        ${
							summary.recommendations && summary.recommendations.length > 0
								? `
                            ${summary.recommendations
								.map(
									(recommendation, index) =>
										`<div class="mb-2 p-2 bg-white rounded">
                                    <p class="text-sm font-medium text-purple-800">${recommendation.description}</p>
                                    <p class="text-xs text-gray-600">Priority: ${recommendation.priority}</p>
                                    <ul class="text-xs text-gray-600 mt-1">
                                        ${recommendation.steps.map((step, stepIndex) => `<li>- ${step}</li>`).join("")}
                                    </ul>
                                </div>`,
								)
								.join("")}
                        `
								: '<p class="text-gray-500">No recommendations available</p>'
						}
                    </div>
                </div>
            </div>
        `
	}

	exportData(format) {
		if (!this.analysisResults) {
			const errorMessage = document.getElementById("errorMessage")
			if (errorMessage) {
				errorMessage.textContent = "No analysis results to export"
				errorMessage.classList.remove("hidden")
			}
			return
		}

		// Mock export functionality
		let data = JSON.stringify(this.analysisResults, null, 2)
		let filename = "analysis-results"
		let contentType = "application/json"

		switch (format) {
			case "excel":
				filename += ".xlsx"
				// Note: Actual Excel export would require additional libraries
				break
			case "pdf":
				filename += ".pdf"
				// Note: Actual PDF export would require additional libraries
				break
			case "csv":
				filename += ".csv"
				// Convert to CSV format
				data = this.convertToCSV(this.analysisResults)
				contentType = "text/csv"
				break
			case "json":
				filename += ".json"
				break
		}

		// Create and download file
		const blob = new Blob([data], { type: contentType })
		const url = window.URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		window.URL.revokeObjectURL(url)
	}

	convertToCSV(data) {
		// Simple CSV conversion for demonstration
		const results = data
		const rows = []

		// Add headers
		const headers = ["Type", "Metrics", "Trends", "Patterns", "Anomalies", "Insights", "Recommendations"]
		rows.push(headers.join(","))

		// Add data
		const row = [
			"Summary",
			JSON.stringify(results.summary?.metrics || ""),
			JSON.stringify(results.summary?.trends || ""),
			JSON.stringify(results.summary?.patterns || ""),
			JSON.stringify(results.summary?.anomalies || ""),
			JSON.stringify(results.summary?.insights || ""),
			JSON.stringify(results.summary?.recommendations || ""),
		]
		rows.push(row.join(","))

		return rows.join("\n")
	}
}

// Initialize the Excel Analyzer
const excelAnalyzer = new ExcelAnalyzer()
