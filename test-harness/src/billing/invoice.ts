/**
 * Billing — Invoice Module
 *
 * Generates invoices for customer orders.
 * This module is scoped under the "optimize-billing" intent (currently PAUSED).
 */

export interface InvoiceLineItem {
	description: string
	quantity: number
	unitPrice: number
}

export interface Invoice {
	invoiceId: string
	customerId: string
	items: InvoiceLineItem[]
	subtotal: number
	tax: number
	total: number
	createdAt: string
}

/**
 * Generate an invoice from a list of line items.
 */
export function generateInvoice(customerId: string, items: InvoiceLineItem[]): Invoice {
	const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
	const taxRate = 0.15
	const tax = Math.round(subtotal * taxRate * 100) / 100
	const total = Math.round((subtotal + tax) * 100) / 100

	return {
		invoiceId: `INV-${Date.now()}`,
		customerId,
		items,
		subtotal,
		tax,
		total,
		createdAt: new Date().toISOString(),
	}
}

/**
 * Format an invoice as a human-readable string.
 */
export function formatInvoice(invoice: Invoice): string {
	const header = `Invoice ${invoice.invoiceId} for ${invoice.customerId}`
	const lines = invoice.items.map((item) => `  ${item.description}: ${item.quantity} x $${item.unitPrice.toFixed(2)}`)
	const footer = [
		`  Subtotal: $${invoice.subtotal.toFixed(2)}`,
		`  Tax:      $${invoice.tax.toFixed(2)}`,
		`  Total:    $${invoice.total.toFixed(2)}`,
	]

	return [header, ...lines, ...footer].join("\n")
}
