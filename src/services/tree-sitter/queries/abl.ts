/*
OpenEdge ABL language structures
Basic query for ABL (Progress 4GL) language
This is a minimal implementation that can be expanded with proper ABL grammar knowledge
*/
export default String.raw`
; Procedure definitions
(procedure_statement
  name: (identifier) @name.definition.procedure) @definition.procedure

; Function definitions  
(function_statement
  name: (identifier) @name.definition.function) @definition.function

; Class definitions
(class_statement
  name: (identifier) @name.definition.class) @definition.class

; Method definitions
(method_statement
  name: (identifier) @name.definition.method) @definition.method

; Variable definitions
(define_variable_statement
  name: (identifier) @name.definition.variable) @definition.variable

; Property definitions
(define_property_statement
  name: (identifier) @name.definition.property) @definition.property

; Temp-table definitions
(define_temp_table_statement
  name: (identifier) @name.definition.table) @definition.table

; Buffer definitions
(define_buffer_statement
  name: (identifier) @name.definition.buffer) @definition.buffer
`
