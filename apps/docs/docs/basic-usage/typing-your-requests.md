---
description: Learn how to effectively communicate with Roo Code using natural language. Best practices for typing requests, examples, and common pitfalls to avoid.
keywords:
    - Roo Code requests
    - natural language AI
    - typing commands
    - AI communication
    - request examples
    - best practices
image: /img/social-share.jpg
---

# Typing Your Requests

Roo Code is designed to understand natural language. You don't need to use any special commands or syntax to communicate with it. Just type your request in plain English, as if you were talking to a human developer.

<img src="/img/typing-your-requests/naturally.gif" alt="Example of typing a request in Roo Code" width="600" />

---

## Effective Request Strategies

Clearly state what you want Roo Code to do. Avoid vague or ambiguous language.

| Strategy             | Implementation                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------ |
| **Be specific**      | "Fix the bug in `calculateTotal` that returns incorrect results" instead of "Fix the code" |
| **Provide context**  | Use @ [Context Mentions](/basic-usage/context-mentions) for file and code references       |
| **Break down tasks** | Submit complex tasks in smaller manageable steps                                           |
| **Include examples** | Provide sample code when you need specific formatting or style                             |

---

## Example Requests

```
create a new file named `utils.py` and add a function called `add` that takes two numbers as arguments and returns their sum
```

```
in the file @src/components/Button.tsx, change the color of the button to blue
```

```
find all instances of the variable `oldValue` in @/src/App.js and replace them with `newValue`
```

```
run the command `npm install` in the terminal
```

```
explain the function `calculateTotal` in @/src/utils.ts
```

```
@problems address all detected problems
```

---

## Common Pitfalls to Avoid

| DON'T                           | DO                                        |
| ------------------------------- | ----------------------------------------- |
| Vague requests                  | Specify exactly what needs to be done     |
| Assuming context                | Explicitly reference files and functions  |
| Excessive technical jargon      | Use clear, straightforward language       |
| Multiple unrelated tasks        | Submit one focused request at a time      |
| Proceeding without confirmation | Check the code to make sure it's complete |
