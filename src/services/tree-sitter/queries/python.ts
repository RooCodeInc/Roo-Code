/*
Python Tree-sitter Query Patterns
*/
export default `
(class_definition
  name: (identifier) @name.definition.class) @definition.class

(decorated_definition
  definition: (class_definition
    name: (identifier) @name.definition.class)) @definition.class

(function_definition
  name: (identifier) @name.definition.function) @definition.function

(decorated_definition
  definition: (function_definition
    name: (identifier) @name.definition.function)) @definition.function

(expression_statement
  (assignment
    left: (identifier) @name.definition.lambda
    right: (parenthesized_expression
      (lambda)))) @definition.lambda

(function_definition
  name: (identifier) @name.definition.generator
  body: (block
    (expression_statement
      (yield)))) @definition.generator

(expression_statement
  (assignment
    left: (identifier) @name.definition.comprehension
    right: [
      (list_comprehension)
      (dictionary_comprehension)
      (set_comprehension)
    ])) @definition.comprehension

(with_statement) @definition.with_statement

(try_statement) @definition.try_statement

(import_from_statement) @definition.import

(import_statement) @definition.import

(function_definition
  body: (block
    [(global_statement) (nonlocal_statement)])) @definition.scope

(function_definition
  body: (block
    (match_statement))) @definition.match_case

(typed_parameter
  type: (type) @definition.type_annotation)

(expression_statement
  (assignment
    left: (identifier) @name.definition.type
    type: (type))) @definition.type_annotation
`

/**
 * Enhanced Python queries for extracting additional metadata
 * These queries capture decorators, type aliases, enums, generic types, and other advanced features
 */
export const pythonEnhancedQuery = `
; Type aliases
(assignment
  left: (identifier) @typealias.name
  right: (string
    (string_content) @typealias.annotation))
  (#eq? @typealias.annotation "typing.TypeAlias")

; Enum classes
(class_definition
  name: (identifier) @enum.name)

; Generic classes
(class_definition
  name: (identifier) @generic.class.name)

; Generic functions
(function_definition
  name: (identifier) @generic.function.name)

; TypeVar
(assignment
  left: (identifier) @typevar.name
  right: (call
    function: (identifier) @typevar.call))
  (#eq? @typevar.call "TypeVar")

; Import statements
(import_from_statement
  module_name: (dotted_name) @import.module)

(import_statement
  (dotted_name) @import.module)

; Functions
(function_definition
  name: (identifier) @func.name)

; Class inheritance
(class_definition
  name: (identifier) @class.name)

; Decorated definitions
(decorated_definition
  definition: (_) @decorated.definition)

; Decorator keyword for test
; decorator
`
