// npx vitest run src/__tests__/index.test.ts

import { generatePackageJson } from "../index.js"

describe("generatePackageJson", () => {
	it("should be a test", () => {
		const generatedPackageJson = generatePackageJson({
			packageJson: {
				name: "jabberwock",
				displayName: "%extension.displayName%",
				description: "%extension.description%",
				publisher: "RooVeterinaryInc",
				version: "3.17.2",
				icon: "assets/icons/icon.png",
				contributes: {
					viewsContainers: {
						activitybar: [
							{
								id: "jabberwock-ActivityBar",
								title: "%views.activitybar.title%",
								icon: "assets/icons/icon.svg",
							},
						],
					},
					views: {
						"jabberwock-ActivityBar": [
							{
								type: "webview",
								id: "jabberwock.SidebarProvider",
								name: "",
							},
						],
					},
					commands: [
						{
							command: "jabberwock.plusButtonClicked",
							title: "%command.newTask.title%",
							icon: "$(edit)",
						},
						{
							command: "jabberwock.openInNewTab",
							title: "%command.openInNewTab.title%",
							category: "%configuration.title%",
						},
					],
					menus: {
						"editor/context": [
							{
								submenu: "jabberwock.contextMenu",
								group: "navigation",
							},
						],
						"jabberwock.contextMenu": [
							{
								command: "jabberwock.addToContext",
								group: "1_actions@1",
							},
						],
						"editor/title": [
							{
								command: "jabberwock.plusButtonClicked",
								group: "navigation@1",
								when: "activeWebviewPanelId == jabberwock.TabPanelProvider",
							},
							{
								command: "jabberwock.settingsButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == jabberwock.TabPanelProvider",
							},
							{
								command: "jabberwock.accountButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == jabberwock.TabPanelProvider",
							},
						],
					},
					submenus: [
						{
							id: "jabberwock.contextMenu",
							label: "%views.contextMenu.label%",
						},
						{
							id: "jabberwock.terminalMenu",
							label: "%views.terminalMenu.label%",
						},
					],
					configuration: {
						title: "%configuration.title%",
						properties: {
							"jabberwock.allowedCommands": {
								type: "array",
								items: {
									type: "string",
								},
								default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
								description: "%commands.allowedCommands.description%",
							},
							"jabberwock.customStoragePath": {
								type: "string",
								default: "",
								description: "%settings.customStoragePath.description%",
							},
						},
					},
				},
				scripts: {
					lint: "eslint **/*.ts",
				},
			},
			overrideJson: {
				name: "jabberwock-nightly",
				displayName: "Jabberwock Nightly",
				publisher: "RooVeterinaryInc",
				version: "0.0.1",
				icon: "assets/icons/icon-nightly.png",
				scripts: {},
			},
			substitution: ["jabberwock", "jabberwock-nightly"],
		})

		expect(generatedPackageJson).toStrictEqual({
			name: "jabberwock-nightly",
			displayName: "Jabberwock Nightly",
			description: "%extension.description%",
			publisher: "RooVeterinaryInc",
			version: "0.0.1",
			icon: "assets/icons/icon-nightly.png",
			contributes: {
				viewsContainers: {
					activitybar: [
						{
							id: "jabberwock-nightly-ActivityBar",
							title: "%views.activitybar.title%",
							icon: "assets/icons/icon.svg",
						},
					],
				},
				views: {
					"jabberwock-nightly-ActivityBar": [
						{
							type: "webview",
							id: "jabberwock-nightly.SidebarProvider",
							name: "",
						},
					],
				},
				commands: [
					{
						command: "jabberwock-nightly.plusButtonClicked",
						title: "%command.newTask.title%",
						icon: "$(edit)",
					},
					{
						command: "jabberwock-nightly.openInNewTab",
						title: "%command.openInNewTab.title%",
						category: "%configuration.title%",
					},
				],
				menus: {
					"editor/context": [
						{
							submenu: "jabberwock-nightly.contextMenu",
							group: "navigation",
						},
					],
					"jabberwock-nightly.contextMenu": [
						{
							command: "jabberwock-nightly.addToContext",
							group: "1_actions@1",
						},
					],
					"editor/title": [
						{
							command: "jabberwock-nightly.plusButtonClicked",
							group: "navigation@1",
							when: "activeWebviewPanelId == jabberwock-nightly.TabPanelProvider",
						},
						{
							command: "jabberwock-nightly.settingsButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == jabberwock-nightly.TabPanelProvider",
						},
						{
							command: "jabberwock-nightly.accountButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == jabberwock-nightly.TabPanelProvider",
						},
					],
				},
				submenus: [
					{
						id: "jabberwock-nightly.contextMenu",
						label: "%views.contextMenu.label%",
					},
					{
						id: "jabberwock-nightly.terminalMenu",
						label: "%views.terminalMenu.label%",
					},
				],
				configuration: {
					title: "%configuration.title%",
					properties: {
						"jabberwock-nightly.allowedCommands": {
							type: "array",
							items: {
								type: "string",
							},
							default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
							description: "%commands.allowedCommands.description%",
						},
						"jabberwock-nightly.customStoragePath": {
							type: "string",
							default: "",
							description: "%settings.customStoragePath.description%",
						},
					},
				},
			},
			scripts: {},
		})
	})
})
