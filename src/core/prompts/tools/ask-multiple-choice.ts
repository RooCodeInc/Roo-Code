export function getAskMultipleChoiceDescription(): string {
	return `## ask_multiple_choice
Description: Interrupts the current workflow to present structured multiple-choice questions to the user. Forces selection from predefined options (no free-text). Use this tool when you need explicit user decisions or to resolve ambiguity before proceeding.

Use this tool when:
- You need to choose between mutually exclusive options (e.g., architecture patterns, frameworks).
- You need to clarify user intent (e.g., "Add new file?" vs "Update existing?").
- You want to collect multiple related decisions in a single interaction.

CRITICAL: Every question and every option MUST have an id field - results cannot be matched without ids.

Parameters:
- title: (optional) A brief title for the decision group.
- questions: (REQUIRED) An array of question objects (at least 1).
  - id: (REQUIRED) A unique, program-friendly identifier (slug) for the question (e.g., "framework_choice").
  - prompt: (REQUIRED) The text question to display to the user.
  - options: (REQUIRED) An array of option objects (at least 2).
    - id: (REQUIRED) A unique, program-friendly identifier (slug) for the option (e.g., "react", "vue").
    - label: (REQUIRED) The user-facing display text.
  - allow_multiple: (optional) Set to 'true' for checkboxes (multi-select), 'false' for radio buttons (single-select). Defaults to false.

Usage:
<ask_multiple_choice>
  <title>Decision Title</title>
  <questions>
    <question>
      <id>question_slug</id>
      <prompt>Question text?</prompt>
      <options>
        <option>
          <id>option_slug_1</id>
          <label>Option 1 Label</label>
        </option>
        <option>
          <id>option_slug_2</id>
          <label>Option 2 Label</label>
        </option>
      </options>
      <allow_multiple>false</allow_multiple>
    </question>
  </questions>
</ask_multiple_choice>

Example:
<ask_multiple_choice>
  <title>Project Setup</title>
  <questions>
    <question>
      <id>framework</id>
      <prompt>Which framework would you like to use?</prompt>
      <options>
        <option>
          <id>react</id>
          <label>React</label>
        </option>
        <option>
          <id>vue</id>
          <label>Vue.js</label>
        </option>
      </options>
      <allow_multiple>false</allow_multiple>
    </question>
    <question>
      <id>features</id>
      <prompt>Select additional features:</prompt>
      <options>
        <option>
          <id>typescript</id>
          <label>TypeScript</label>
        </option>
        <option>
          <id>linting</id>
          <label>ESLint + Prettier</label>
        </option>
      </options>
      <allow_multiple>true</allow_multiple>
    </question>
  </questions>
</ask_multiple_choice>`
}
