import { parseSettingsI18nKeys, type SectionName, sectionNames } from "../parseSettingsI18nKeys"

describe("parseSettingsI18nKeys", () => {
	describe("basic parsing functionality", () => {
		it("should parse settings with label property", () => {
			const translations = {
				browser: {
					enable: {
						label: "Enable browser tool",
						description: "When enabled, Roo can use a browser",
					},
				},
			}

			const results = parseSettingsI18nKeys(translations)

			expect(results).toContainEqual({
				id: "browser.enable",
				tab: "browser",
				labelKey: "settings:browser.enable.label",
				descriptionKey: "settings:browser.enable.description",
			})
		})

		it("should handle settings without description", () => {
			const translations = {
				checkpoints: {
					timeout: {
						label: "Checkpoint timeout",
					},
				},
			}

			const results = parseSettingsI18nKeys(translations)

			expect(results).toContainEqual({
				id: "checkpoints.timeout",
				tab: "checkpoints",
				labelKey: "settings:checkpoints.timeout.label",
				descriptionKey: undefined,
			})
		})

		it("should skip non-setting sections", () => {
			const translations = {
				common: {
					save: "Save",
				},
				header: {
					title: "Settings",
				},
				sections: {
					providers: "Providers",
				},
			}

			const results = parseSettingsI18nKeys(translations)

			// Should not include any results from skipped sections
			expect(results.filter((r) => r.tab === ("common" as SectionName))).toHaveLength(0)
			expect(results.filter((r) => r.tab === ("header" as SectionName))).toHaveLength(0)
		})

		it("should parse nested settings", () => {
			const translations = {
				autoApprove: {
					readOnly: {
						label: "Read",
						description: "When enabled, Roo will automatically view directory contents",
						outsideWorkspace: {
							label: "Include files outside workspace",
							description: "Allow Roo to read files outside the current workspace",
						},
					},
				},
			}

			const results = parseSettingsI18nKeys(translations)

			expect(results).toContainEqual({
				id: "autoApprove.readOnly",
				tab: "autoApprove",
				labelKey: "settings:autoApprove.readOnly.label",
				descriptionKey: "settings:autoApprove.readOnly.description",
			})

			expect(results).toContainEqual({
				id: "autoApprove.readOnly.outsideWorkspace",
				tab: "autoApprove",
				labelKey: "settings:autoApprove.readOnly.outsideWorkspace.label",
				descriptionKey: "settings:autoApprove.readOnly.outsideWorkspace.description",
			})
		})

		it("should collect extra searchable text keys like button labels", () => {
			const translations = {
				browser: {
					remote: {
						label: "Use remote browser",
						testButton: "Test Connection",
					},
				},
			}

			const results = parseSettingsI18nKeys(translations)

			expect(results).toContainEqual({
				id: "browser.remote",
				tab: "browser",
				labelKey: "settings:browser.remote.label",
				descriptionKey: undefined,
				extraTextKeys: ["settings:browser.remote.testButton"],
			})
		})

		it("should create standalone entries for footer settings string leaves in about tab", () => {
			const translations = {
				footer: {
					settings: {
						import: "Import settings",
						export: "Export settings",
						reset: "Reset settings",
					},
				},
			}

			const results = parseSettingsI18nKeys(translations)

			expect(results).toEqual(
				expect.arrayContaining([
					{
						id: "footer.settings.import",
						tab: "about",
						labelKey: "settings:footer.settings.import",
						descriptionKey: undefined,
					},
					{
						id: "footer.settings.export",
						tab: "about",
						labelKey: "settings:footer.settings.export",
						descriptionKey: undefined,
					},
					{
						id: "footer.settings.reset",
						tab: "about",
						labelKey: "settings:footer.settings.reset",
						descriptionKey: undefined,
					},
				]),
			)
		})
	})

	describe("special tab entries", () => {
		it("should include special entries for tabs without parsed settings", () => {
			// Empty translations - no parsed settings
			const translations = {}

			const results = parseSettingsI18nKeys(translations)

			// Should include special entries for modes, mcp, prompts, slashCommands, language, about, providers
			const specialTabs = ["modes", "mcp", "prompts", "slashCommands", "language", "about", "providers"]

			for (const tab of specialTabs) {
				const entry = results.find((r) => r.id === tab && r.tab === tab)
				expect(entry).toBeDefined()
				expect(entry?.labelKey).toBe(`settings:sections.${tab}`)
			}
		})

		it("should not duplicate special entries for tabs that have parsed settings", () => {
			const translations = {
				browser: {
					enable: {
						label: "Enable browser tool",
						description: "When enabled, Roo can use a browser",
					},
				},
			}

			const results = parseSettingsI18nKeys(translations)

			// Browser tab should have the parsed setting but not a special entry
			const browserEntries = results.filter((r) => r.tab === "browser")
			expect(browserEntries.length).toBe(1)
			expect(browserEntries[0].id).toBe("browser.enable")
		})

		it("should add special entry for modes tab (no settings)", () => {
			const results = parseSettingsI18nKeys({})

			const modesEntry = results.find((r) => r.id === "modes" && r.tab === "modes")
			expect(modesEntry).toBeDefined()
			expect(modesEntry?.labelKey).toBe("settings:sections.modes")
			expect(modesEntry?.descriptionKey).toBeUndefined()
		})

		it("should add special entry for mcp tab (no settings)", () => {
			const results = parseSettingsI18nKeys({})

			const mcpEntry = results.find((r) => r.id === "mcp" && r.tab === "mcp")
			expect(mcpEntry).toBeDefined()
			expect(mcpEntry?.labelKey).toBe("settings:sections.mcp")
			expect(mcpEntry?.descriptionKey).toBeUndefined()
		})

		it("should add special entry for language tab (no settings)", () => {
			const results = parseSettingsI18nKeys({})

			const languageEntry = results.find((r) => r.id === "language" && r.tab === "language")
			expect(languageEntry).toBeDefined()
			expect(languageEntry?.labelKey).toBe("settings:sections.language")
			expect(languageEntry?.descriptionKey).toBeUndefined()
		})

		it("should add special entry for prompts tab (description only)", () => {
			const translations = {
				prompts: {
					description: "Configure support prompts...",
				},
			}

			const results = parseSettingsI18nKeys(translations)

			// Prompts should have special entry since it only has description, not labeled settings
			const promptsEntry = results.find((r) => r.id === "prompts" && r.tab === "prompts")
			expect(promptsEntry).toBeDefined()
			expect(promptsEntry?.labelKey).toBe("settings:sections.prompts")
		})

		it("should add special entry for slashCommands tab (description only)", () => {
			const translations = {
				slashCommands: {
					description: "Manage your slash commands...",
				},
			}

			const results = parseSettingsI18nKeys(translations)

			// slashCommands should have special entry since it only has description, not labeled settings
			const slashCommandsEntry = results.find((r) => r.id === "slashCommands" && r.tab === "slashCommands")
			expect(slashCommandsEntry).toBeDefined()
			expect(slashCommandsEntry?.labelKey).toBe("settings:sections.slashCommands")
		})
	})

	describe("namespace handling", () => {
		it("should use default namespace 'settings'", () => {
			const translations = {
				browser: {
					enable: {
						label: "Enable browser tool",
					},
				},
			}

			const results = parseSettingsI18nKeys(translations)

			expect(results[0]?.labelKey).toContain("settings:")
		})

		it("should allow custom namespace", () => {
			const translations = {
				browser: {
					enable: {
						label: "Enable browser tool",
					},
				},
			}

			const results = parseSettingsI18nKeys(translations, "customNamespace")

			expect(results[0]?.labelKey).toBe("customNamespace:browser.enable.label")
		})
	})

	describe("section names export", () => {
		it("should export all valid section names", () => {
			const expectedSections = [
				"providers",
				"autoApprove",
				"slashCommands",
				"browser",
				"checkpoints",
				"notifications",
				"contextManagement",
				"terminal",
				"modes",
				"mcp",
				"prompts",
				"ui",
				"experimental",
				"language",
				"about",
			]

			expect(sectionNames).toEqual(expectedSections)
		})
	})
})
