/*
Dart Tree-sitter Query Patterns

This file contains query patterns for Dart language constructs:
- class definitions - Captures standard class definitions
- method signatures - Captures all method types (getters, setters, constructors, factory, operators)
- function signatures - Captures standalone function definitions
- mixin declarations - Captures Dart mixin definitions
- extension declarations - Captures extension methods on existing types
- enum declarations - Captures enum definitions
- type aliases - Captures typedef declarations
- references - Captures class instantiation, method calls, property access
*/
export default `
; Class definitions
(class_definition
  name: (identifier) @name) @definition.class

; Method signatures (various types)
(method_signature
  (function_signature)) @definition.method

(method_signature
(getter_signature
  name: (identifier) @name)) @definition.method

(method_signature
(setter_signature
  name: (identifier) @name)) @definition.method

(method_signature
  (function_signature
  name: (identifier) @name)) @definition.method

(method_signature
  (factory_constructor_signature
    (identifier) @name)) @definition.method

(method_signature
  (constructor_signature
  name: (identifier) @name)) @definition.method

(method_signature
  (operator_signature)) @definition.method

(method_signature) @definition.method

; Type aliases
(type_alias
  (type_identifier) @name) @definition.type

; Mixin declarations
(mixin_declaration
  (mixin)
  (identifier) @name) @definition.mixin

; Extension declarations
(extension_declaration
  name: (identifier) @name) @definition.extension

; Enum declarations
(enum_declaration
  name: (identifier) @name) @definition.enum

; Function signatures
(function_signature
  name: (identifier) @name) @definition.function

; References
(new_expression
  (type_identifier) @name) @reference.class

(initialized_variable_definition
  name: (identifier)
  value: (identifier) @name 
  value: (selector
	"!"?
	(argument_part 
	  (arguments
	    (argument)*))?)?) @reference.class

(assignment_expression
  left: (assignable_expression 
		  (identifier)
		  (unconditional_assignable_selector
			"."
			(identifier) @name))) @reference.call

(assignment_expression
  left: (assignable_expression 
		  (identifier)
		  (conditional_assignable_selector
			"?."
			(identifier) @name))) @reference.call

((identifier) @name
 (selector
    "!"?
    (conditional_assignable_selector
      "?." (identifier) @name)?
    (unconditional_assignable_selector
      "."? (identifier) @name)?
    (argument_part
      (arguments
        (argument)*))?)*
	(cascade_section
	  (cascade_selector
		(identifier)) @name 
	  (argument_part 
		(arguments
		  (argument)*))?)?) @reference.call
`
