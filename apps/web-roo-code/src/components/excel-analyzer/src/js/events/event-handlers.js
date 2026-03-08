/**
 * Event Handlers of Web Application
 * 
 * Centralized event handling for the Excel Analyzer application.
 */

class EventHandlers {
    constructor(options = {}) {
        this.appState = options.appState || {};
        this.modules = options.modules || {};
        this.utils = options.utils || {};
        this.config = options.config || {};
        this.events = options.events || {};
        
        this.init();
    }
    
    init() {
        this.setupGlobalEventListeners();
        this.setupModuleEventListeners();
        this.setupUIEventListeners();
    }
    
    /**
     * Setup global event listeners
     */
    setupGlobalEventListeners() {
        // Window resize events
        window.addEventListener('resize', this.handleWindowResize.bind(this));
        
        // Keyboard shortcuts
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Before unload confirmation
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        
        // Theme change events
        window.addEventListener('theme:changed', this.handleThemeChange.bind(this));
        
        // App initialization events
        this.events.on('app:initialized', this.handleAppInitialized.bind(this));
    }
    
    /**
     * Setup module-specific event listeners
     */
    setupModuleEventListeners() {
        // File upload events
        if (this.modules.fileUpload) {
            this.modules.fileUpload.onFileSelected = this.handleFileSelected.bind(this);
            this.modules.fileUpload.onFileParsed = this.handleFileParsed.bind(this);
            this.modules.fileUpload.onError = this.handleModuleError.bind(this);
        }
        
        // Data processing events
        if (this.modules.dataProcessor) {
            this.modules.dataProcessor.onDataAnalyzed = this.handleDataAnalyzed.bind(this);
            this.modules.dataProcessor.onDataProcessed = this.handleDataProcessed.bind(this);
            this.modules.dataProcessor.onError = this.handleModuleError.bind(this);
        }
        
        // Visualization events
        if (this.modules.visualizer) {
            this.modules.visualizer.onChartRendered = this.handleChartRendered.bind(this);
            this.modules.visualizer.onChartUpdated = this.handleChartUpdated.bind(this);
            this.modules.visualizer.onError = this.handleModuleError.bind(this);
        }
        
        // Dashboard events
        if (this.modules.dashboard) {
            this.modules.dashboard.onDashboardUpdated = this.handleDashboardUpdated.bind(this);
            this.modules.dashboard.onWidgetAdded = this.handleWidgetAdded.bind(this);
            this.modules.dashboard.onError = this.handleModuleError.bind(this);
        }
        
        // Export events
        if (this.modules.exporter) {
            this.modules.exporter.onExportComplete = this.handleExportComplete.bind(this);
            this.modules.exporter.onExportProgress = this.handleExportProgress.bind(this);
            this.modules.exporter.onError = this.handleModuleError.bind(this);
        }
    }
    
    /**
     * Setup UI event listeners
     */
    setupUIEventListeners() {
        // Navigation events
        this.setupNavigationEvents();
        
        // Chart selection events
        this.setupChartSelectionEvents();
        
        // Dashboard layout events
        this.setupDashboardLayoutEvents();
        
        // Export events
        this.setupExportEvents();
    }
    
    /**
     * Handle window resize
     */
    handleWindowResize() {
        // Resize charts if visualizer is available
        if (this.modules.visualizer && this.modules.visualizer.resizeCharts) {
            this.modules.visualizer.resizeCharts();
        }
        
        // Update dashboard layout if needed
        if (this.modules.dashboard && this.modules.dashboard.handleResize) {
            this.modules.dashboard.handleResize();
        }
    }
    
    /**
     * Handle keyboard shortcuts
     */
    handleKeyDown(event) {
        // Ctrl/Cmd + S: Save dashboard
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            this.handleSaveDashboard();
        }
        
        // Ctrl/Cmd + E: Export
        if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
            event.preventDefault();
            this.handleExport();
        }
        
        // Ctrl/Cmd + T: Toggle theme
        if ((event.ctrlKey || event.metaKey) && event.key === 't') {
            event.preventDefault();
            this.handleThemeToggle();
        }
        
        // Escape: Close modals
        if (event.key === 'Escape') {
            this.handleEscapeKey();
        }
    }
    
    /**
     * Handle before unload
     */
    handleBeforeUnload(event) {
        if (this.appState.rawData && this.appState.rawData.length > 0) {
            event.preventDefault();
            event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        }
    }
    
    /**
     * Handle theme change
     */
    handleThemeChange(event) {
        const theme = event.detail.theme;
        console.log(`Theme changed to: ${theme}`);
        
        // Update any theme-dependent components
        if (this.modules.visualizer) {
            this.modules.visualizer.updateTheme(theme);
        }
        
        if (this.modules.dashboard) {
            this.modules.dashboard.updateTheme(theme);
        }
    }
    
    /**
     * Handle app initialization
     */
    handleAppInitialized(event) {
        console.log('Application initialized successfully');
        
        // Setup any post-initialization tasks
        this.setupPostInitialization();
    }
    
    /**
     * Handle file selected
     */
    handleFileSelected(file) {
        console.log('File selected:', file.name);
        
        // Update app state
        this.appState.currentFile = file;
        this.appState.rawData = [];
        this.appState.processedData = [];
        this.appState.dataStructure = null;
        this.appState.visualizations = [];
        
        // Update UI
        this.updateFileInfo(file);
        this.showSection('preview');
        
        // Save state
        this.saveAppState();
    }
    
    /**
     * Handle file parsed
     */
    handleFileParsed(data) {
        console.log('File parsed successfully');
        
        this.appState.rawData = data;
        
        // Update UI
        this.updateDataPreview(data);
        
        // Save state
        this.saveAppState();
    }
    
    /**
     * Handle data analyzed
     */
    handleDataAnalyzed(structure) {
        console.log('Data analyzed');
        
        this.appState.dataStructure = structure;
        
        // Update UI
        this.updateColumnAnalysis(structure);
        this.showSection('analyze');
        
        // Save state
        this.saveAppState();
    }
    
    /**
     * Handle data processed
     */
    handleDataProcessed(processedData) {
        console.log('Data processed');
        
        this.appState.processedData = processedData;
        
        // Save state
        this.saveAppState();
    }
    
    /**
     * Handle chart rendered
     */
    handleChartRendered(chart) {
        console.log('Chart rendered');
        
        this.appState.visualizations.push(chart);
        
        // Save state
        this.saveAppState();
    }
    
    /**
     * Handle chart updated
     */
    handleChartUpdated(chart) {
        console.log('Chart updated');
        
        const index = this.appState.visualizations.findIndex(c => c.id === chart.id);
        if (index !== -1) {
            this.appState.visualizations[index] = chart;
        }
        
        // Save state
        this.saveAppState();
    }
    
    /**
     * Handle dashboard updated
     */
    handleDashboardUpdated(dashboard) {
        console.log('Dashboard updated');
        
        this.appState.dashboard = dashboard;
        
        // Save state
        this.saveAppState();
    }
    
    /**
     * Handle widget added
     */
    handleWidgetAdded(widget) {
        console.log('Widget added to dashboard');
        
        // Dashboard manager handles this internally
        
        // Save state
        this.saveAppState();
    }
    
    /**
     * Handle export complete
     */
    handleExportComplete(result) {
        console.log('Export completed:', result);
        
        this.showSuccessMessage(`Export completed successfully: ${result.filename}`);
    }
    
    /**
     * Handle export progress
     */
    handleExportProgress(progress) {
        console.log('Export progress:', progress);
        
        this.updateExportProgress(progress);
    }
    
    /**
     * Handle module error
     */
    handleModuleError(error) {
        console.error('Module error:', error);
        
        this.showErrorMessage(error.message || 'An error occurred. Please try again.');
    }
    
    /**
     * Setup navigation events
     */
    setupNavigationEvents() {
        const links = document.querySelectorAll('.nav-link[data-section]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.getAttribute('data-section');
                this.showSection(sectionId);
            });
        });
    }
    
    /**
     * Setup chart selection events
     */
    setupChartSelectionEvents() {
        const chartTypeSelector = document.getElementById('chartTypeSelector');
        const xAxisSelector = document.getElementById('xAxisSelector');
        const yAxisSelector = document.getElementById('yAxisSelector');
        
        if (chartTypeSelector) {
            chartTypeSelector.addEventListener('change', (e) => {
                this.handleChartTypeChange(e.target.value);
            });
        }
        
        if (xAxisSelector) {
            xAxisSelector.addEventListener('change', (e) => {
                this.handleAxisChange('x', e.target.value);
            });
        }
        
        if (yAxisSelector) {
            yAxisSelector.addEventListener('change', (e) => {
                this.handleAxisChange('y', e.target.value);
            });
        }
    }
    
    /**
     * Setup dashboard layout events
     */
    setupDashboardLayoutEvents() {
        const layoutButtons = document.querySelectorAll('.btn[data-layout]');
        layoutButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const layout = e.target.getAttribute('data-layout');
                this.handleLayoutChange(layout);
            });
        });
    }
    
    /**
     * Setup export events
     */
    setupExportEvents() {
        const exportButtons = document.querySelectorAll('[data-export-format]');
        exportButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const format = e.target.getAttribute('data-export-format');
                this.handleExport(format);
            });
        });
    }
    
    /**
     * Handle chart type change
     */
    handleChartTypeChange(chartType) {
        console.log('Chart type changed to:', chartType);
        
        // Update chart configuration
        if (this.modules.visualizer) {
            this.modules.visualizer.updateChartType(chartType);
        }
    }
    
    /**
     * Handle axis change
     */
    handleAxisChange(axis, value) {
        console.log(`${axis} axis changed to:`, value);
        
        // Update chart configuration
        if (this.modules.visualizer) {
            this.modules.visualizer.updateAxis(axis, value);
        }
    }
    
    /**
     * Handle layout change
     */
    handleLayoutChange(layout) {
        console.log('Layout changed to:', layout);
        
        // Update dashboard layout
        if (this.modules.dashboard) {
            this.modules.dashboard.setLayout(layout);
        }
    }
    
    /**
     * Handle export
     */
    handleExport(format = 'pdf') {
        console.log('Export requested:', format);
        
        if (this.modules.exporter) {
            this.modules.exporter.export(format);
        }
    }
    
    /**
     * Handle save dashboard
     */
    handleSaveDashboard() {
        console.log('Save dashboard requested');
        
        if (this.modules.dashboard) {
            this.modules.dashboard.save();
        }
    }
    
    /**
     * Handle theme toggle
     */
    handleThemeToggle() {
        console.log('Theme toggle requested');
        
        if (this.config.themes) {
            this.config.themes.toggleTheme();
        }
    }
    
    /**
     * Handle escape key
     */
    handleEscapeKey() {
        console.log('Escape key pressed');
        
        // Close any open modals or dropdowns
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
            }
        });
        
        const dropdowns = document.querySelectorAll('.dropdown.show');
        dropdowns.forEach(dropdown => {
            const dropdownInstance = bootstrap.Dropdown.getInstance(dropdown);
            if (dropdownInstance) {
                dropdownInstance.hide();
            }
        });
    }
    
    /**
     * Setup post-initialization tasks
     */
    setupPostInitialization() {
        // Load saved state if available
        this.loadAppState();
        
        // Initialize tooltips
        this.initializeTooltips();
        
        // Setup theme switcher if available
        this.setupThemeSwitcher();
    }
    
    /**
     * Update file info display
     */
    updateFileInfo(file) {
        const fileNameEl = document.getElementById('fileName');
        const fileSizeEl = document.getElementById('fileSize');
        
        if (fileNameEl) fileNameEl.textContent = file.name;
        if (fileSizeEl) fileSizeEl.textContent = this.utils.formatters.formatFileSize(file.size);
    }
    
    /**
     * Update data preview
     */
    updateDataPreview(data) {
        // Update statistics
        const totalRowsEl = document.getElementById('totalRows');
        const totalColsEl = document.getElementById('totalCols');
        const missingValuesEl = document.getElementById('missingValues');
        const dataQualityEl = document.getElementById('dataQuality');
        
        if (totalRowsEl) totalRowsEl.textContent = data.length;
        if (totalColsEl && data.length > 0) totalColsEl.textContent = Object.keys(data[0]).length;
        
        // Calculate missing values and data quality
        const stats = this.calculateDataStats(data);
        if (missingValuesEl) missingValuesEl.textContent = stats.missingCount;
        if (dataQualityEl) dataQualityEl.textContent = `${stats.qualityPercentage}%`;
        
        // Update table
        this.renderDataTable(data);
    }
    
    /**
     * Update column analysis
     */
    updateColumnAnalysis(structure) {
        const container = document.getElementById('columnAnalysis');
        if (container && structure) {
            container.innerHTML = this.generateColumnAnalysisHTML(structure);
        }
    }
    
    /**
     * Show section
     */
    showSection(sectionId) {
        const sections = ['upload', 'preview', 'analyze', 'dashboard', 'export'];
        sections.forEach(section => {
            const element = document.getElementById(section);
            if (element) {
                element.style.display = section === sectionId ? 'block' : 'none';
                if (section === sectionId) {
                    element.classList.add('fade-in');
                }
            }
        });
        
        // Update navigation
        this.updateNavigationActive(sectionId);
    }
    
    /**
     * Update navigation active state
     */
    updateNavigationActive(sectionId) {
        const links = document.querySelectorAll('.nav-link');
        links.forEach(link => {
            if (link.getAttribute('data-section') === sectionId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
    
    /**
     * Show success message
     */
    showSuccessMessage(message) {
        const statusEl = document.getElementById('exportStatus');
        if (statusEl) {
            statusEl.innerHTML = `<div class="alert alert-success">${message}</div>`;
        }
    }
    
    /**
     * Show error message
     */
    showErrorMessage(message) {
        const statusEl = document.getElementById('uploadStatus') || document.getElementById('exportStatus');
        if (statusEl) {
            statusEl.innerHTML = `<div class="alert alert-danger">${message}</div>`;
        }
    }
    
    /**
     * Update export progress
     */
    updateExportProgress(progress) {
        const progressEl = document.getElementById('exportProgress');
        const progressBarEl = progressEl ? progressEl.querySelector('.progress-bar') : null;
        
        if (progressEl) {
            progressEl.style.display = 'block';
        }
        
        if (progressBarEl) {
            progressBarEl.style.width = `${progress.percentage}%`;
            progressBarEl.textContent = `${progress.percentage}%`;
        }
    }
    
    /**
     * Render data table
     */
    renderDataTable(data) {
        const tableBody = document.getElementById('tableBody');
        const tableHeader = document.getElementById('tableHeader');
        
        if (!tableBody || !tableHeader || data.length === 0) return;
        
        // Generate headers
        const headers = Object.keys(data[0]);
        tableHeader.innerHTML = '<tr>' + headers.map(header => `<th>${header}</th>`).join('') + '</tr>';
        
        // Generate rows (limit to first 100 for performance)
        const displayData = data.slice(0, 100);
        tableBody.innerHTML = displayData.map(row => {
            return '<tr>' + headers.map(header => `<td>${row[header] || ''}</td>`).join('') + '</tr>';
        }).join('');
    }
    
    /**
     * Calculate data statistics
     */
    calculateDataStats(data) {
        if (data.length === 0) return { missingCount: 0, qualityPercentage: 100 };
        
        const headers = Object.keys(data[0]);
        let missingCount = 0;
        let totalCount = 0;
        
        data.forEach(row => {
            headers.forEach(header => {
                totalCount++;
                if (row[header] === null || row[header] === undefined || row[header] === '') {
                    missingCount++;
                }
            });
        });
        
        const qualityPercentage = Math.round(((totalCount - missingCount) / totalCount) * 100);
        
        return {
            missingCount,
            qualityPercentage
        };
    }
    
    /**
     * Generate column analysis HTML
     */
    generateColumnAnalysisHTML(structure) {
        if (!structure || !structure.columns) return '';
        
        return structure.columns.map(col => `
            <div class="card mb-2">
                <div class="card-body">
                    <h6 class="card-title">${col.name}</h6>
                    <p class="card-text">
                        <small class="text-muted">Type: ${col.type}</small><br>
                        <small class="text-muted">Unique Values: ${col.uniqueValues}</small><br>
                        <small class="text-muted">Missing: ${col.missingCount}</small>
                    </p>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Initialize tooltips
     */
    initializeTooltips() {
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }
    }
    
    /**
     * Setup theme switcher
     */
    setupThemeSwitcher() {
        const themeContainer = document.getElementById('theme-switcher-container');
        if (themeContainer && this.config.themes) {
            this.config.themes.createThemeSwitcher(themeContainer);
        }
    }
    
    /**
     * Save application state
     */
    saveAppState() {
        localStorage.setItem('excel-analyzer-state', JSON.stringify(this.appState));
    }
    
    /**
     * Load application state
     */
    loadAppState() {
        const savedState = localStorage.getItem('excel-analyzer-state');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                Object.assign(this.appState, state);
                console.log('Application state loaded from localStorage');
            } catch (error) {
                console.warn('Failed to load saved state:', error);
                localStorage.removeItem('excel-analyzer-state');
            }
        }
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventHandlers;
} else {
    window.EventHandlers = EventHandlers;
}