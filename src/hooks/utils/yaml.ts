import * as fs from "fs"
import yaml from "js-yaml"
export function readYaml(file: string) {
	return yaml.load(fs.readFileSync(file, "utf8"))
}
