/**
 * Default Values of Web Application
 * 
 * Default configuration values and presets for the Excel Analyzer application.
 */

class DefaultValues {
    constructor() {
        this.defaults = {
            // Application Defaults
            app: {
                name: 'Excel Analyzer',
                version: '1.0.0',
                theme: 'light',
                language: 'en',
                maxFileSize: 50 * 1024 * 1024, // 50MB
                maxRows: 10000,
                maxColumns: 100
            },
            
            // File Upload Defaults
            fileUpload: {
                allowedTypes: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'
                ],
                maxFileSize: 50 * 1024 * 1024,
                enableDragDrop: true,
                enableMultiple: false,
                previewRows: 100
            },
            
            // Data Processing Defaults
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
            
            // Visualization Defaults
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
            
            // Dashboard Defaults
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
            
            // Export Defaults
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
            
            // UI Defaults
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
            
            // Performance Defaults
            performance: {
                enableVirtualization: true,
                maxPreviewRows: 100,
                enableCaching: true,
                cacheTimeout: 300000, // 5 minutes
                debounceDelay: 300,
                throttleDelay: 1000,
                maxConcurrentOperations: 3
            },
            
            // Privacy Defaults
            privacy: {
                enableAnalytics: false,
                saveUserPreferences: true,
                clearDataOnExit: false,
                storeFileData: false,
                storeProcessingHistory: false
            }
        };
    }
    
    /**
     * Get default value by path
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let current = this.defaults;
        
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
     * Get all defaults
     */
    getAll() {
        return { ...this.defaults };
    }
    
    /**
     * Get application defaults
     */
    getAppDefaults() {
        return { ...this.defaults.app };
    }
    
    /**
     * Get file upload defaults
     */
    getFileUploadDefaults() {
        return { ...this.defaults.fileUpload };
    }
    
    /**
     * Get data processing defaults
     */
    getDataProcessingDefaults() {
        return { ...this.defaults.dataProcessing };
    }
    
    /**
     * Get visualization defaults
     */
    getVisualizationDefaults() {
        return { ...this.defaults.visualization };
    }
    
    /**
     * Get dashboard defaults
     */
    getDashboardDefaults() {
        return { ...this.defaults.dashboard };
    }
    
    /**
     * Get export defaults
     */
    getExportDefaults() {
        return { ...this.defaults.export };
    }
    
    /**
     * Get UI defaults
     */
    getUIDefaults() {
        return { ...this.defaults.ui };
    }
    
    /**
     * Get performance defaults
     */
    getPerformanceDefaults() {
        return { ...this.defaults.performance };
    }
    
    /**
     * Get privacy defaults
     */
    getPrivacyDefaults() {
        return { ...this.defaults.privacy };
    }
    
    /**
     * Get chart color presets
     */
    getChartColorPresets() {
        return {
            primary: ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8'],
            pastel: ['#a8d8f0', '#b8e6b8', '#ffd1d1', '#fff7b3', '#b3e6ff'],
            vibrant: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
            monochrome: ['#333333', '#666666', '#999999', '#cccccc', '#ffffff'],
            autumn: ['#d35400', '#e67e22', '#f1c40f', '#f39c12', '#e74c3c']
        };
    }
    
    /**
     * Get chart type presets
     */
    getChartTypePresets() {
        return {
            auto: 'Automatic selection based on data',
            bar: 'Bar chart for categorical data',
            line: 'Line chart for time series data',
            pie: 'Pie chart for proportional data',
            scatter: 'Scatter plot for correlation analysis',
            doughnut: 'Doughnut chart for proportional data',
            area: 'Area chart for cumulative data',
            radar: 'Radar chart for multi-dimensional data'
        };
    }
    
    /**
     * Get dashboard layout presets
     */
    getDashboardLayoutPresets() {
        return {
            grid: {
                name: 'Grid Layout',
                description: 'Responsive grid-based layout',
                columns: 12,
                rows: 12,
                margin: 10,
                autoResize: true
            },
            vertical: {
                name: 'Vertical Layout',
                description: 'Stacked widgets vertically',
                columns: 1,
                rows: 20,
                margin: 15,
                autoResize: false
            },
            horizontal: {
                name: 'Horizontal Layout',
                description: 'Side-by-side widgets',
                columns: 20,
                rows: 6,
                margin: 10,
                autoResize: false
            }
        };
    }
    
    /**
     * Get export format presets
     */
    getExportFormatPresets() {
        return {
            pdf: {
                name: 'PDF Report',
                description: 'Professional PDF with charts and analysis',
                extension: '.pdf',
                includeCharts: true,
                includeData: true,
                includeSummary: true
            },
            excel: {
                name: 'Excel File',
                description: 'Processed data in Excel format',
                extension: '.xlsx',
                includeCharts: false,
                includeData: true,
                includeSummary: false
            },
            csv: {
                name: 'CSV File',
                description: 'Comma-separated values',
                extension: '.csv',
                includeCharts: false,
                includeData: true,
                includeSummary: false
            },
            json: {
                name: 'JSON File',
                description: 'Structured data in JSON format',
                extension: '.json',
                includeCharts: false,
                includeData: true,
                includeSummary: true
            }
        };
    }
    
    /**
     * Get theme presets
     */
    getThemePresets() {
        return {
            light: {
                name: 'Light Theme',
                description: 'Clean and bright interface',
                colors: {
                    primary: '#007bff',
                    secondary: '#6c757d',
                    success: '#28a745',
                    danger: '#dc3545',
                    warning: '#ffc107',
                    info: '#17a2b8',
                    light: '#f8f9fa',
                    dark: '#343a40'
                },
                background: '#ffffff',
                text: '#212529'
            },
            dark: {
                name: 'Dark Theme',
                description: 'Dark interface for reduced eye strain',
                colors: {
                    primary: '#4dabf7',
                    secondary: '#66d9ef',
                    success: '#51cf66',
                    danger: '#ff6b6b',
                    warning: '#ffd43b',
                    info: '#22d3ee',
                    light: '#121212',
                    dark: '#ffffff'
                },
                background: '#121212',
                text: '#ffffff'
            },
            blue: {
                name: 'Blue Theme',
                description: 'Professional blue color scheme',
                colors: {
                    primary: '#1976d2',
                    secondary: '#424242',
                    success: '#2e7d32',
                    danger: '#c62828',
                    warning: '#ef6c00',
                    info: '#0277bd',
                    light: '#e3f2fd',
                    dark: '#212121'
                },
                background: '#ffffff',
                text: '#212121'
            }
        };
    }
    
    /**
     * Get data type detection rules
     */
    getDataTypeDetectionRules() {
        return {
            date: {
                patterns: [
                    /^\d{4}-\d{2}-\d{2}$/,
                    /^\d{2}\/\d{2}\/\d{4}$/,
                    /^\d{2}-\d{2}-\d{4}$/,
                    /^\d{4}\/\d{2}\/\d{2}$/
                ],
                validators: [
                    (value) => !isNaN(Date.parse(value))
                ]
            },
            time: {
                patterns: [
                    /^\d{2}:\d{2}:\d{2}$/,
                    /^\d{2}:\d{2}$/
                ],
                validators: [
                    (value) => {
                        const time = value.split(':');
                        return time.length >= 2 && 
                               parseInt(time[0]) >= 0 && parseInt(time[0]) <= 23 &&
                               parseInt(time[1]) >= 0 && parseInt(time[1]) <= 59;
                    }
                ]
            },
            numeric: {
                patterns: [
                    /^-?\d+\.?\d*$/
                ],
                validators: [
                    (value) => !isNaN(parseFloat(value)) && isFinite(value)
                ]
            },
            boolean: {
                patterns: [
                    /^(true|false|yes|no|1|0)$/i
                ],
                validators: [
                    (value) => ['true', 'false', 'yes', 'no', '1', '0'].includes(value.toLowerCase())
                ]
            }
        };
    }
    
    /**
     * Get processing strategies
     */
    getProcessingStrategies() {
        return {
            missingValues: {
                remove: 'Remove rows with missing values',
                mean: 'Fill with mean (numeric only)',
                median: 'Fill with median (numeric only)',
                mode: 'Fill with most frequent value',
                forwardFill: 'Forward fill from previous value',
                backwardFill: 'Backward fill from next value',
                custom: 'Use custom value'
            },
            outliers: {
                remove: 'Remove outlier values',
                cap: 'Cap to threshold values',
                mean: 'Replace with mean',
                median: 'Replace with median',
                ignore: 'Keep outliers as-is'
            }
        };
    }
    
    /**
     * Get validation rules
     */
    getValidationRules() {
        return {
            file: {
                maxSize: 50 * 1024 * 1024, // 50MB
                allowedTypes: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'
                ],
                maxRows: 10000,
                maxColumns: 100
            },
            data: {
                maxPreviewRows: 100,
                maxCells: 1000000,
                maxStringLength: 10000
            },
            charts: {
                maxDataPoints: 1000,
                maxSeries: 10,
                maxLabels: 50
            },
            dashboard: {
                maxWidgets: 20,
                minWidgetSize: { width: 2, height: 2 },
                maxWidgetSize: { width: 12, height: 12 }
            }
        };
    }
    
    /**
     * Get performance thresholds
     */
    getPerformanceThresholds() {
        return {
            fileProcessing: {
                small: 1000,    // rows
                medium: 10000,  // rows
                large: 50000    // rows
            },
            chartRendering: {
                fast: 100,      // data points
                medium: 1000,   // data points
                slow: 10000     // data points
            },
            memoryUsage: {
                low: 50 * 1024 * 1024,    // 50MB
                medium: 100 * 1024 * 1024, // 100MB
                high: 500 * 1024 * 1024   // 500MB
            }
        };
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DefaultValues;
} else {
    window.DefaultValues = DefaultValues;
}