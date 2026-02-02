/**
 * Odoo-specific GraphBuilder Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { GraphBuilder } from "../builder"

describe("GraphBuilder - Odoo ERP Support", () => {
	let builder: GraphBuilder

	beforeEach(() => {
		builder = new GraphBuilder()
	})

	describe("Odoo Python Models", () => {
		it("should extract Odoo model classes", async () => {
			const content = `
from odoo import models, fields, api

class SaleOrder(models.Model):
    _name = 'sale.order'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Order Reference', required=True)
    partner_id = fields.Many2one('res.partner', string='Customer')
    order_line = fields.One2many('sale.order.line', 'order_id')
    amount_total = fields.Monetary(string='Total')

    @api.model
    def create(self, vals):
        return super().create(vals)

    @api.depends('order_line.price_total')
    def _compute_amount_total(self):
        pass
`
			const result = await builder.parseFile("/addons/sale/models/sale_order.py", content)

			expect(result.success).toBe(true)

			// Check imports
			const importPaths = result.imports.map((i) => i.target)
			expect(importPaths).toContain("odoo")

			// Check exports - should find class, _name, fields, and methods
			const exportNames = result.exports.map((e) => e.name)
			expect(exportNames).toContain("SaleOrder")
			expect(exportNames).toContain("sale.order")
			expect(exportNames).toContain("name")
			expect(exportNames).toContain("partner_id")
			expect(exportNames).toContain("order_line")
			expect(exportNames).toContain("create")
		})

		it("should extract manifest dependencies", async () => {
			const content = `
{
    'name': 'Sale Management',
    'version': '16.0.1.0.0',
    'category': 'Sales/Sales',
    'depends': [
        'base',
        'sale',
        'account',
        'stock',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/sale_views.xml',
    ],
}
`
			const result = await builder.parseFile("/addons/custom_sale/__manifest__.py", content)

			expect(result.success).toBe(true)

			const importPaths = result.imports.map((i) => i.target)
			expect(importPaths).toContain("base")
			expect(importPaths).toContain("sale")
			expect(importPaths).toContain("account")
			expect(importPaths).toContain("stock")
		})

		it("should handle odoo.addons imports", async () => {
			const content = `
from odoo.addons.sale.models.sale_order import SaleOrder
from odoo.addons.stock import models
from . import models
from .models import sale_order
`
			const result = await builder.parseFile("/addons/custom/__init__.py", content)

			expect(result.success).toBe(true)

			const importPaths = result.imports.map((i) => i.target)
			expect(importPaths).toContain("sale")
			expect(importPaths).toContain("stock")
		})
	})

	describe("Odoo XML Views", () => {
		it("should extract record IDs from views", async () => {
			const content = `
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="view_sale_order_form" model="ir.ui.view">
        <field name="name">sale.order.form</field>
        <field name="model">sale.order</field>
        <field name="inherit_id" ref="sale.view_order_form"/>
        <field name="arch" type="xml">
            <xpath expr="//field[@name='partner_id']" position="after">
                <field name="custom_field"/>
            </xpath>
        </field>
    </record>

    <record id="action_sale_custom" model="ir.actions.act_window">
        <field name="name">Custom Sales</field>
        <field name="res_model">sale.order</field>
    </record>

    <menuitem id="menu_sale_custom"
              name="Custom Sale"
              parent="sale.sale_menu_root"
              action="action_sale_custom"/>
</odoo>
`
			const result = await builder.parseFile("/addons/custom/views/sale_views.xml", content)

			expect(result.success).toBe(true)

			// Check exports (record IDs)
			const exportNames = result.exports.map((e) => e.name)
			expect(exportNames).toContain("view_sale_order_form")
			expect(exportNames).toContain("action_sale_custom")

			// Check imports (references to other records)
			const importTargets = result.imports.map((i) => i.target)
			expect(importTargets).toContain("sale.view_order_form") // inherit_id
			expect(importTargets).toContain("sale.sale_menu_root") // menu parent
			expect(importTargets).toContain("action_sale_custom") // menu action
		})

		it("should extract QWeb template references", async () => {
			const content = `
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <template id="custom_portal_template" inherit_id="portal.portal_my_home">
        <xpath expr="//div[@class='dashboard']" position="inside">
            <t t-call="custom.custom_dashboard"/>
        </xpath>
    </template>

    <template id="custom_dashboard">
        <div class="custom-dashboard">
            <t t-call="web.external_layout"/>
        </div>
    </template>
</odoo>
`
			const result = await builder.parseFile("/addons/custom/views/templates.xml", content)

			expect(result.success).toBe(true)

			// Check template exports
			const exportNames = result.exports.map((e) => e.name)
			expect(exportNames).toContain("custom_portal_template")
			expect(exportNames).toContain("custom_dashboard")

			// Check t-call imports
			const importTargets = result.imports.map((i) => i.target)
			expect(importTargets).toContain("custom.custom_dashboard")
			expect(importTargets).toContain("web.external_layout")
		})
	})

	describe("SCSS/CSS Support", () => {
		it("should extract SCSS imports and exports", async () => {
			const content = `
@import 'variables';
@import 'mixins/buttons';
@use 'sass:math';
@forward 'base';

$primary-color: #007bff;
$secondary-color: #6c757d;

@mixin button-style($bg-color) {
    background: $bg-color;
}

%clearfix {
    &::after {
        clear: both;
    }
}

.o-sale-order {
    color: $primary-color;
}
`
			const result = await builder.parseFile("/addons/custom/static/src/scss/style.scss", content)

			expect(result.success).toBe(true)

			// Check imports
			const importPaths = result.imports.map((i) => i.target)
			expect(importPaths).toContain("variables")
			expect(importPaths).toContain("mixins/buttons")
			expect(importPaths).toContain("sass:math")
			expect(importPaths).toContain("base")

			// Check exports
			const exportNames = result.exports.map((e) => e.name)
			expect(exportNames).toContain("primary-color")
			expect(exportNames).toContain("secondary-color")
			expect(exportNames).toContain("button-style")
			expect(exportNames).toContain("clearfix")
		})

		it("should extract CSS imports and selectors", async () => {
			const content = `
@import url('https://fonts.googleapis.com/css?family=Roboto');
@import 'base.css';

:root {
    --primary-color: #007bff;
    --font-size-base: 16px;
}

.o-kanban-view {
    display: flex;
}

#main-content {
    padding: 20px;
}
`
			const result = await builder.parseFile("/addons/custom/static/src/css/style.css", content)

			expect(result.success).toBe(true)

			// Check imports
			const importPaths = result.imports.map((i) => i.target)
			expect(importPaths.some((p) => p.includes("fonts.googleapis.com"))).toBe(true)
			expect(importPaths).toContain("base.css")

			// Check exports (CSS custom properties and selectors)
			const exportNames = result.exports.map((e) => e.name)
			expect(exportNames).toContain("primary-color")
			expect(exportNames).toContain("font-size-base")
			expect(exportNames).toContain("o-kanban-view")
			expect(exportNames).toContain("main-content")
		})
	})

	describe("Supported Extensions", () => {
		it("should include all Odoo file types", () => {
			const extensions = builder.getSupportedExtensions()

			// Core web languages
			expect(extensions).toContain(".ts")
			expect(extensions).toContain(".tsx")
			expect(extensions).toContain(".js")
			expect(extensions).toContain(".jsx")

			// Python (Odoo backend)
			expect(extensions).toContain(".py")

			// XML (Odoo views/data)
			expect(extensions).toContain(".xml")

			// Styling
			expect(extensions).toContain(".scss")
			expect(extensions).toContain(".css")
		})
	})
})
