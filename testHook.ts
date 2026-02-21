import { setActiveIntent } from "./src/hooks/intentState"
import { postToolHook } from "./src/hooks/postToolHook"

async function run() {
	setActiveIntent("demo-intent")

	await postToolHook("demo.txt", "write_to_file")

	console.log("Trace written.")
}

run()
