/**
 * Main app component for the SolidJS/opentui TUI.
 * Sets up the provider hierarchy and routes.
 */

import { Switch, Match, ErrorBoundary } from "solid-js"
import type { ExtensionHostOptions, ExtensionHostInterface } from "../agent/index.js"

import { ThemeProvider } from "./context/theme.js"
import { RouteProvider, useRoute } from "./context/route.js"
import { ExitProvider } from "./context/exit.js"
import { ToastProvider } from "./context/toast.js"
import { KeybindProvider } from "./context/keybind.js"
import { DialogProvider } from "./ui/dialog.js"
import { ExtensionProvider, type ExtensionContextProps } from "./context/extension.js"

import { Home } from "./routes/home.js"
import { Session } from "./routes/session/index.js"

export interface TUIAppProps extends ExtensionHostOptions {
	initialPrompt?: string
	version: string
	createExtensionHost: (options: ExtensionHostOptions) => ExtensionHostInterface
}

function AppRouter(props: { version: string; mode: string; provider: string; model: string }) {
	const route = useRoute()

	return (
		<Switch>
			<Match when={route.data.type === "session"}>
				<Session version={props.version} mode={props.mode} provider={props.provider} model={props.model} />
			</Match>
			<Match when={route.data.type === "home"}>
				<Home />
			</Match>
		</Switch>
	)
}

function ErrorFallback(props: { error: Error }) {
	return (
		<box flexDirection="column" padding={1}>
			<text fg="#F92672" bold>
				Error: {props.error.message}
			</text>
			<text fg="#5E7175">Press Ctrl+C to exit</text>
		</box>
	)
}

export function App(props: TUIAppProps) {
	const extensionProps: ExtensionContextProps = {
		options: props,
		initialPrompt: props.initialPrompt,
		createExtensionHost: props.createExtensionHost,
	}

	return (
		<ErrorBoundary fallback={(err: Error) => <ErrorFallback error={err} />}>
			<ExitProvider>
				<ThemeProvider>
					<ToastProvider>
						<RouteProvider>
							<KeybindProvider>
								<DialogProvider>
									<ExtensionProvider {...extensionProps}>
										<AppRouter
											version={props.version}
											mode={props.mode}
											provider={props.provider as string}
											model={props.model}
										/>
									</ExtensionProvider>
								</DialogProvider>
							</KeybindProvider>
						</RouteProvider>
					</ToastProvider>
				</ThemeProvider>
			</ExitProvider>
		</ErrorBoundary>
	)
}
