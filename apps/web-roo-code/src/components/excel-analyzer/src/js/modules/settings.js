/**
 * Settings Module
 * 
 * Manages application settings, user preferences, and configuration.
 */

class Settings {
    constructor(options = {}) {
        this.options = options;
        this.settings = {};
        this.defaultSettings = {
            // File Upload Settings
            fileUpload: {
                maxFileSize: 50 * 1024 * 1024, // 50MB
                enableDragDrop: true,
                enableMultiple: false,
                previewRows: 100
            },
            
            // Data Processing Settings
            dataProcessing: {
                defaultMissingValueHandling: 'remove',
                defaultOutlierHandling: 'remove',
                outlierThreshold: 3,
                autoDetectDataTypes: true,
                enableDataValidation: true,
                maxPreviewRows: 100,
                enableCaching: true,
                cacheTimeout: 300000 // 5 minutes
            },
            
            // Visualization Settings
            visualization: {
                defaultChartType: 'auto',
                chartColors: [
                    '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
                    '#6f42c1', '#20c997', '#fd7e14', '#e83e8c', '#6c757d'
                ],
                chartAnimation: true,
                chartResponsive: true,
                chartLegendPosition: 'top',
                chartTooltip: true,
                chartHeight: 400,
                chartWidth: 600,
                enableZoom: true,
                enablePan: true
            },
            
            // Dashboard Settings
            dashboard: {
                defaultLayout: 'grid',
                maxWidgets: 10,
                enableWidgetResize: true,
                enableWidgetDrag: true,
                autoSaveDashboard: true,
                defaultWidgetSize: {
                    width: 4,
                    height: 3
                },
                gridColumns: 12,
                gridRows: 12,
                widgetMargin: 10
            },
            
            // Export Settings
            export: {
                defaultFormat: 'pdf',
                includeChartsInExport: true,
                includeDataInExport: true,
                includeSummaryInExport: true,
                exportImageQuality: 'high',
                pdfPageSize: 'A4',
                pdfOrientation: 'portrait',
                excelSheetName: 'Processed Data',
                csvDelimiter: ',',
                jsonIndent: 2
            },
            
            // UI Settings
            ui: {
                theme: 'light',
                language: 'en',
                enableTooltips: true,
                enableAnimations: true,
                fontSize: 'medium',
                fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
                borderRadius: '0.375rem',
                boxShadow: '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
                transitionDuration: '0.15s'
            },
            
            // Performance Settings
            performance: {
                enableVirtualization: true,
                maxPreviewRows: 100,
                enableCaching: true,
                cacheTimeout: 300000, // 5 minutes
                debounceDelay: 300,
                throttleDelay: 1000,
                maxConcurrentOperations: 3
            },
            
            // Privacy Settings
            privacy: {
                enableAnalytics: false,
                saveUserPreferences: true,
                clearDataOnExit: false,
                storeFileData: false,
                storeProcessingHistory: false
            }
        };
        
        this.init();
    }
    
    init() {
        this.loadSettings();
        this.setupEventListeners();
    }
    
    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('excel-analyzer-settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.settings = this.mergeSettings(this.defaultSettings, parsed);
            } else {
                this.settings = { ...this.defaultSettings };
            }
        } catch (error) {
            console.warn('Failed to load settings, using defaults:', error);
            this.settings = { ...this.defaultSettings };
        }
    }
    
    /**
     * Save settings to localStorage
     */
    saveSettings() {
        if (this.settings.privacy.saveUserPreferences) {
            localStorage.setItem('excel-analyzer-settings', JSON.stringify(this.settings));
        }
    }
    
    /**
     * Get setting value
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let current = this.settings;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }
    
    /**
     * Set setting value
     */
    set(path, value) {
        const keys = path.split('.');
        let current = this.settings;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
        
        // Save to localStorage
        this.saveSettings();
        
        // Notify change
        this.notifyChange(path, value);
    }
    
    /**
     * Reset settings to defaults
     */
    reset() {
        this.settings = { ...this.defaultSettings };
        this.saveSettings();
        
        // Notify reset
        this.notifyReset();
    }
    
    /**
     * Get all settings
     */
    getAll() {
        return { ...this.settings };
    }
    
    /**
     * Get settings section
     */
    getSection(section) {
        return this.settings[section] || {};
    }
    
    /**
     * Update settings section
     */
    updateSection(section, values) {
        if (!this.settings[section]) {
            this.settings[section] = {};
        }
        
        this.settings[section] = { ...this.settings[section], ...values };
        this.saveSettings();
        
        // Notify change
        this.notifyChange(section, this.settings[section]);
    }
    
    /**
     * Merge settings with defaults
     */
    mergeSettings(defaults, userSettings) {
        const result = { ...defaults };
        
        for (const [key, value] of Object.entries(userSettings)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                result[key] = this.mergeSettings(result[key] || {}, value);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for theme changes
        window.addEventListener('theme:changed', (event) => {
            this.set('ui.theme', event.detail.theme);
        });
    }
    
    /**
     * Notify setting change
     */
    notifyChange(path, value) {
        const event = new CustomEvent('settings:changed', {
            detail: {
                path: path,
                value: value,
                timestamp: Date.now()
            }
        });
        
        window.dispatchEvent(event);
        
        // Call callback if provided
        if (this.options.onSettingChanged) {
            this.options.onSettingChanged(path, value);
        }
    }
    
    /**
     * Notify settings reset
     */
    notifyReset() {
        const event = new CustomEvent('settings:reset', {
            detail: {
                timestamp: Date.now()
            }
        });
        
        window.dispatchEvent(event);
        
        // Call callback if provided
        if (this.options.onSettingsReset) {
            this.options.onSettingsReset();
        }
    }
    
    /**
     * Create settings UI
     */
    createSettingsUI(container) {
        if (!container) return;
        
        const settingsHTML = `
            <div class="settings-container">
                <div class="settings-header">
                    <h4>Application Settings</h4>
                    <div class="settings-actions">
                        <button class="btn btn-outline-secondary btn-sm" id="resetSettingsBtn">
                            <i class="bi bi-arrow-clockwise"></i> Reset to Defaults
                        </button>
                        <button class="btn btn-primary btn-sm" id="saveSettingsBtn">
                            <i class="bi bi-check"></i> Save Settings
                        </button>
                    </div>
                </div>
                
                <div class="settings-tabs">
                    <ul class="nav nav-tabs" id="settingsTabs" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="general-tab" data-bs-toggle="tab" data-bs-target="#general" type="button">General</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="upload-tab" data-bs-toggle="tab" data-bs-target="#upload" type="button">Upload</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="processing-tab" data-bs-toggle="tab" data-bs-target="#processing" type="button">Processing</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="visualization-tab" data-bs-toggle="tab" data-bs-target="#visualization" type="button">Visualization</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="export-tab" data-bs-toggle="tab" data-bs-target="#export" type="button">Export</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="privacy-tab" data-bs-toggle="tab" data-bs-target="#privacy" type="button">Privacy</button>
                        </li>
                    </ul>
                </div>
                
                <div class="tab-content" id="settingsTabContent">
                    ${this.generateGeneralTab()}
                    ${this.generateUploadTab()}
                    ${this.generateProcessingTab()}
                    ${this.generateVisualizationTab()}
                    ${this.generateExportTab()}
                    ${this.generatePrivacyTab()}
                </div>
            </div>
        `;
        
        container.innerHTML = settingsHTML;
        
        // Setup tab interactions
        this.setupSettingsTabs();
        
        // Setup form interactions
        this.setupSettingsForms();
        
        return container;
    }
    
    /**
     * Generate general settings tab
     */
    generateGeneralTab() {
        const theme = this.get('ui.theme');
        const language = this.get('ui.language');
        const fontSize = this.get('ui.fontSize');
        const enableTooltips = this.get('ui.enableTooltips');
        const enableAnimations = this.get('ui.enableAnimations');
        
        return `
            <div class="tab-pane fade show active" id="general" role="tabpanel">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Theme</label>
                            <select class="form-select" id="themeSelect">
                                <option value="light" ${theme === 'light' ? 'selected' : ''}>Light</option>
                                <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark</option>
                                <option value="blue" ${theme === 'blue' ? 'selected' : ''}>Blue</option>
                                <option value="green" ${theme === 'green' ? 'selected' : ''}>Green</option>
                                <option value="purple" ${theme === 'purple' ? 'selected' : ''}>Purple</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Language</label>
                            <select class="form-select" id="languageSelect">
                                <option value="en" ${language === 'en' ? 'selected' : ''}>English</option>
                                <option value="es" ${language === 'es' ? 'selected' : ''}>Español</option>
                                <option value="fr" ${language === 'fr' ? 'selected' : ''}>Français</option>
                                <option value="de" ${language === 'de' ? 'selected' : ''}>Deutsch</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Font Size</label>
                            <select class="form-select" id="fontSizeSelect">
                                <option value="small" ${fontSize === 'small' ? 'selected' : ''}>Small</option>
                                <option value="medium" ${fontSize === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="large" ${fontSize === 'large' ? 'selected' : ''}>Large</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="enableTooltips" ${enableTooltips ? 'checked' : ''}>
                                <label class="form-check-label" for="enableTooltips">
                                    Enable Tooltips
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="enableAnimations" ${enableAnimations ? 'checked' : ''}>
                                <label class="form-check-label" for="enableAnimations">
                                    Enable Animations
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="saveUserPreferences" ${this.get('privacy.saveUserPreferences') ? 'checked' : ''}>
                                <label class="form-check-label" for="saveUserPreferences">
                                    Save User Preferences
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="clearDataOnExit" ${this.get('privacy.clearDataOnExit') ? 'checked' : ''}>
                                <label class="form-check-label" for="clearDataOnExit">
                                    Clear Data on Exit
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate upload settings tab
     */
    generateUploadTab() {
        const maxFileSize = this.get('fileUpload.maxFileSize');
        const enableDragDrop = this.get('fileUpload.enableDragDrop');
        const enableMultiple = this.get('fileUpload.enableMultiple');
        const previewRows = this.get('fileUpload.previewRows');
        
        return `
            <div class="tab-pane fade" id="upload" role="tabpanel">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Max File Size (MB)</label>
                            <input type="number" class="form-control" id="maxFileSize" value="${maxFileSize / (1024 * 1024)}" min="1" max="100">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Preview Rows</label>
                            <input type="number" class="form-control" id="previewRows" value="${previewRows}" min="10" max="1000">
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="enableDragDrop" ${enableDragDrop ? 'checked' : ''}>
                                <label class="form-check-label" for="enableDragDrop">
                                    Enable Drag & Drop
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="enableMultiple" ${enableMultiple ? 'checked' : ''}>
                                <label class="form-check-label" for="enableMultiple">
                                    Enable Multiple Files
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate processing settings tab
     */
    generateProcessingTab() {
        const autoDetectDataTypes = this.get('dataProcessing.autoDetectDataTypes');
        const enableDataValidation = this.get('dataProcessing.enableDataValidation');
        const enableCaching = this.get('dataProcessing.enableCaching');
        const maxPreviewRows = this.get('dataProcessing.maxPreviewRows');
        const outlierThreshold = this.get('dataProcessing.outlierThreshold');
        
        return `
            <div class="tab-pane fade" id="processing" role="tabpanel">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Outlier Threshold</label>
                            <input type="number" class="form-control" id="outlierThreshold" value="${outlierThreshold}" min="1" max="10">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Max Preview Rows</label>
                            <input type="number" class="form-control" id="maxPreviewRows" value="${maxPreviewRows}" min="10" max="1000">
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="autoDetectDataTypes" ${autoDetectDataTypes ? 'checked' : ''}>
                                <label class="form-check-label" for="autoDetectDataTypes">
                                    Auto-detect Data Types
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="enableDataValidation" ${enableDataValidation ? 'checked' : ''}>
                                <label class="form-check-label" for="enableDataValidation">
                                    Enable Data Validation
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="enableCaching" ${enableCaching ? 'checked' : ''}>
                                <label class="form-check-label" for="enableCaching">
                                    Enable Caching
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate visualization settings tab
     */
    generateVisualizationTab() {
        const defaultChartType = this.get('visualization.defaultChartType');
        const chartAnimation = this.get('visualization.chartAnimation');
        const chartResponsive = this.get('visualization.chartResponsive');
        const chartTooltip = this.get('visualization.chartTooltip');
        const enableZoom = this.get('visualization.enableZoom');
        const enablePan = this.get('visualization.enablePan');
        
        return `
            <div class="tab-pane fade" id="visualization" role="tabpanel">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Default Chart Type</label>
                            <select class="form-select" id="defaultChartType">
                                <option value="auto" ${defaultChartType === 'auto' ? 'selected' : ''}>Auto</option>
                                <option value="bar" ${defaultChartType === 'bar' ? 'selected' : ''}>Bar</option>
                                <option value="line" ${defaultChartType === 'line' ? 'selected' : ''}>Line</option>
                                <option value="pie" ${defaultChartType === 'pie' ? 'selected' : ''}>Pie</option>
                                <option value="scatter" ${defaultChartType === 'scatter' ? 'selected' : ''}>Scatter</option>
                                <option value="doughnut" ${defaultChartType === 'doughnut' ? 'selected' : ''}>Doughnut</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Chart Height</label>
                            <input type="number" class="form-control" id="chartHeight" value="${this.get('visualization.chartHeight')}" min="200" max="800">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Chart Width</label>
                            <input type="number" class="form-control" id="chartWidth" value="${this.get('visualization.chartWidth')}" min="400" max="1200">
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="chartAnimation" ${chartAnimation ? 'checked' : ''}>
                                <label class="form-check-label" for="chartAnimation">
                                    Enable Chart Animation
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="chartResponsive" ${chartResponsive ? 'checked' : ''}>
                                <label class="form-check-label" for="chartResponsive">
                                    Enable Responsive Charts
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="chartTooltip" ${chartTooltip ? 'checked' : ''}>
                                <label class="form-check-label" for="chartTooltip">
                                    Enable Chart Tooltips
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="enableZoom" ${enableZoom ? 'checked' : ''}>
                                <label class="form-check-label" for="enableZoom">
                                    Enable Chart Zoom
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="enablePan" ${enablePan ? 'checked' : ''}>
                                <label class="form-check-label" for="enablePan">
                                    Enable Chart Pan
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate export settings tab
     */
    generateExportTab() {
        const defaultFormat = this.get('export.defaultFormat');
        const includeChartsInExport = this.get('export.includeChartsInExport');
        const includeDataInExport = this.get('export.includeDataInExport');
        const includeSummaryInExport = this.get('export.includeSummaryInExport');
        const exportImageQuality = this.get('export.exportImageQuality');
        
        return `
            <div class="tab-pane fade" id="export" role="tabpanel">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Default Export Format</label>
                            <select class="form-select" id="defaultExportFormat">
                                <option value="pdf" ${defaultFormat === 'pdf' ? 'selected' : ''}>PDF</option>
                                <option value="excel" ${defaultFormat === 'excel' ? 'selected' : ''}>Excel</option>
                                <option value="csv" ${defaultFormat === 'csv' ? 'selected' : ''}>CSV</option>
                                <option value="json" ${defaultFormat === 'json' ? 'selected' : ''}>JSON</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Export Image Quality</label>
                            <select class="form-select" id="exportImageQuality">
                                <option value="low" ${exportImageQuality === 'low' ? 'selected' : ''}>Low</option>
                                <option value="medium" ${exportImageQuality === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="high" ${exportImageQuality === 'high' ? 'selected' : ''}>High</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="includeChartsInExport" ${includeChartsInExport ? 'checked' : ''}>
                                <label class="form-check-label" for="includeChartsInExport">
                                    Include Charts in Export
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="includeDataInExport" ${includeDataInExport ? 'checked' : ''}>
                                <label class="form-check-label" for="includeDataInExport">
                                    Include Data in Export
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="includeSummaryInExport" ${includeSummaryInExport ? 'checked' : ''}>
                                <label class="form-check-label" for="includeSummaryInExport">
                                    Include Summary in Export
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate privacy settings tab
     */
    generatePrivacyTab() {
        const enableAnalytics = this.get('privacy.enableAnalytics');
        const saveUserPreferences = this.get('privacy.saveUserPreferences');
        const clearDataOnExit = this.get('privacy.clearDataOnExit');
        const storeFileData = this.get('privacy.storeFileData');
        const storeProcessingHistory = this.get('privacy.storeProcessingHistory');
        
        return `
            <div class="tab-pane fade" id="privacy" role="tabpanel">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="enableAnalytics" ${enableAnalytics ? 'checked' : ''}>
                                <label class="form-check-label" for="enableAnalytics">
                                    Enable Analytics
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="saveUserPreferences" ${saveUserPreferences ? 'checked' : ''}>
                                <label class="form-check-label" for="saveUserPreferences">
                                    Save User Preferences
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="clearDataOnExit" ${clearDataOnExit ? 'checked' : ''}>
                                <label class="form-check-label" for="clearDataOnExit">
                                    Clear Data on Exit
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="storeFileData" ${storeFileData ? 'checked' : ''}>
                                <label class="form-check-label" for="storeFileData">
                                    Store File Data
                                </label>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="storeProcessingHistory" ${storeProcessingHistory ? 'checked' : ''}>
                                <label class="form-check-label" for="storeProcessingHistory">
                                    Store Processing History
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="alert alert-warning">
                    <h6>Privacy Notice</h6>
                    <p>These settings control how your data is stored and processed. Disabling certain features may affect application functionality.</p>
                </div>
            </div>
        `;
    }
    
    /**
     * Setup settings tabs
     */
    setupSettingsTabs() {
        const tabs = document.querySelectorAll('.nav-link');
        tabs.forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                // Handle tab-specific logic if needed
            });
        });
    }
    
    /**
     * Setup settings forms
     */
    setupSettingsForms() {
        // General settings
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.set('ui.theme', e.target.value);
                if (this.options.themeManager) {
                    this.options.themeManager.setTheme(e.target.value);
                }
            });
        }
        
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => {
                this.set('ui.language', e.target.value);
            });
        }
        
        const fontSizeSelect = document.getElementById('fontSizeSelect');
        if (fontSizeSelect) {
            fontSizeSelect.addEventListener('change', (e) => {
                this.set('ui.fontSize', e.target.value);
            });
        }
        
        // Boolean settings
        const booleanSettings = [
            { id: 'enableTooltips', path: 'ui.enableTooltips' },
            { id: 'enableAnimations', path: 'ui.enableAnimations' },
            { id: 'enableDragDrop', path: 'fileUpload.enableDragDrop' },
            { id: 'enableMultiple', path: 'fileUpload.enableMultiple' },
            { id: 'autoDetectDataTypes', path: 'dataProcessing.autoDetectDataTypes' },
            { id: 'enableDataValidation', path: 'dataProcessing.enableDataValidation' },
            { id: 'enableCaching', path: 'dataProcessing.enableCaching' },
            { id: 'chartAnimation', path: 'visualization.chartAnimation' },
            { id: 'chartResponsive', path: 'visualization.chartResponsive' },
            { id: 'chartTooltip', path: 'visualization.chartTooltip' },
            { id: 'enableZoom', path: 'visualization.enableZoom' },
            { id: 'enablePan', path: 'visualization.enablePan' },
            { id: 'includeChartsInExport', path: 'export.includeChartsInExport' },
            { id: 'includeDataInExport', path: 'export.includeDataInExport' },
            { id: 'includeSummaryInExport', path: 'export.includeSummaryInExport' },
            { id: 'enableAnalytics', path: 'privacy.enableAnalytics' },
            { id: 'saveUserPreferences', path: 'privacy.saveUserPreferences' },
            { id: 'clearDataOnExit', path: 'privacy.clearDataOnExit' },
            { id: 'storeFileData', path: 'privacy.storeFileData' },
            { id: 'storeProcessingHistory', path: 'privacy.storeProcessingHistory' }
        ];
        
        booleanSettings.forEach(setting => {
            const element = document.getElementById(setting.id);
            if (element) {
                element.addEventListener('change', (e) => {
                    this.set(setting.path, e.target.checked);
                });
            }
        });
        
        // Number settings
        const numberSettings = [
            { id: 'maxFileSize', path: 'fileUpload.maxFileSize', multiplier: 1024 * 1024 },
            { id: 'previewRows', path: 'fileUpload.previewRows' },
            { id: 'outlierThreshold', path: 'dataProcessing.outlierThreshold' },
            { id: 'maxPreviewRows', path: 'dataProcessing.maxPreviewRows' },
            { id: 'chartHeight', path: 'visualization.chartHeight' },
            { id: 'chartWidth', path: 'visualization.chartWidth' }
        ];
        
        numberSettings.forEach(setting => {
            const element = document.getElementById(setting.id);
            if (element) {
                element.addEventListener('change', (e) => {
                    let value = parseInt(e.target.value);
                    if (setting.multiplier) {
                        value = value * setting.multiplier;
                    }
                    this.set(setting.path, value);
                });
            }
        });
        
        // Select settings
        const selectSettings = [
            { id: 'defaultChartType', path: 'visualization.defaultChartType' },
            { id: 'defaultExportFormat', path: 'export.defaultFormat' },
            { id: 'exportImageQuality', path: 'export.exportImageQuality' }
        ];
        
        selectSettings.forEach(setting => {
            const element = document.getElementById(setting.id);
            if (element) {
                element.addEventListener('change', (e) => {
                    this.set(setting.path, e.target.value);
                });
            }
        });
        
        // Reset and save buttons
        const resetBtn = document.getElementById('resetSettingsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset all settings to defaults?')) {
                    this.reset();
                    this.updateSettingsUI();
                }
            });
        }
        
        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
                alert('Settings saved successfully!');
            });
        }
    }
    
    /**
     * Update settings UI with current values
     */
    updateSettingsUI() {
        // This would update all form elements with current setting values
        // Implementation would depend on the specific UI structure
    }
    
    /**
     * Export settings
     */
    exportSettings() {
        const settingsData = {
            settings: this.getAll(),
            exportedAt: new Date().toISOString(),
            version: '1.0.0'
        };
        
        return JSON.stringify(settingsData, null, 2);
    }
    
    /**
     * Import settings
     */
    importSettings(settingsData) {
        try {
            const parsed = typeof settingsData === 'string' ? JSON.parse(settingsData) : settingsData;
            if (parsed.settings) {
                this.settings = this.mergeSettings(this.defaultSettings, parsed.settings);
                this.saveSettings();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to import settings:', error);
            return false;
        }
    }
    
    /**
     * Get settings statistics
     */
    getSettingsStats() {
        return {
            totalSettings: Object.keys(this.settings).length,
            sections: Object.keys(this.settings),
            lastModified: localStorage.getItem('excel-analyzer-settings') ? 
                new Date(JSON.parse(localStorage.getItem('excel-analyzer-settings')).timestamp || Date.now()).toISOString() : 
                'Never'
        };
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Settings;
} else {
    window.Settings = Settings;
}