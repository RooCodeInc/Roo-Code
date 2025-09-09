/*
OpenEdge ABL language structures
Basic query for ABL (Progress 4GL) language
Updated to match actual grammar node names from the tree-sitter-abl package
*/
export default String.raw`
; Procedure statements
(procedure_statement
  name: (identifier) @name.definition.procedure) @definition.procedure

; Function statements
(function_statement
  name: (identifier) @name.definition.function) @definition.function

; Class statements
(class_statement
  name: (identifier) @name.definition.class) @definition.class

; Method definitions
(method_definition
  name: (identifier) @name.definition.method) @definition.method

; Variable definitions
(variable_definition
  name: (identifier) @name.definition.variable) @definition.variable

; Property definitions
(property_definition
  name: (identifier) @name.definition.property) @definition.property

; Temp-table definitions
(temp_table_definition
  name: (identifier) @name.definition.table) @definition.table

; Buffer definitions
(buffer_definition
  name: (identifier) @name.definition.buffer) @definition.buffer

; Include statements
(include_statement
  (string) @name.include) @include

; Comments
(comment) @comment

; String literals
(string) @string

; Identifiers
(identifier) @identifier
`
