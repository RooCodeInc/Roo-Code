"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { X, Rocket, Check, ChevronsUpDown, SlidersHorizontal, Info } from "lucide-react"

import {
	globalSettingsSchema,
	providerSettingsSchema,
	EVALS_SETTINGS,
	getModelId,
	type ProviderSettings,
	type GlobalSettings,
	type ReasoningEffort,
} from "@roo-code/types"

import { createRun } from "@/actions/runs"
import { getExercises } from "@/actions/exercises"

import {
	type CreateRun,
	createRunSchema,
	CONCURRENCY_MIN,
	CONCURRENCY_MAX,
	CONCURRENCY_DEFAULT,
	TIMEOUT_MIN,
	TIMEOUT_MAX,
	TIMEOUT_DEFAULT,
	ITERATIONS_MIN,
	ITERATIONS_MAX,
	ITERATIONS_DEFAULT,
} from "@/lib/schemas"
import { cn } from "@/lib/utils"

import { useOpenRouterModels } from "@/hooks/use-open-router-models"
import { useRooCodeCloudModels } from "@/hooks/use-roo-code-cloud-models"

import {
	Button,
	Checkbox,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
	Textarea,
	Tabs,
	TabsList,
	TabsTrigger,
	MultiSelect,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Slider,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui"

import { SettingsDiff } from "./settings-diff"

type ImportedSettings = {
	apiConfigs: Record<string, ProviderSettings>
	globalSettings: GlobalSettings
	currentApiConfigName: string
}

export function NewRun() {
	const router = useRouter()

	const [provider, setModelSource] = useState<"roo" | "openrouter" | "other">("other")
	const [modelPopoverOpen, setModelPopoverOpen] = useState(false)
	const [useNativeToolProtocol, setUseNativeToolProtocol] = useState(true)
	const [useMultipleNativeToolCalls, setUseMultipleNativeToolCalls] = useState(false)
	const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort | "">("")
	const [commandExecutionTimeout, setCommandExecutionTimeout] = useState(20)
	const [terminalShellIntegrationTimeout, setTerminalShellIntegrationTimeout] = useState(30) // seconds

	// State for imported settings with config selection
	const [importedSettings, setImportedSettings] = useState<ImportedSettings | null>(null)
	const [selectedConfigName, setSelectedConfigName] = useState<string>("")
	const [configPopoverOpen, setConfigPopoverOpen] = useState(false)

	const openRouter = useOpenRouterModels()
	const rooCodeCloud = useRooCodeCloudModels()
	const models = provider === "openrouter" ? openRouter.data : rooCodeCloud.data
	const searchValue = provider === "openrouter" ? openRouter.searchValue : rooCodeCloud.searchValue
	const setSearchValue = provider === "openrouter" ? openRouter.setSearchValue : rooCodeCloud.setSearchValue
	const onFilter = provider === "openrouter" ? openRouter.onFilter : rooCodeCloud.onFilter

	const exercises = useQuery({ queryKey: ["getExercises"], queryFn: () => getExercises() })

	// State for selected exercises (needed for language toggle buttons)
	const [selectedExercises, setSelectedExercises] = useState<string[]>([])

	const form = useForm<CreateRun>({
		resolver: zodResolver(createRunSchema),
		defaultValues: {
			model: "",
			description: "",
			suite: "full",
			exercises: [],
			settings: undefined,
			concurrency: CONCURRENCY_DEFAULT,
			timeout: TIMEOUT_DEFAULT,
			iterations: ITERATIONS_DEFAULT,
			jobToken: "",
		},
	})

	const {
		setValue,
		clearErrors,
		watch,
		formState: { isSubmitting },
	} = form

	const [model, suite, settings] = watch(["model", "suite", "settings", "concurrency"])

	// Load settings from localStorage on mount
	useEffect(() => {
		const savedConcurrency = localStorage.getItem("evals-concurrency")
		if (savedConcurrency) {
			const parsed = parseInt(savedConcurrency, 10)
			if (!isNaN(parsed) && parsed >= CONCURRENCY_MIN && parsed <= CONCURRENCY_MAX) {
				setValue("concurrency", parsed)
			}
		}
		const savedTimeout = localStorage.getItem("evals-timeout")
		if (savedTimeout) {
			const parsed = parseInt(savedTimeout, 10)
			if (!isNaN(parsed) && parsed >= TIMEOUT_MIN && parsed <= TIMEOUT_MAX) {
				setValue("timeout", parsed)
			}
		}
		const savedCommandTimeout = localStorage.getItem("evals-command-execution-timeout")
		if (savedCommandTimeout) {
			const parsed = parseInt(savedCommandTimeout, 10)
			if (!isNaN(parsed) && parsed >= 20 && parsed <= 60) {
				setCommandExecutionTimeout(parsed)
			}
		}
		const savedShellTimeout = localStorage.getItem("evals-shell-integration-timeout")
		if (savedShellTimeout) {
			const parsed = parseInt(savedShellTimeout, 10)
			if (!isNaN(parsed) && parsed >= 30 && parsed <= 60) {
				setTerminalShellIntegrationTimeout(parsed)
			}
		}
		// Load saved exercises selection
		const savedSuite = localStorage.getItem("evals-suite")
		if (savedSuite === "partial") {
			setValue("suite", "partial")
			const savedExercises = localStorage.getItem("evals-exercises")
			if (savedExercises) {
				try {
					const parsed = JSON.parse(savedExercises) as string[]
					if (Array.isArray(parsed)) {
						setSelectedExercises(parsed)
						setValue("exercises", parsed)
					}
				} catch {
					// Invalid JSON, ignore
				}
			}
		}
	}, [setValue])

	// Extract unique languages from exercises
	const languages = useMemo(() => {
		if (!exercises.data) return []
		const langs = new Set<string>()
		for (const path of exercises.data) {
			const lang = path.split("/")[0]
			if (lang) langs.add(lang)
		}
		return Array.from(langs).sort()
	}, [exercises.data])

	// Get exercises for a specific language
	const getExercisesForLanguage = useCallback(
		(lang: string) => {
			if (!exercises.data) return []
			return exercises.data.filter((path) => path.startsWith(`${lang}/`))
		},
		[exercises.data],
	)

	// Toggle all exercises for a language
	const toggleLanguage = useCallback(
		(lang: string) => {
			const langExercises = getExercisesForLanguage(lang)
			const allSelected = langExercises.every((ex) => selectedExercises.includes(ex))

			let newSelected: string[]
			if (allSelected) {
				// Remove all exercises for this language
				newSelected = selectedExercises.filter((ex) => !ex.startsWith(`${lang}/`))
			} else {
				// Add all exercises for this language (avoiding duplicates)
				const existing = new Set(selectedExercises)
				for (const ex of langExercises) {
					existing.add(ex)
				}
				newSelected = Array.from(existing)
			}

			setSelectedExercises(newSelected)
			setValue("exercises", newSelected)
			localStorage.setItem("evals-exercises", JSON.stringify(newSelected))
		},
		[getExercisesForLanguage, selectedExercises, setValue],
	)

	// Check if all exercises for a language are selected
	const isLanguageSelected = useCallback(
		(lang: string) => {
			const langExercises = getExercisesForLanguage(lang)
			return langExercises.length > 0 && langExercises.every((ex) => selectedExercises.includes(ex))
		},
		[getExercisesForLanguage, selectedExercises],
	)

	// Check if some (but not all) exercises for a language are selected
	const isLanguagePartiallySelected = useCallback(
		(lang: string) => {
			const langExercises = getExercisesForLanguage(lang)
			const selectedCount = langExercises.filter((ex) => selectedExercises.includes(ex)).length
			return selectedCount > 0 && selectedCount < langExercises.length
		},
		[getExercisesForLanguage, selectedExercises],
	)

	const onSubmit = useCallback(
		async (values: CreateRun) => {
			try {
				// Validate jobToken for Roo Code Cloud provider
				if (provider === "roo" && !values.jobToken?.trim()) {
					toast.error("Roo Code Cloud Token is required")
					return
				}

				// Build experiments settings
				const experimentsSettings = useMultipleNativeToolCalls
					? { experiments: { multipleNativeToolCalls: true } }
					: {}

				if (provider === "openrouter") {
					values.settings = {
						...(values.settings || {}),
						apiProvider: "openrouter",
						openRouterModelId: model,
						toolProtocol: useNativeToolProtocol ? "native" : "xml",
						commandExecutionTimeout,
						terminalShellIntegrationTimeout: terminalShellIntegrationTimeout * 1000, // Convert to ms
						...experimentsSettings,
					}
				} else if (provider === "roo") {
					values.settings = {
						...(values.settings || {}),
						apiProvider: "roo",
						apiModelId: model,
						toolProtocol: useNativeToolProtocol ? "native" : "xml",
						commandExecutionTimeout,
						terminalShellIntegrationTimeout: terminalShellIntegrationTimeout * 1000, // Convert to ms
						...experimentsSettings,
						...(reasoningEffort
							? {
									enableReasoningEffort: true,
									reasoningEffort: reasoningEffort as ReasoningEffort,
								}
							: {}),
					}
				} else if (provider === "other" && values.settings) {
					// For imported settings, merge in experiments and tool protocol
					values.settings = {
						...values.settings,
						toolProtocol: useNativeToolProtocol ? "native" : "xml",
						commandExecutionTimeout,
						terminalShellIntegrationTimeout: terminalShellIntegrationTimeout * 1000, // Convert to ms
						...experimentsSettings,
					}
				}

				const { id } = await createRun(values)
				router.push(`/runs/${id}`)
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "An unknown error occurred.")
			}
		},
		[
			provider,
			model,
			router,
			useNativeToolProtocol,
			useMultipleNativeToolCalls,
			reasoningEffort,
			commandExecutionTimeout,
			terminalShellIntegrationTimeout,
		],
	)

	const onSelectModel = useCallback(
		(model: string) => {
			setValue("model", model)
			setModelPopoverOpen(false)
		},
		[setValue, setModelPopoverOpen],
	)

	const onImportSettings = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0]

			if (!file) {
				return
			}

			clearErrors("settings")

			try {
				const { providerProfiles, globalSettings } = z
					.object({
						providerProfiles: z.object({
							currentApiConfigName: z.string(),
							apiConfigs: z.record(z.string(), providerSettingsSchema),
						}),
						globalSettings: globalSettingsSchema,
					})
					.parse(JSON.parse(await file.text()))

				// Store all imported configs for user selection
				setImportedSettings({
					apiConfigs: providerProfiles.apiConfigs,
					globalSettings,
					currentApiConfigName: providerProfiles.currentApiConfigName,
				})

				// Default to the current config
				const defaultConfigName = providerProfiles.currentApiConfigName
				setSelectedConfigName(defaultConfigName)

				// Apply the default config
				const providerSettings = providerProfiles.apiConfigs[defaultConfigName] ?? {}
				setValue("model", getModelId(providerSettings) ?? "")
				setValue("settings", { ...EVALS_SETTINGS, ...providerSettings, ...globalSettings })

				event.target.value = ""
			} catch (e) {
				console.error(e)
				toast.error(e instanceof Error ? e.message : "An unknown error occurred.")
			}
		},
		[clearErrors, setValue],
	)

	const onSelectConfig = useCallback(
		(configName: string) => {
			if (!importedSettings) {
				return
			}

			setSelectedConfigName(configName)
			setConfigPopoverOpen(false)

			const providerSettings = importedSettings.apiConfigs[configName] ?? {}
			setValue("model", getModelId(providerSettings) ?? "")
			setValue("settings", { ...EVALS_SETTINGS, ...providerSettings, ...importedSettings.globalSettings })
		},
		[importedSettings, setValue],
	)

	return (
		<>
			<FormProvider {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="flex flex-col justify-center divide-y divide-primary *:py-5">
					<FormField
						control={form.control}
						name="model"
						render={() => (
							<FormItem>
								<Tabs
									value={provider}
									onValueChange={(value) => setModelSource(value as "roo" | "openrouter" | "other")}>
									<TabsList className="mb-2">
										<TabsTrigger value="other">Import</TabsTrigger>
										<TabsTrigger value="roo">Roo Code Cloud</TabsTrigger>
										<TabsTrigger value="openrouter">OpenRouter</TabsTrigger>
									</TabsList>
								</Tabs>

								{provider === "other" ? (
									<div className="space-y-2 overflow-auto">
										<Button
											type="button"
											variant="secondary"
											onClick={() => document.getElementById("json-upload")?.click()}
											className="w-full">
											<SlidersHorizontal />
											Import Settings
										</Button>
										<input
											id="json-upload"
											type="file"
											accept="application/json"
											className="hidden"
											onChange={onImportSettings}
										/>

										{importedSettings && Object.keys(importedSettings.apiConfigs).length > 1 && (
											<div className="space-y-1">
												<Label>API Config</Label>
												<Popover open={configPopoverOpen} onOpenChange={setConfigPopoverOpen}>
													<PopoverTrigger asChild>
														<Button
															variant="input"
															role="combobox"
															aria-expanded={configPopoverOpen}
															className="flex items-center justify-between w-full">
															<div>{selectedConfigName || "Select config"}</div>
															<ChevronsUpDown className="opacity-50" />
														</Button>
													</PopoverTrigger>
													<PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
														<Command>
															<CommandInput
																placeholder="Search configs..."
																className="h-9"
															/>
															<CommandList>
																<CommandEmpty>No config found.</CommandEmpty>
																<CommandGroup>
																	{Object.keys(importedSettings.apiConfigs).map(
																		(configName) => (
																			<CommandItem
																				key={configName}
																				value={configName}
																				onSelect={onSelectConfig}>
																				{configName}
																				{configName ===
																					importedSettings.currentApiConfigName && (
																					<span className="ml-2 text-xs text-muted-foreground">
																						(default)
																					</span>
																				)}
																				<Check
																					className={cn(
																						"ml-auto size-4",
																						configName ===
																							selectedConfigName
																							? "opacity-100"
																							: "opacity-0",
																					)}
																				/>
																			</CommandItem>
																		),
																	)}
																</CommandGroup>
															</CommandList>
														</Command>
													</PopoverContent>
												</Popover>
											</div>
										)}

										<div className="mt-4 p-4 rounded-md bg-muted/30 border border-border space-y-3">
											<Label className="text-sm font-medium text-muted-foreground">
												Tool Protocol Options
											</Label>
											<div className="flex flex-col gap-2.5 pl-1">
												<label
													htmlFor="native-other"
													className="flex items-center gap-2 cursor-pointer">
													<Checkbox
														id="native-other"
														checked={useNativeToolProtocol}
														onCheckedChange={(checked: boolean) =>
															setUseNativeToolProtocol(checked)
														}
													/>
													<span className="text-sm">Use Native Tool Calls</span>
												</label>
												<label
													htmlFor="multipleNativeToolCalls-other"
													className="flex items-center gap-2 cursor-pointer">
													<Checkbox
														id="multipleNativeToolCalls-other"
														checked={useMultipleNativeToolCalls}
														onCheckedChange={(checked: boolean) =>
															setUseMultipleNativeToolCalls(checked)
														}
													/>
													<span className="text-sm">Use Multiple Native Tool Calls</span>
												</label>
											</div>
										</div>

										{settings && (
											<SettingsDiff defaultSettings={EVALS_SETTINGS} customSettings={settings} />
										)}
									</div>
								) : (
									<>
										<Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
											<PopoverTrigger asChild>
												<Button
													variant="input"
													role="combobox"
													aria-expanded={modelPopoverOpen}
													className="flex items-center justify-between">
													<div>
														{models?.find(({ id }) => id === model)?.name || `Select`}
													</div>
													<ChevronsUpDown className="opacity-50" />
												</Button>
											</PopoverTrigger>
											<PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
												<Command filter={onFilter}>
													<CommandInput
														placeholder="Search"
														value={searchValue}
														onValueChange={setSearchValue}
														className="h-9"
													/>
													<CommandList>
														<CommandEmpty>No model found.</CommandEmpty>
														<CommandGroup>
															{models?.map(({ id, name }) => (
																<CommandItem
																	key={id}
																	value={id}
																	onSelect={onSelectModel}>
																	{name}
																	<Check
																		className={cn(
																			"ml-auto text-accent group-data-[selected=true]:text-accent-foreground size-4",
																			id === model ? "opacity-100" : "opacity-0",
																		)}
																	/>
																</CommandItem>
															))}
														</CommandGroup>
													</CommandList>
												</Command>
											</PopoverContent>
										</Popover>

										<div className="mt-4 p-4 rounded-md bg-muted/30 border border-border space-y-4">
											<div className="space-y-3">
												<Label className="text-sm font-medium text-muted-foreground">
													Tool Protocol Options
												</Label>
												<div className="flex flex-col gap-2.5 pl-1">
													<label
														htmlFor="native"
														className="flex items-center gap-2 cursor-pointer">
														<Checkbox
															id="native"
															checked={useNativeToolProtocol}
															onCheckedChange={(checked: boolean) =>
																setUseNativeToolProtocol(checked)
															}
														/>
														<span className="text-sm">Use Native Tool Calls</span>
													</label>
													<label
														htmlFor="multipleNativeToolCalls"
														className="flex items-center gap-2 cursor-pointer">
														<Checkbox
															id="multipleNativeToolCalls"
															checked={useMultipleNativeToolCalls}
															onCheckedChange={(checked: boolean) =>
																setUseMultipleNativeToolCalls(checked)
															}
														/>
														<span className="text-sm">Use Multiple Native Tool Calls</span>
													</label>
												</div>
											</div>

											{provider === "roo" && (
												<div className="space-y-2 pt-2 border-t border-border">
													<Label className="text-sm font-medium text-muted-foreground">
														Reasoning Effort
													</Label>
													<Select
														value={reasoningEffort || "none"}
														onValueChange={(value) =>
															setReasoningEffort(
																value === "none" ? "" : (value as ReasoningEffort),
															)
														}>
														<SelectTrigger className="w-full">
															<SelectValue placeholder="None (default)" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="none">None (default)</SelectItem>
															<SelectItem value="low">Low</SelectItem>
															<SelectItem value="medium">Medium</SelectItem>
															<SelectItem value="high">High</SelectItem>
														</SelectContent>
													</Select>
													<p className="text-xs text-muted-foreground pl-1">
														When set, enableReasoningEffort will be automatically enabled
													</p>
												</div>
											)}
										</div>
									</>
								)}

								<FormMessage />
							</FormItem>
						)}
					/>

					{provider === "roo" && (
						<FormField
							control={form.control}
							name="jobToken"
							render={({ field }) => (
								<FormItem>
									<div className="flex items-center gap-1">
										<FormLabel>Roo Code Cloud Token</FormLabel>
										<Tooltip>
											<TooltipTrigger asChild>
												<Info className="size-4 text-muted-foreground cursor-help" />
											</TooltipTrigger>
											<TooltipContent side="right" className="max-w-xs">
												<p>
													If you have access to the Roo Code Cloud repository, generate a
													token with:
												</p>
												<code className="text-xs block mt-1">
													pnpm --filter @roo-code-cloud/auth production:create-job-token [org]
													[timeout]
												</code>
											</TooltipContent>
										</Tooltip>
									</div>
									<FormControl>
										<Input type="password" placeholder="Required" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}

					<FormField
						control={form.control}
						name="suite"
						render={() => (
							<FormItem>
								<FormLabel>Exercises</FormLabel>
								<div className="flex items-center gap-2 flex-wrap">
									<Tabs
										value={suite}
										onValueChange={(value) => {
											setValue("suite", value as "full" | "partial")
											localStorage.setItem("evals-suite", value)
											if (value === "full") {
												setSelectedExercises([])
												setValue("exercises", [])
												localStorage.removeItem("evals-exercises")
											}
										}}>
										<TabsList>
											<TabsTrigger value="full">All</TabsTrigger>
											<TabsTrigger value="partial">Some</TabsTrigger>
										</TabsList>
									</Tabs>
									{suite === "partial" && languages.length > 0 && (
										<div className="flex items-center gap-1 flex-wrap">
											{languages.map((lang) => (
												<Button
													key={lang}
													type="button"
													variant={
														isLanguageSelected(lang)
															? "default"
															: isLanguagePartiallySelected(lang)
																? "secondary"
																: "outline"
													}
													size="sm"
													onClick={() => toggleLanguage(lang)}
													className="text-xs capitalize">
													{lang}
												</Button>
											))}
										</div>
									)}
								</div>
								{suite === "partial" && (
									<MultiSelect
										options={exercises.data?.map((path) => ({ value: path, label: path })) || []}
										value={selectedExercises}
										onValueChange={(value) => {
											setSelectedExercises(value)
											setValue("exercises", value)
											localStorage.setItem("evals-exercises", JSON.stringify(value))
										}}
										placeholder="Select"
										variant="inverted"
										maxCount={4}
									/>
								)}
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="concurrency"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Concurrency</FormLabel>
								<FormControl>
									<div className="flex flex-row items-center gap-2">
										<Slider
											value={[field.value]}
											min={CONCURRENCY_MIN}
											max={CONCURRENCY_MAX}
											step={1}
											onValueChange={(value) => {
												field.onChange(value[0])
												localStorage.setItem("evals-concurrency", String(value[0]))
											}}
										/>
										<div>{field.value}</div>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="timeout"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Timeout (Minutes)</FormLabel>
								<FormControl>
									<div className="flex flex-row items-center gap-2">
										<Slider
											value={[field.value]}
											min={TIMEOUT_MIN}
											max={TIMEOUT_MAX}
											step={1}
											onValueChange={(value) => {
												field.onChange(value[0])
												localStorage.setItem("evals-timeout", String(value[0]))
											}}
										/>
										<div>{field.value}</div>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="iterations"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Iterations per Exercise</FormLabel>
								<FormControl>
									<div className="flex flex-row items-center gap-2">
										<Slider
											value={[field.value]}
											min={ITERATIONS_MIN}
											max={ITERATIONS_MAX}
											step={1}
											onValueChange={(value) => {
												field.onChange(value[0])
											}}
										/>
										<div>{field.value}</div>
									</div>
								</FormControl>
								<FormDescription>Run each exercise multiple times to compare results</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormItem className="py-5">
						<div className="flex items-center gap-1">
							<Label>Terminal Command Timeout (Seconds)</Label>
							<Tooltip>
								<TooltipTrigger asChild>
									<Info className="size-4 text-muted-foreground cursor-help" />
								</TooltipTrigger>
								<TooltipContent side="right" className="max-w-xs">
									<p>
										Maximum time in seconds to wait for terminal command execution to complete
										before timing out. This applies to commands run via the execute_command tool.
									</p>
								</TooltipContent>
							</Tooltip>
						</div>
						<div className="flex flex-row items-center gap-2">
							<Slider
								value={[commandExecutionTimeout]}
								min={20}
								max={60}
								step={1}
								onValueChange={([value]) => {
									if (value !== undefined) {
										setCommandExecutionTimeout(value)
										localStorage.setItem("evals-command-execution-timeout", String(value))
									}
								}}
							/>
							<div className="w-8 text-right">{commandExecutionTimeout}</div>
						</div>
					</FormItem>

					<FormItem className="py-5">
						<div className="flex items-center gap-1">
							<Label>Shell Integration Timeout (Seconds)</Label>
							<Tooltip>
								<TooltipTrigger asChild>
									<Info className="size-4 text-muted-foreground cursor-help" />
								</TooltipTrigger>
								<TooltipContent side="right" className="max-w-xs">
									<p>
										Maximum time in seconds to wait for shell integration to initialize when opening
										a new terminal.
									</p>
								</TooltipContent>
							</Tooltip>
						</div>
						<div className="flex flex-row items-center gap-2">
							<Slider
								value={[terminalShellIntegrationTimeout]}
								min={30}
								max={60}
								step={1}
								onValueChange={([value]) => {
									if (value !== undefined) {
										setTerminalShellIntegrationTimeout(value)
										localStorage.setItem("evals-shell-integration-timeout", String(value))
									}
								}}
							/>
							<div className="w-8 text-right">{terminalShellIntegrationTimeout}</div>
						</div>
					</FormItem>

					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Description / Notes</FormLabel>
								<FormControl>
									<Textarea placeholder="Optional" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="flex justify-end">
						<Button size="lg" type="submit" disabled={isSubmitting}>
							<Rocket className="size-4" />
							Launch
						</Button>
					</div>
				</form>
			</FormProvider>

			<Button
				variant="default"
				className="absolute top-4 right-12 size-12 rounded-full"
				onClick={() => router.push("/")}>
				<X className="size-6" />
			</Button>
		</>
	)
}
