/**
 * Dashboard Module of Web Application
 *
 * Renders lightweight KPI and chart widgets into the dashboard section.
 */

class DashboardManager {
    constructor(options = {}) {
        this.options = options;
        this.containerId = options.containerId || 'dashboardGrid';
        this.container = document.getElementById(this.containerId);
        this.layout = 'layout1';
    }

    setLayout(layout) {
        this.layout = layout || 'layout1';
        if (this.container) {
            this.container.dataset.layout = this.layout;
        }
        this.emitUpdate();
    }

    render({ data = [], structure = null, chartDataUrl = null } = {}) {
        if (!this.container) return;

        const stats = this.calculateStats(data, structure);
        const chartCard = chartDataUrl
            ? `
                <div class="card h-100">
                    <div class="card-header"><strong>Latest Chart Snapshot</strong></div>
                    <div class="card-body text-center">
                        <img src="${chartDataUrl}" alt="Chart snapshot" style="max-width:100%;height:auto;border:1px solid var(--border-color);border-radius:6px;" />
                    </div>
                </div>
              `
            : `
                <div class="card h-100">
                    <div class="card-header"><strong>Latest Chart Snapshot</strong></div>
                    <div class="card-body d-flex align-items-center justify-content-center text-muted">
                        No chart rendered yet.
                    </div>
                </div>
              `;

        const columns = (structure?.columns || [])
            .slice(0, 8)
            .map((c) => `<li class="list-group-item d-flex justify-content-between"><span>${c.name}</span><small class="text-muted">${c.type}</small></li>`)
            .join('');

        this.container.innerHTML = `
            <div class="row g-3">
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-header"><strong>Dataset Summary</strong></div>
                        <div class="card-body">
                            <p class="mb-1"><strong>Rows:</strong> ${stats.rows}</p>
                            <p class="mb-1"><strong>Columns:</strong> ${stats.columns}</p>
                            <p class="mb-1"><strong>Missing:</strong> ${stats.missing}</p>
                            <p class="mb-0"><strong>Quality:</strong> ${stats.quality}%</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-header"><strong>Columns</strong></div>
                        <div class="card-body p-0">
                            <ul class="list-group list-group-flush">
                                ${columns || '<li class="list-group-item text-muted">No column info available.</li>'}
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    ${chartCard}
                </div>
            </div>
        `;

        this.emitUpdate();
    }

    calculateStats(data, structure) {
        const rows = Array.isArray(data) ? data.length : 0;
        const columns = structure?.columnCount || (rows ? Object.keys(data[0]).length : 0);

        let missing = 0;
        if (rows && columns) {
            const headers = Object.keys(data[0]);
            data.forEach((row) => {
                headers.forEach((h) => {
                    const v = row[h];
                    if (v === null || v === undefined || v === '') missing += 1;
                });
            });
        }

        const totalCells = rows * columns;
        const quality = totalCells ? Math.round(((totalCells - missing) / totalCells) * 100) : 100;

        return { rows, columns, missing, quality };
    }

    exportState() {
        return {
            layout: this.layout,
            html: this.container ? this.container.innerHTML : ''
        };
    }

    emitUpdate() {
        if (typeof this.options.onDashboardUpdated === 'function') {
            this.options.onDashboardUpdated(this.exportState());
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardManager;
} else {
    window.DashboardManager = DashboardManager;
}
