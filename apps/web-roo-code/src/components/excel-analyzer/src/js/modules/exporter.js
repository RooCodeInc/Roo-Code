/**
 * Export Module of Web Application
 *
 * Handles export to PDF, Excel, CSV, JSON and PNG chart image.
 */

class Exporter {
    constructor(options = {}) {
        this.options = options;
    }

    async export(format, options = {}) {
        const normalizedFormat = String(format || '').toLowerCase();
        const payload = this.preparePayload(options);

        this.emitProgress(15, 'Preparing export data...');

        let result;
        switch (normalizedFormat) {
            case 'pdf':
                result = await this.exportPDF(payload, options);
                break;
            case 'excel':
            case 'xlsx':
                result = await this.exportExcel(payload, options);
                break;
            case 'csv':
                result = await this.exportCSV(payload, options);
                break;
            case 'json':
                result = await this.exportJSON(payload, options);
                break;
            case 'png':
                result = await this.exportPNG(payload, options);
                break;
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }

        this.emitProgress(90, 'Downloading file...');
        this.downloadBlob(result.blob, result.filename);
        this.emitProgress(100, 'Export complete.');

        if (typeof this.options.onExportComplete === 'function') {
            this.options.onExportComplete({
                format: normalizedFormat,
                filename: result.filename
            });
        }

        return result;
    }

    preparePayload(options = {}) {
        return {
            rawData: Array.isArray(options.rawData) ? options.rawData : [],
            processedData: Array.isArray(options.processedData) ? options.processedData : [],
            dataStructure: options.dataStructure || null,
            title: options.title || 'Excel Analyzer Report',
            chart: options.currentChart || null,
            exportedAt: new Date()
        };
    }

    getFileBase(options = {}) {
        const rawBase = options.filenameBase || 'excel-analyzer-export';
        return rawBase.replace(/[<>:"/\\|?*]+/g, '-');
    }

    getTimestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-');
    }

    async exportPDF(payload, options = {}) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error('jsPDF is not available in this page.');
        }

        const doc = new window.jspdf.jsPDF();
        const lineHeight = 7;
        let y = 15;

        doc.setFontSize(16);
        doc.text(payload.title, 14, y);
        y += 10;

        doc.setFontSize(10);
        doc.text(`Exported: ${payload.exportedAt.toLocaleString()}`, 14, y);
        y += lineHeight;
        doc.text(`Rows: ${payload.processedData.length}`, 14, y);
        y += lineHeight;
        doc.text(`Columns: ${payload.processedData.length ? Object.keys(payload.processedData[0]).length : 0}`, 14, y);
        y += lineHeight * 2;

        const previewRows = payload.processedData.slice(0, 20);
        if (previewRows.length > 0) {
            const headers = Object.keys(previewRows[0]);
            doc.setFont(undefined, 'bold');
            doc.text(headers.join(' | ').slice(0, 180), 14, y);
            y += lineHeight;
            doc.setFont(undefined, 'normal');

            previewRows.forEach((row) => {
                if (y > 280) {
                    doc.addPage();
                    y = 15;
                }
                const line = headers.map((h) => (row[h] ?? '')).join(' | ');
                doc.text(String(line).slice(0, 180), 14, y);
                y += lineHeight;
            });
        }

        if (payload.chart && typeof payload.chart.toBase64Image === 'function') {
            try {
                const img = payload.chart.toBase64Image('image/png', 1);
                doc.addPage();
                doc.setFontSize(12);
                doc.text('Chart Snapshot', 14, 15);
                doc.addImage(img, 'PNG', 14, 24, 180, 100);
            } catch (error) {
                console.warn('Could not embed chart image in PDF.', error);
            }
        }

        const blob = doc.output('blob');
        const filename = `${this.getFileBase(options)}-${this.getTimestamp()}.pdf`;
        return { blob, filename };
    }

    async exportExcel(payload, options = {}) {
        if (!window.XLSX) {
            throw new Error('SheetJS (XLSX) is not available in this page.');
        }

        const workbook = window.XLSX.utils.book_new();
        const data = payload.processedData.length ? payload.processedData : payload.rawData;

        const dataSheet = window.XLSX.utils.json_to_sheet(data);
        window.XLSX.utils.book_append_sheet(workbook, dataSheet, 'Processed Data');

        const summaryRows = [
            { Metric: 'Title', Value: payload.title },
            { Metric: 'Exported At', Value: payload.exportedAt.toLocaleString() },
            { Metric: 'Total Rows', Value: data.length },
            { Metric: 'Total Columns', Value: data.length ? Object.keys(data[0]).length : 0 }
        ];
        const summarySheet = window.XLSX.utils.json_to_sheet(summaryRows);
        window.XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

        const arrayBuffer = window.XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array'
        });

        const blob = new Blob([arrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const filename = `${this.getFileBase(options)}-${this.getTimestamp()}.xlsx`;
        return { blob, filename };
    }

    async exportCSV(payload, options = {}) {
        const data = payload.processedData.length ? payload.processedData : payload.rawData;
        const csv = this.toCSV(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const filename = `${this.getFileBase(options)}-${this.getTimestamp()}.csv`;
        return { blob, filename };
    }

    async exportJSON(payload, options = {}) {
        const content = JSON.stringify(
            {
                title: payload.title,
                exportedAt: payload.exportedAt.toISOString(),
                dataStructure: payload.dataStructure,
                data: payload.processedData.length ? payload.processedData : payload.rawData
            },
            null,
            2
        );

        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const filename = `${this.getFileBase(options)}-${this.getTimestamp()}.json`;
        return { blob, filename };
    }

    async exportPNG(payload, options = {}) {
        if (!payload.chart || typeof payload.chart.toBase64Image !== 'function') {
            throw new Error('No chart is available yet for PNG export. Render a chart first.');
        }

        const dataUrl = payload.chart.toBase64Image('image/png', 1);
        const blob = await (await fetch(dataUrl)).blob();
        const filename = `${this.getFileBase(options)}-${this.getTimestamp()}.png`;
        return { blob, filename };
    }

    toCSV(rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
            return '';
        }

        const headers = Object.keys(rows[0]);
        const csvRows = [headers.join(',')];

        rows.forEach((row) => {
            const line = headers
                .map((header) => {
                    const value = row[header] ?? '';
                    const text = String(value);
                    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
                })
                .join(',');
            csvRows.push(line);
        });

        return csvRows.join('\n');
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    emitProgress(percentage, message) {
        if (typeof this.options.onExportProgress === 'function') {
            this.options.onExportProgress({ percentage, message });
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Exporter;
} else {
    window.Exporter = Exporter;
}
