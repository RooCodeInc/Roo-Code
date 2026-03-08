/**
 * Excel Analyzer - Main Application Entry Point
 *
 * Provides an end-to-end browser workflow:
 * upload -> preview -> analysis/chart -> dashboard -> export in PDF, Excel or chart.
 */

const appState = {
    currentFile: null,
    rawData: [],
    processedData: [],
    dataStructure: null,
    currentChart: null,
    previewLimit: 100
};

const modules = {
    fileUpload: null,
    dataProcessor: null,
    visualizer: null,
    dashboard: null,
    exporter: null,
    notifications: null
};

const config = {
    settings: null,
    themes: null,
    defaults: null
};

function init() {
    try {
        initConfig();
        initModules();
        initUI();
        showInlineStatus('uploadStatus', 'success', 'Application ready. Upload an Excel file to begin.');
    } catch (error) {
        console.error('Initialization failed:', error);
        showInlineStatus('uploadStatus', 'danger', `Initialization failed: ${error.message}`);
    }
}

function initConfig() {
    config.settings = window.SettingsManager ? new SettingsManager() : null;
    config.themes = window.ThemeManager ? new ThemeManager() : null;
    config.defaults = window.DefaultValues ? new DefaultValues() : null;

    const savedTheme =
        (config.settings && config.settings.get('ui.theme')) ||
        localStorage.getItem('app-theme') ||
        'light';

    if (config.themes) {
        config.themes.setTheme(savedTheme);
    }
}

function initModules() {
    modules.notifications = window.Notifications ? new Notifications() : null;

    modules.fileUpload = new FileUploadManager({
        onFileSelected: handleFileSelected,
        onFileParsed: handleFileParsed,
        onError: handleModuleError
    });

    modules.dataProcessor = new DataProcessor({ onError: handleModuleError });

    modules.visualizer = new Visualizer({
        onChartRendered: (chart) => {
            appState.currentChart = chart;
            updateDashboard();
        },
        onError: handleModuleError
    });

    modules.dashboard = new DashboardManager({
        containerId: 'dashboardGrid',
        onDashboardUpdated: () => {}
    });

    modules.exporter = new Exporter({
        onExportProgress: (progress) => updateExportProgress(progress),
        onExportComplete: ({ filename }) => {
            showInlineStatus('exportStatus', 'success', `Export completed: ${filename}`);
            notify('success', `Export completed: ${filename}`);
        },
        onError: (error) => {
            showInlineStatus('exportStatus', 'danger', error.message || 'Export failed');
            notify('error', error.message || 'Export failed');
        }
    });
}

function initUI() {
    hideAllSections();
    showSection('upload');

    setupNavigation();
    setupPreviewControls();
    setupAnalysisControls();
    setupDashboardControls();
    setupExportControls();
    setupThemeToggle();
}

function setupNavigation() {
    document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const sectionId = link.getAttribute('data-section');
            if (sectionId !== 'upload' && !hasData()) {
                showInlineStatus('uploadStatus', 'warning', 'Please upload and parse a file first.');
                return;
            }
            showSection(sectionId);
        });
    });
}

function setupPreviewControls() {
    const btnFirst100 = document.getElementById('btnFirst100');
    const btnAllData = document.getElementById('btnAllData');

    if (btnFirst100) {
        btnFirst100.addEventListener('click', () => {
            appState.previewLimit = 100;
            renderDataTable(appState.processedData, appState.previewLimit);
        });
    }

    if (btnAllData) {
        btnAllData.addEventListener('click', () => {
            appState.previewLimit = Number.MAX_SAFE_INTEGER;
            renderDataTable(appState.processedData, appState.previewLimit);
        });
    }
}

function setupAnalysisControls() {
    const chartTypeSelector = document.getElementById('chartTypeSelector');
    const xAxisSelector = document.getElementById('xAxisSelector');
    const yAxisSelector = document.getElementById('yAxisSelector');

    if (chartTypeSelector) chartTypeSelector.addEventListener('change', renderSelectedChart);
    if (xAxisSelector) xAxisSelector.addEventListener('change', renderSelectedChart);
    if (yAxisSelector) yAxisSelector.addEventListener('change', renderSelectedChart);
}

function setupDashboardControls() {
    const layouts = {
        layout1: 'layout1',
        layout2: 'layout2',
        layout3: 'layout3'
    };

    Object.keys(layouts).forEach((id) => {
        const button = document.getElementById(id);
        if (!button) return;
        button.addEventListener('click', () => {
            modules.dashboard.setLayout(layouts[id]);
            updateDashboard();
        });
    });
}

function setupExportControls() {
    const exportPDF = document.getElementById('exportPDF');
    const exportExcel = document.getElementById('exportExcel');
    const exportCharts = document.getElementById('exportCharts');

    if (exportPDF) exportPDF.addEventListener('click', () => exportData('pdf'));
    if (exportExcel) exportExcel.addEventListener('click', () => exportData('excel'));
    if (exportCharts) exportCharts.addEventListener('click', () => exportData('png'));
}

function setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle || !config.themes) return;

    toggle.addEventListener('click', () => {
        const current = config.themes.getCurrentTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        config.themes.setTheme(next);
        if (config.settings) {
            config.settings.set('ui.theme', next);
        }
    });
}

function handleFileSelected(file) {
    appState.currentFile = file;
    appState.rawData = [];
    appState.processedData = [];
    appState.dataStructure = null;
    appState.currentChart = null;

    updateFileInfo(file);
    showInlineStatus('uploadStatus', 'info', `Selected file: ${file.name}`);
}

function handleFileParsed(data) {
    if (!Array.isArray(data) || data.length === 0) {
        showInlineStatus('uploadStatus', 'warning', 'File parsed, but no usable rows found.');
        return;
    }

    appState.rawData = data;
    appState.processedData = data;
    appState.dataStructure = modules.dataProcessor.analyzeDataStructure(data);

    updateDataPreview(appState.processedData);
    updateColumnAnalysis(appState.dataStructure);
    populateAxisSelectors(appState.processedData);
    renderSelectedChart();
    updateDashboard();

    showSection('preview');
    notify('success', `Parsed successfully: ${data.length} rows.`);
}

function handleModuleError(error) {
    console.error(error);
    const message = error?.message || 'An unexpected error occurred.';
    showInlineStatus('uploadStatus', 'danger', message);
    notify('error', message);
}

function hasData() {
    return Array.isArray(appState.processedData) && appState.processedData.length > 0;
}

function hideAllSections() {
    ['upload', 'preview', 'analyze', 'dashboard', 'export'].forEach((id) => {
        const section = document.getElementById(id);
        if (section) section.style.display = 'none';
    });
}

function showSection(sectionId) {
    hideAllSections();
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
        section.classList.add('fade-in');
    }

    document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
        link.classList.toggle('active', link.getAttribute('data-section') === sectionId);
    });
}

function updateFileInfo(file) {
    const info = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');

    if (info) info.style.display = 'block';
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = formatFileSize(file.size);
}

function updateDataPreview(data) {
    const stats = calculateDataStats(data);

    const totalRows = document.getElementById('totalRows');
    const totalCols = document.getElementById('totalCols');
    const missingValues = document.getElementById('missingValues');
    const dataQuality = document.getElementById('dataQuality');

    if (totalRows) totalRows.textContent = data.length;
    if (totalCols) totalCols.textContent = data.length ? Object.keys(data[0]).length : 0;
    if (missingValues) missingValues.textContent = stats.missingCount;
    if (dataQuality) dataQuality.textContent = `${stats.qualityPercentage}%`;

    renderDataTable(data, appState.previewLimit);
}

function renderDataTable(data, limit = 100) {
    const tableHeader = document.getElementById('tableHeader');
    const tableBody = document.getElementById('tableBody');
    if (!tableHeader || !tableBody) return;

    if (!data || data.length === 0) {
        tableHeader.innerHTML = '';
        tableBody.innerHTML = '';
        return;
    }

    const headers = Object.keys(data[0]);
    tableHeader.innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;

    const displayRows = data.slice(0, Math.min(limit, data.length));
    tableBody.innerHTML = displayRows
        .map((row) => {
            const cells = headers
                .map((header) => {
                    const value = row[header];
                    const missing = value === null || value === undefined || value === '';
                    return `<td class="${missing ? 'table-warning' : ''}">${missing ? '' : String(value)}</td>`;
                })
                .join('');
            return `<tr>${cells}</tr>`;
        })
        .join('');
}

function calculateDataStats(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return { missingCount: 0, qualityPercentage: 100 };
    }

    const headers = Object.keys(data[0]);
    let missingCount = 0;
    let totalCount = 0;

    data.forEach((row) => {
        headers.forEach((header) => {
            totalCount += 1;
            const value = row[header];
            if (value === null || value === undefined || value === '') {
                missingCount += 1;
            }
        });
    });

    const qualityPercentage = totalCount ? Math.round(((totalCount - missingCount) / totalCount) * 100) : 100;
    return { missingCount, qualityPercentage };
}

function updateColumnAnalysis(structure) {
    const container = document.getElementById('columnAnalysis');
    if (!container || !structure || !Array.isArray(structure.columns)) return;

    container.innerHTML = structure.columns
        .map((col) => {
            const missing = col.missingCount ?? col.nullCount ?? 0;
            return `
                <div class="card mb-2">
                    <div class="card-body p-2">
                        <h6 class="mb-1">${col.name}</h6>
                        <small class="text-muted">Type: ${col.type}</small><br>
                        <small class="text-muted">Unique: ${col.uniqueValues ?? 0}</small><br>
                        <small class="text-muted">Missing: ${missing}</small>
                    </div>
                </div>
            `;
        })
        .join('');
}

function populateAxisSelectors(data) {
    const xAxisSelector = document.getElementById('xAxisSelector');
    const yAxisSelector = document.getElementById('yAxisSelector');
    if (!xAxisSelector || !yAxisSelector || !data || !data.length) return;

    const headers = Object.keys(data[0]);
    const numericHeaders = headers.filter((header) =>
        data.every((row) => row[header] === null || row[header] === '' || !Number.isNaN(Number(row[header])))
    );

    xAxisSelector.innerHTML = headers.map((header) => `<option value="${header}">${header}</option>`).join('');
    yAxisSelector.innerHTML = headers.map((header) => `<option value="${header}">${header}</option>`).join('');

    xAxisSelector.value = headers[0];
    yAxisSelector.value = numericHeaders[0] || headers[Math.min(1, headers.length - 1)] || headers[0];
}

async function renderSelectedChart() {
    if (!hasData()) return;

    const chartTypeSelector = document.getElementById('chartTypeSelector');
    const xAxisSelector = document.getElementById('xAxisSelector');
    const yAxisSelector = document.getElementById('yAxisSelector');

    const type = chartTypeSelector ? chartTypeSelector.value : 'auto';
    const xAxis = xAxisSelector ? xAxisSelector.value : undefined;
    const yAxis = yAxisSelector ? yAxisSelector.value : undefined;

    try {
        const chart = await modules.visualizer.renderChart(appState.processedData.slice(0, 1000), {
            type,
            xAxis,
            yAxis
        });
        appState.currentChart = chart;
        updateDashboard();
    } catch (error) {
        handleModuleError(error);
    }
}

function updateDashboard() {
    if (!modules.dashboard) return;

    const chartDataUrl =
        appState.currentChart && typeof appState.currentChart.toBase64Image === 'function'
            ? appState.currentChart.toBase64Image('image/png', 1)
            : null;

    modules.dashboard.render({
        data: appState.processedData,
        structure: appState.dataStructure,
        chartDataUrl
    });
}

async function exportData(format) {
    if (!hasData()) {
        showInlineStatus('exportStatus', 'warning', 'No data available to export.');
        return;
    }

    const baseName = (appState.currentFile?.name || 'excel-analyzer-data').replace(/\.[^.]+$/, '');

    showInlineStatus('exportStatus', 'info', `Preparing ${format.toUpperCase()} export...`);

    await modules.exporter.export(format, {
        filenameBase: baseName,
        title: `Excel Analyzer Report - ${baseName}`,
        rawData: appState.rawData,
        processedData: appState.processedData,
        dataStructure: appState.dataStructure,
        currentChart: appState.currentChart
    });
}

function updateExportProgress(progress) {
    const wrapper = document.getElementById('exportProgress');
    const bar = wrapper ? wrapper.querySelector('.progress-bar') : null;
    if (!wrapper || !bar) return;

    wrapper.style.display = 'block';
    const value = Math.max(0, Math.min(100, Number(progress?.percentage || 0)));
    bar.style.width = `${value}%`;
    bar.textContent = `${value}%`;
}

function showInlineStatus(elementId, type, message) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = `<div class="alert alert-${type} mb-0">${message}</div>`;
}

function notify(level, message) {
    if (!modules.notifications) return;
    const fn = modules.notifications[level] || modules.notifications.info;
    fn.call(modules.notifications, message);
}

function formatFileSize(bytes) {
    if (!bytes) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

document.addEventListener('DOMContentLoaded', init);

window.ExcelAnalyzer = {
    appState,
    modules,
    config,
    init
};
