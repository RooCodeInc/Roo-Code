/*
OpenEdge DataFrames language structures
Basic query for DF (DataFrames) language
This is a minimal implementation that can be expanded with proper DF grammar knowledge
*/
export default String.raw`
; Field definitions
(field_definition
  name: (identifier) @name.definition.field) @definition.field

; Index definitions
(index_definition
  name: (identifier) @name.definition.index) @definition.index

; Table definitions
(table_definition
  name: (identifier) @name.definition.table) @definition.table

; Sequence definitions
(sequence_definition
  name: (identifier) @name.definition.sequence) @definition.sequence

; Trigger definitions
(trigger_definition
  name: (identifier) @name.definition.trigger) @definition.trigger

; Area definitions
(area_definition
  name: (identifier) @name.definition.area) @definition.area

; Database definitions
(database_definition
  name: (identifier) @name.definition.database) @definition.database
`
