export default `
; Document structure
(document) @definition.document

; XML Elements
(element
  (start_tag
    (tag_name) @name.definition)) @definition.element

; Self-closing elements
(self_closing_tag
  (tag_name) @name.definition) @definition.self_closing_element

; Odoo View Definitions - record elements with name attribute
(element
  (start_tag
    (tag_name) @name.view_definition
    (#eq? @name.view_definition "record"))
  (tag_name) @name.record_name
  (attribute
    (attribute_name) @name.id
    (attribute_value) @definition.record_id)) @definition.record

; Odoo Form Views
(element
  (start_tag
    (tag_name) @name.odoo_form)
  (#eq? @name.odoo_form "form")) @definition.form_view

; Odoo Tree Views
(element
  (start_tag
    (tag_name) @name.odoo_tree)
  (#eq? @name.odoo_tree "tree")) @definition.tree_view

; Odoo Kanban Views
(element
  (start_tag
    (tag_name) @name.odoo_kanban)
  (#eq? @name.odoo_kanban "kanban")) @definition.kanban_view

; Odoo Search Views
(element
  (start_tag
    (tag_name) @name.odoo_search)
  (#eq? @name.odoo_search "search")) @definition.search_view

; Odoo Pivot Views
(element
  (start_tag
    (tag_name) @name.odoo_pivot)
  (#eq? @name.odoo_pivot "pivot")) @definition.pivot_view

; Odoo Graph Views
(element
  (start_tag
    (tag_name) @name.odoo_graph)
  (#eq? @name.odoo_graph "graph")) @definition.graph_view

; Odoo Calendar Views
(element
  (start_tag
    (tag_name) @name.odoo_calendar)
  (#eq? @name.odoo_calendar "calendar")) @definition.calendar_view

; Odoo Gantt Views
(element
  (start_tag
    (tag_name) @name.odoo_gantt)
  (#eq? @name.odoo_gantt "gantt")) @definition.gantt_view

; Odoo Diagram Views
(element
  (start_tag
    (tag_name) @name.odoo_diagram)
  (#eq? @name.odoo_diagram "diagram")) @definition.diagram_view

; QWeb Templates - template elements with name attribute
(element
  (start_tag
    (tag_name) @name.qweb_template)
  (attribute
    (attribute_name) @name.template_name
    (attribute_value) @definition.template_name)) @definition.qweb_template

; QWeb t-name attribute
(attribute
  (attribute_name) @name.t_name
  (#eq? @name.t_name "t-name")
  (attribute_value) @definition.t_name_value) @definition.t_name_attr

; Odoo Field Elements
(element
  (start_tag
    (tag_name) @name.odoo_field)
  (#eq? @name.odoo_field "field")) @definition.field

; Odoo Button Elements
(element
  (start_tag
    (tag_name) @name.odoo_button)
  (#eq? @name.odoo_button "button")) @definition.button

; Odoo Group Elements
(element
  (start_tag
    (tag_name) @name.odoo_group)
  (#eq? @name.odoo_group "group")) @definition.group

; Odoo Notebook Elements
(element
  (start_tag
    (tag_name) @name.odoo_notebook)
  (#eq? @name.odoo_notebook "notebook")) @definition.notebook

; Odoo Page Elements
(element
  (start_tag
    (tag_name) @name.odoo_page)
  (#eq? @name.odoo_page "page")) @definition.page

; Odoo Sheet Elements
(element
  (start_tag
    (tag_name) @name.odoo_sheet)
  (#eq? @name.odoo_sheet "sheet")) @definition.sheet

; Odoo Header Elements
(element
  (start_tag
    (tag_name) @name.odoo_header)
  (#eq? @name.odoo_header "header")) @definition.header

; Odoo Div Elements with specific classes
(element
  (start_tag
    (tag_name) @name.odoo_div)
  (attribute
    (attribute_name) @name.oe_chatter)
  (#eq? @name.oe_chatter "oe_chatter")) @definition.oe_chatter

; XML Attributes
(attribute
  (attribute_name) @name.definition) @definition.attribute

; Processing Instructions
(processing_instruction) @definition.processing_instruction

; Comments
(comment) @definition.comment

; CDATA Sections
(cdata) @definition.cdata

; Doctype Declarations
(doctype) @definition.doctype

; XML Declarations
(xmlDeclaration) @definition.xml_declaration

; Namespaces
(element
  (start_tag
    (tag_name) @name.namespace_prefix
    (#match? @name.namespace_prefix "^[a-zA-Z_][a-zA-Z0-9_-]*:[a-zA-Z_][a-zA-Z0-9_-]*$"))) @definition.namespaced_element

; Odoo Action Menus
(element
  (start_tag
    (tag_name) @name.menu)
  (attribute
    (attribute_name) @name.menu_name)
  (#eq? @name.menu "menu")) @definition.menu

; Odoo Action Elements
(element
  (start_tag
    (tag_name) @name.odoo_action)
  (#eq? @name.odoo_action "action")) @definition.action

; Odoo Window Actions
(element
  (start_tag
    (tag_name) @name.window_action)
  (#eq? @name.window_action "window_action")) @definition.window_action

; Odoo Report Actions
(element
  (start_tag
    (tag_name) @name.report)
  (#eq? @name.report "report")) @definition.report

; Odoo List View Fields
(element
  (start_tag
    (tag_name) @name.list_field)
  (attribute
    (attribute_name) @name.field_name)
  (#eq? @name.list_field "field")) @definition.list_field

; Odoo Tree View Columns
(element
  (start_tag
    (tag_name) @name.tree_column)
  (attribute
    (attribute_name) @name.column_name)
  (#eq? @name.tree_column "field")) @definition.tree_column

; Odoo Button Box
(element
  (start_tag
    (tag_name) @name.button_box)
  (#eq? @name.button_box "buttonbox")) @definition.buttonbox

; Odoo Widgets
(element
  (start_tag
    (tag_name) @name.widget)
  (attribute
    (attribute_name) @name.widget_name)
  (#eq? @name.widget "widget")) @definition.widget
`
