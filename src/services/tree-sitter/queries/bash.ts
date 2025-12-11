/*
Bash Tree-sitter Query Patterns
*/
export default `
; Function definitions
(function_definition
  name: (word) @name.definition.function) @definition.function

; Variable declarations and assignments
(variable_assignment
  name: (variable_name) @name.definition.variable) @definition.variable

; Declaration commands (export, declare, readonly, etc.)
(declaration_command) @definition.declaration

; Command with name
(command
  name: (command_name (word) @name.definition.command)) @definition.command

; Here documents
(redirected_statement
  redirect: (heredoc_redirect)) @definition.heredoc

; Case statements
(case_statement) @definition.case

; If statements
(if_statement) @definition.if_statement

; While loops
(while_statement) @definition.while_loop

; For loops
(for_statement
  variable: (variable_name) @name.definition.for_variable) @definition.for_loop

; Arrays
(variable_assignment
  value: (array)) @definition.array

; Command substitutions
(command_substitution) @definition.command_substitution

; Pipeline commands
(pipeline) @definition.pipeline

; Test commands ([ ] and [[ ]])
(test_command) @definition.test_command

; Arithmetic expressions
(arithmetic_expansion) @definition.arithmetic

; Comments (for documentation purposes)
(comment) @comment
`
