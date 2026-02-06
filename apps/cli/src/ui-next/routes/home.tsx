/**
 * Home route - welcome screen with kangaroo logo and prompt.
 */

import { useTheme } from "../context/theme.js"
import { useRoute } from "../context/route.js"
import { useExtension } from "../context/extension.js"
import { Logo } from "../component/logo.js"
import { Tips } from "../component/tips.js"
import { Prompt } from "../component/prompt/index.js"

export function Home() {
	const { theme } = useTheme()
	const route = useRoute()
	const ext = useExtension()

	function handleSubmit(text: string) {
		route.navigate({ type: "session", initialPrompt: text })
		ext.handleSubmit(text)
	}

	return (
		<box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center">
			<Logo />
			<box height={1} />
			<box
				width="100%"
				maxWidth={72}
				flexDirection="column"
				borderStyle="rounded"
				borderColor={theme.borderActive}
				paddingLeft={1}
				paddingRight={1}>
				<Prompt
					placeholder="What would you like to do?"
					onSubmit={handleSubmit}
					isActive={true}
					prefix="› "
					enableTriggers={true}
				/>
			</box>
			<Tips />
		</box>
	)
}
