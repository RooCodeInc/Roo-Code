/*
OpenEdge DataFrames language structures
Basic query for DF (DataFrames) language
Updated to match actual grammar node names from the tree-sitter-df package
*/
export default String.raw`
; ADD statements for various database objects
(add_field_statement
  (string) @name.definition.field) @definition.field

(add_index_statement
  (string) @name.definition.index) @definition.index

(add_table_statement
  (string) @name.definition.table) @definition.table

(add_sequence_statement
  (string) @name.definition.sequence) @definition.sequence

(add_area_statement
  (string) @name.definition.area) @definition.area

; UPDATE statements
(update_field_statement
  (string) @name.definition.field) @definition.field

(update_table_statement
  (string) @name.definition.table) @definition.table

; String literals for values
(string) @string

; Comments
(comment) @comment
`
