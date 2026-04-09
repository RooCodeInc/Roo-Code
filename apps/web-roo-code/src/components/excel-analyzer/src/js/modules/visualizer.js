/**
 * Visualization Module
 * 
 * Handles chart rendering, interactive visualizations, and chart management.
 */

class Visualizer {
    constructor(options = {}) {
        this.options = options;
        this.charts = new Map();
        this.currentChart = null;
        this.chartContainer = null;
        this.chartCanvas = null;
        
        this.init();
    }
    
    init() {
        this.chartContainer = document.getElementById('analysisChart');
        if (!this.chartContainer) {
            throw new Error('Chart container not found');
        }
        
        this.setupChartContainer();
    }
    
    setupChartContainer() {
        // Ensure canvas is properly sized
        this.chartContainer.style.width = '100%';
        this.chartContainer.style.height = '400px';
        
        // Setup responsive behavior
        this.setupResponsiveChart();
    }
    
    /**
     * Render chart
     */
    async renderChart(data, config = {}) {
        try {
            // Determine chart type
            const chartType = this.selectChartType(data, config);
            
            // Prepare chart data
            const chartData = this.prepareChartData(data, chartType, config);
            
            // Prepare chart options
            const chartOptions = this.prepareChartOptions(chartType, config);
            
            // Create chart
            const chart = await this.createChart(chartType, chartData, chartOptions);
            
            // Store chart
            this.charts.set(chart.id, chart);
            this.currentChart = chart;
            
            // Notify completion
            if (this.options.onChartRendered) {
                this.options.onChartRendered(chart);
            }
            
            return chart;
            
        } catch (error) {
            console.error('Chart rendering failed:', error);
            if (this.options.onError) {
                this.options.onError(error);
            }
            throw error;
        }
    }
    
    /**
     * Update existing chart
     */
    async updateChart(chartId, newData, config = {}) {
        try {
            const chart = this.charts.get(chartId);
            if (!chart) {
                throw new Error('Chart not found');
            }
            
            // Update chart data
            const chartData = this.prepareChartData(newData, chart.config.type, config);
            chart.data = chartData;
            
            // Update chart options if provided
            if (Object.keys(config).length > 0) {
                const chartOptions = this.prepareChartOptions(chart.config.type, config);
                chart.options = { ...chart.options, ...chartOptions };
            }
            
            // Update chart
            chart.update();
            
            // Notify update
            if (this.options.onChartUpdated) {
                this.options.onChartUpdated(chart);
            }
            
            return chart;
            
        } catch (error) {
            console.error('Chart update failed:', error);
            if (this.options.onError) {
                this.options.onError(error);
            }
            throw error;
        }
    }
    
    /**
     * Select chart type based on data
     */
    selectChartType(data, config = {}) {
        // If explicitly specified, use that
        if (config.type && config.type !== 'auto') {
            return config.type;
        }
        
        if (!data || data.length === 0) {
            return 'bar';
        }
        
        const headers = Object.keys(data[0]);
        const numericColumns = this.getNumericColumns(data);
        const categoricalColumns = this.getCategoricalColumns(data);
        
        // Auto-select based on data characteristics
        if (numericColumns.length >= 2 && categoricalColumns.length === 0) {
            // Multiple numeric columns - scatter plot or line chart
            return 'scatter';
        } else if (numericColumns.length === 1 && categoricalColumns.length >= 1) {
            // One numeric, multiple categorical - bar chart
            return 'bar';
        } else if (numericColumns.length === 1 && categoricalColumns.length === 0) {
            // Single numeric - pie chart for proportions
            return 'pie';
        } else {
            // Default to bar chart
            return 'bar';
        }
    }
    
    /**
     * Prepare chart data
     */
    prepareChartData(data, chartType, config = {}) {
        const xColumn = config.xAxis || this.getDefaultXAxis(data, chartType);
        const yColumn = config.yAxis || this.getDefaultYAxis(data, chartType);
        
        if (chartType === 'pie' || chartType === 'doughnut') {
            return this.preparePieChartData(data, yColumn);
        } else if (chartType === 'scatter') {
            return this.prepareScatterChartData(data, xColumn, yColumn);
        } else {
            return this.prepareStandardChartData(data, xColumn, yColumn);
        }
    }
    
    /**
     * Prepare pie chart data
     */
    preparePieChartData(data, valueColumn) {
        const labels = data.map(row => row[valueColumn]);
        const values = data.map(row => parseFloat(row[valueColumn]) || 0);
        
        return {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: this.generateColors(values.length),
                borderWidth: 1
            }]
        };
    }
    
    /**
     * Prepare scatter chart data
     */
    prepareScatterChartData(data, xColumn, yColumn) {
        const points = data.map(row => ({
            x: parseFloat(row[xColumn]) || 0,
            y: parseFloat(row[yColumn]) || 0
        }));
        
        return {
            datasets: [{
                label: `${xColumn} vs ${yColumn}`,
                data: points,
                backgroundColor: this.generateColors(points.length),
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        };
    }
    
    /**
     * Prepare standard chart data (bar, line, etc.)
     */
    prepareStandardChartData(data, xColumn, yColumn) {
        const labels = data.map(row => row[xColumn]);
        const values = data.map(row => parseFloat(row[yColumn]) || 0);
        
        return {
            labels: labels,
            datasets: [{
                label: yColumn,
                data: values,
                backgroundColor: this.generateColors(values.length),
                borderColor: this.generateColors(values.length, 0.8),
                borderWidth: 2,
                fill: false
            }]
        };
    }
    
    /**
     * Prepare chart options
     */
    prepareChartOptions(chartType, config = {}) {
        const theme = this.getCurrentTheme();
        const colors = this.getThemeColors(theme);
        
        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    position: config.legendPosition || 'top',
                    labels: {
                        color: colors.text,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: colors.bgSecondary,
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    borderColor: colors.border,
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: {
                        color: colors.border
                    },
                    ticks: {
                        color: colors.text
                    }
                },
                y: {
                    grid: {
                        color: colors.border
                    },
                    ticks: {
                        color: colors.text
                    }
                }
            }
        };
        
        // Chart-specific options
        switch (chartType) {
            case 'bar':
                return {
                    ...baseOptions,
                    indexAxis: config.horizontal ? 'y' : 'x',
                    scales: {
                        ...baseOptions.scales,
                        x: {
                            ...baseOptions.scales.x,
                            beginAtZero: true
                        },
                        y: {
                            ...baseOptions.scales.y,
                            beginAtZero: true
                        }
                    }
                };
                
            case 'line':
                return {
                    ...baseOptions,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
                };
                
            case 'pie':
            case 'doughnut':
                return {
                    ...baseOptions,
                    cutout: chartType === 'doughnut' ? '50%' : '0%',
                    plugins: {
                        ...baseOptions.plugins,
                        legend: {
                            ...baseOptions.plugins.legend,
                            position: 'bottom'
                        }
                    }
                };
                
            case 'scatter':
                return {
                    ...baseOptions,
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                            grid: {
                                color: colors.border
                            },
                            ticks: {
                                color: colors.text
                            }
                        },
                        y: {
                            type: 'linear',
                            grid: {
                                color: colors.border
                            },
                            ticks: {
                                color: colors.text
                            }
                        }
                    }
                };
                
            default:
                return baseOptions;
        }
    }
    
    /**
     * Create chart instance
     */
    async createChart(chartType, data, options) {
        // Destroy existing chart if any
        if (this.currentChart) {
            this.currentChart.destroy();
        }
        
        // Create new chart
        const chart = new Chart(this.chartContainer, {
            type: chartType,
            data: data,
            options: options
        });
        
        return chart;
    }
    
    /**
     * Resize charts for responsiveness
     */
    resizeCharts() {
        this.charts.forEach(chart => {
            if (chart && chart.resize) {
                chart.resize();
            }
        });
    }
    
    /**
     * Update chart theme
     */
    updateTheme(theme) {
        this.charts.forEach(chart => {
            if (chart) {
                const colors = this.getThemeColors(theme);
                chart.options.plugins.legend.labels.color = colors.text;
                chart.options.plugins.tooltip.backgroundColor = colors.bgSecondary;
                chart.options.plugins.tooltip.titleColor = colors.text;
                chart.options.plugins.tooltip.bodyColor = colors.text;
                chart.options.plugins.tooltip.borderColor = colors.border;
                chart.options.scales.x.grid.color = colors.border;
                chart.options.scales.x.ticks.color = colors.text;
                chart.options.scales.y.grid.color = colors.border;
                chart.options.scales.y.ticks.color = colors.text;
                chart.update();
            }
        });
    }
    
    /**
     * Export chart as image
     */
    exportChart(chartId, format = 'png') {
        const chart = this.charts.get(chartId);
        if (!chart) {
            throw new Error('Chart not found');
        }
        
        const dataURL = chart.toBase64Image(format, 1.0);
        return dataURL;
    }
    
    /**
     * Get chart statistics
     */
    getChartStatistics(chartId) {
        const chart = this.charts.get(chartId);
        if (!chart) {
            return null;
        }
        
        const data = chart.data.datasets[0].data;
        const stats = {
            min: Math.min(...data),
            max: Math.max(...data),
            mean: data.reduce((sum, val) => sum + val, 0) / data.length,
            count: data.length
        };
        
        return stats;
    }
    
    /**
     * Get numeric columns from data
     */
    getNumericColumns(data) {
        if (!data || data.length === 0) return [];
        
        const headers = Object.keys(data[0]);
        return headers.filter(header => {
            const values = data.map(row => row[header]);
            return values.every(val => !isNaN(parseFloat(val)));
        });
    }
    
    /**
     * Get categorical columns from data
     */
    getCategoricalColumns(data) {
        if (!data || data.length === 0) return [];
        
        const headers = Object.keys(data[0]);
        return headers.filter(header => {
            const values = data.map(row => row[header]);
            return values.some(val => isNaN(parseFloat(val)));
        });
    }
    
    /**
     * Get default X axis for chart type
     */
    getDefaultXAxis(data, chartType) {
        const headers = Object.keys(data[0]);
        
        // For scatter plots, prefer numeric columns
        if (chartType === 'scatter') {
            const numericColumns = this.getNumericColumns(data);
            return numericColumns.length > 0 ? numericColumns[0] : headers[0];
        }
        
        // For other charts, prefer categorical columns
        const categoricalColumns = this.getCategoricalColumns(data);
        return categoricalColumns.length > 0 ? categoricalColumns[0] : headers[0];
    }
    
    /**
     * Get default Y axis for chart type
     */
    getDefaultYAxis(data, chartType) {
        const headers = Object.keys(data[0]);
        
        // Prefer numeric columns for Y axis
        const numericColumns = this.getNumericColumns(data);
        return numericColumns.length > 0 ? numericColumns[0] : headers[0];
    }
    
    /**
     * Generate colors for chart
     */
    generateColors(count, alpha = 1.0) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const hue = (i * 137.508) % 360; // Golden angle
            colors.push(this.hslToHex(hue, 70, 50));
        }
        return colors;
    }
    
    /**
     * Convert HSL to Hex
     */
    hslToHex(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }
    
    /**
     * Get theme colors
     */
    getThemeColors(theme) {
        // Get colors from CSS custom properties
        const root = document.documentElement;
        return {
            primary: getComputedStyle(root).getPropertyValue('--primary-color').trim(),
            secondary: getComputedStyle(root).getPropertyValue('--secondary-color').trim(),
            success: getComputedStyle(root).getPropertyValue('--success-color').trim(),
            danger: getComputedStyle(root).getPropertyValue('--danger-color').trim(),
            warning: getComputedStyle(root).getPropertyValue('--warning-color').trim(),
            info: getComputedStyle(root).getPropertyValue('--info-color').trim(),
            text: getComputedStyle(root).getPropertyValue('--text-primary').trim(),
            bgSecondary: getComputedStyle(root).getPropertyValue('--bg-secondary').trim(),
            border: getComputedStyle(root).getPropertyValue('--border-color').trim()
        };
    }
    
    /**
     * Get current theme
     */
    getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }
    
    /**
     * Clear all charts
     */
    clearCharts() {
        this.charts.forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        this.charts.clear();
        this.currentChart = null;
    }
    
    /**
     * Get chart by ID
     */
    getChart(chartId) {
        return this.charts.get(chartId);
    }
    
    /**
     * Get all charts
     */
    getAllCharts() {
        return Array.from(this.charts.values());
    }
    
    /**
     * Remove chart
     */
    removeChart(chartId) {
        const chart = this.charts.get(chartId);
        if (chart) {
            chart.destroy();
            this.charts.delete(chartId);
            if (this.currentChart && this.currentChart.id === chartId) {
                this.currentChart = null;
            }
        }
    }
    
    /**
     * Setup responsive chart behavior
     */
    setupResponsiveChart() {
        // Chart.js handles responsiveness automatically with responsive: true
        // But we can add additional responsive behavior here if needed
        window.addEventListener('resize', () => {
            this.resizeCharts();
        });
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Visualizer;
} else {
    window.Visualizer = Visualizer;
}