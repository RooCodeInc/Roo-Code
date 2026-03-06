/**
 * Analytics Module of Web Application
 * 
 * Handles data analysis, statistical calculations, and insights generation.
 */

class Analytics {
    constructor(options = {}) {
        this.options = options;
        this.analysisCache = new Map();
        this.maxCacheSize = 100;
    }
    
    /**
     * Analyze data structure
     */
    analyzeDataStructure(data) {
        if (!data || data.length === 0) {
            return {
                columns: [],
                rowCount: 0,
                columnCount: 0,
                dataTypes: {},
                missingValues: {},
                uniqueValues: {},
                statistics: {}
            };
        }
        
        const headers = Object.keys(data[0]);
        const rowCount = data.length;
        const columnCount = headers.length;
        
        // Analyze each column
        const columns = headers.map(header => {
            const values = data.map(row => row[header]);
            const dataType = this.detectDataType(values);
            const missingCount = this.countMissingValues(values);
            const uniqueCount = this.countUniqueValues(values);
            
            return {
                name: header,
                type: dataType,
                missingCount: missingCount,
                uniqueValues: uniqueCount,
                sampleValues: values.slice(0, 5)
            };
        });
        
        // Calculate statistics for numeric columns
        const statistics = this.calculateStatistics(data, headers);
        
        return {
            columns: columns,
            rowCount: rowCount,
            columnCount: columnCount,
            dataTypes: this.getColumnDataTypes(columns),
            missingValues: this.getMissingValuesSummary(columns),
            uniqueValues: this.getUniqueValuesSummary(columns),
            statistics: statistics
        };
    }
    
    /**
     * Detect data type for a column
     */
    detectDataType(values) {
        if (values.length === 0) return 'empty';
        
        // Remove null/undefined values for analysis
        const cleanValues = values.filter(v => v !== null && v !== undefined && v !== '');
        
        if (cleanValues.length === 0) return 'empty';
        
        // Check for date patterns
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/,
            /^\d{2}\/\d{2}\/\d{4}$/,
            /^\d{2}-\d{2}-\d{4}$/,
            /^\d{4}\/\d{2}\/\d{2}$/
        ];
        
        let dateCount = 0;
        let numericCount = 0;
        let booleanCount = 0;
        
        for (const value of cleanValues) {
            const strValue = String(value).trim();
            
            // Check for date patterns
            if (datePatterns.some(pattern => pattern.test(strValue))) {
                if (!isNaN(Date.parse(strValue))) {
                    dateCount++;
                    continue;
                }
            }
            
            // Check for numeric values
            if (!isNaN(parseFloat(strValue)) && isFinite(strValue)) {
                numericCount++;
                continue;
            }
            
            // Check for boolean values
            if (['true', 'false', 'yes', 'no', '1', '0'].includes(strValue.toLowerCase())) {
                booleanCount++;
                continue;
            }
        }
        
        // Determine type based on majority
        const total = cleanValues.length;
        const dateRatio = dateCount / total;
        const numericRatio = numericCount / total;
        const booleanRatio = booleanCount / total;
        
        if (dateRatio > 0.8) return 'date';
        if (numericRatio > 0.8) return 'numeric';
        if (booleanRatio > 0.8) return 'boolean';
        
        return 'categorical';
    }
    
    /**
     * Count missing values
     */
    countMissingValues(values) {
        return values.filter(v => v === null || v === undefined || v === '').length;
    }
    
    /**
     * Count unique values
     */
    countUniqueValues(values) {
        const unique = new Set(values.map(v => String(v)));
        return unique.size;
    }
    
    /**
     * Calculate statistics for numeric columns
     */
    calculateStatistics(data, headers) {
        const stats = {};
        
        headers.forEach(header => {
            const values = data.map(row => parseFloat(row[header])).filter(v => !isNaN(v));
            
            if (values.length > 0) {
                stats[header] = {
                    min: Math.min(...values),
                    max: Math.max(...values),
                    mean: this.calculateMean(values),
                    median: this.calculateMedian(values),
                    stdDev: this.calculateStandardDeviation(values),
                    variance: this.calculateVariance(values),
                    sum: this.calculateSum(values),
                    count: values.length,
                    quartiles: this.calculateQuartiles(values)
                };
            }
        });
        
        return stats;
    }
    
    /**
     * Calculate mean
     */
    calculateMean(values) {
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    /**
     * Calculate median
     */
    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
            return sorted[mid];
        }
    }
    
    /**
     * Calculate standard deviation
     */
    calculateStandardDeviation(values) {
        const mean = this.calculateMean(values);
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    
    /**
     * Calculate variance
     */
    calculateVariance(values) {
        const mean = this.calculateMean(values);
        return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    }
    
    /**
     * Calculate sum
     */
    calculateSum(values) {
        return values.reduce((sum, val) => sum + val, 0);
    }
    
    /**
     * Calculate quartiles
     */
    calculateQuartiles(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const q1 = this.calculatePercentile(sorted, 25);
        const q2 = this.calculatePercentile(sorted, 50); // median
        const q3 = this.calculatePercentile(sorted, 75);
        
        return {
            q1: q1,
            q2: q2,
            q3: q3,
            iqr: q3 - q1
        };
    }
    
    /**
     * Calculate percentile
     */
    calculatePercentile(sortedValues, percentile) {
        const index = (percentile / 100) * (sortedValues.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;
        
        if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
        
        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }
    
    /**
     * Get column data types summary
     */
    getColumnDataTypes(columns) {
        const types = {};
        columns.forEach(col => {
            types[col.name] = col.type;
        });
        return types;
    }
    
    /**
     * Get missing values summary
     */
    getMissingValuesSummary(columns) {
        const summary = {};
        columns.forEach(col => {
            summary[col.name] = col.missingCount;
        });
        return summary;
    }
    
    /**
     * Get unique values summary
     */
    getUniqueValuesSummary(columns) {
        const summary = {};
        columns.forEach(col => {
            summary[col.name] = col.uniqueValues;
        });
        return summary;
    }
    
    /**
     * Detect outliers using IQR method
     */
    detectOutliers(data, columnName, method = 'iqr') {
        const values = data.map(row => parseFloat(row[columnName])).filter(v => !isNaN(v));
        
        if (values.length === 0) return { outliers: [], bounds: null };
        
        if (method === 'iqr') {
            return this.detectOutliersIQR(values);
        } else if (method === 'zscore') {
            return this.detectOutliersZScore(values);
        }
        
        return { outliers: [], bounds: null };
    }
    
    /**
     * Detect outliers using IQR method
     */
    detectOutliersIQR(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const q1 = this.calculatePercentile(sorted, 25);
        const q3 = this.calculatePercentile(sorted, 75);
        const iqr = q3 - q1;
        
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        const outliers = values.filter(v => v < lowerBound || v > upperBound);
        
        return {
            outliers: outliers,
            bounds: { lower: lowerBound, upper: upperBound },
            count: outliers.length
        };
    }
    
    /**
     * Detect outliers using Z-score method
     */
    detectOutliersZScore(values, threshold = 3) {
        const mean = this.calculateMean(values);
        const stdDev = this.calculateStandardDeviation(values);
        
        const outliers = values.filter(v => Math.abs((v - mean) / stdDev) > threshold);
        
        return {
            outliers: outliers,
            bounds: { mean: mean, stdDev: stdDev, threshold: threshold },
            count: outliers.length
        };
    }
    
    /**
     * Calculate correlation between two columns
     */
    calculateCorrelation(data, column1, column2) {
        const x = data.map(row => parseFloat(row[column1])).filter(v => !isNaN(v));
        const y = data.map(row => parseFloat(row[column2])).filter(v => !isNaN(v));
        
        if (x.length !== y.length || x.length === 0) {
            return { correlation: 0, strength: 'none', direction: 'none' };
        }
        
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
        const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
        const sumY2 = y.reduce((sum, val) => sum + val * val, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        if (denominator === 0) {
            return { correlation: 0, strength: 'none', direction: 'none' };
        }
        
        const correlation = numerator / denominator;
        
        return {
            correlation: correlation,
            strength: this.getCorrelationStrength(Math.abs(correlation)),
            direction: correlation > 0 ? 'positive' : 'negative'
        };
    }
    
    /**
     * Get correlation strength description
     */
    getCorrelationStrength(value) {
        if (value < 0.3) return 'weak';
        if (value < 0.7) return 'moderate';
        return 'strong';
    }
    
    /**
     * Generate insights
     */
    generateInsights(dataStructure) {
        const insights = [];
        
        // Data quality insights
        const totalMissing = Object.values(dataStructure.missingValues).reduce((sum, val) => sum + val, 0);
        const totalCells = dataStructure.rowCount * dataStructure.columnCount;
        const dataQuality = ((totalCells - totalMissing) / totalCells) * 100;
        
        if (dataQuality < 80) {
            insights.push({
                type: 'data_quality',
                severity: 'warning',
                message: `Data quality is ${dataQuality.toFixed(1)}%. Consider cleaning missing values.`,
                details: { quality: dataQuality, missing: totalMissing, total: totalCells }
            });
        }
        
        // Column type insights
        const numericColumns = dataStructure.columns.filter(col => col.type === 'numeric');
        const categoricalColumns = dataStructure.columns.filter(col => col.type === 'categorical');
        
        if (numericColumns.length > 1) {
            insights.push({
                type: 'analysis_opportunity',
                severity: 'info',
                message: `Found ${numericColumns.length} numeric columns. Consider correlation analysis.`,
                details: { columns: numericColumns.map(c => c.name) }
            });
        }
        
        if (categoricalColumns.length > 0) {
            insights.push({
                type: 'visualization_opportunity',
                severity: 'info',
                message: `Found ${categoricalColumns.length} categorical columns. Good for bar charts and pie charts.`,
                details: { columns: categoricalColumns.map(c => c.name) }
            });
        }
        
        // Outlier insights
        numericColumns.forEach(col => {
            const stats = dataStructure.statistics[col.name];
            if (stats) {
                const outliers = this.detectOutliers(dataStructure.rawData, col.name);
                if (outliers.count > 0) {
                    insights.push({
                        type: 'outliers',
                        severity: 'warning',
                        message: `Column "${col.name}" has ${outliers.count} outliers.`,
                        details: { column: col.name, count: outliers.count, bounds: outliers.bounds }
                    });
                }
            }
        });
        
        return insights;
    }
    
    /**
     * Perform trend analysis
     */
    analyzeTrends(data, timeColumn, valueColumn) {
        const timeValues = data.map(row => row[timeColumn]);
        const numericValues = data.map(row => parseFloat(row[valueColumn])).filter(v => !isNaN(v));
        
        if (timeValues.length === 0 || numericValues.length === 0) {
            return { trend: 'none', slope: 0, rSquared: 0 };
        }
        
        // Simple linear regression
        const n = numericValues.length;
        const sumX = timeValues.reduce((sum, val, i) => sum + i, 0);
        const sumY = numericValues.reduce((sum, val) => sum + val, 0);
        const sumXY = timeValues.reduce((sum, val, i) => sum + i * numericValues[i], 0);
        const sumX2 = timeValues.reduce((sum, val, i) => sum + i * i, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Calculate R-squared
        const yMean = sumY / n;
        const ssRes = numericValues.reduce((sum, val, i) => {
            const predicted = slope * i + intercept;
            return sum + Math.pow(val - predicted, 2);
        }, 0);
        const ssTot = numericValues.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
        const rSquared = 1 - (ssRes / ssTot);
        
        let trend = 'none';
        if (Math.abs(slope) > 0.1) {
            trend = slope > 0 ? 'increasing' : 'decreasing';
        }
        
        return {
            trend: trend,
            slope: slope,
            rSquared: rSquared,
            intercept: intercept,
            equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`
        };
    }
    
    /**
     * Cache analysis results
     */
    cacheAnalysis(key, result) {
        if (this.analysisCache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const oldestKey = this.analysisCache.keys().next().value;
            this.analysisCache.delete(oldestKey);
        }
        
        this.analysisCache.set(key, {
            result: result,
            timestamp: Date.now(),
            size: JSON.stringify(result).length
        });
    }
    
    /**
     * Get cached analysis
     */
    getCachedAnalysis(key) {
        const cached = this.analysisCache.get(key);
        if (cached) {
            // Check if cache is still valid (10 minutes)
            if (Date.now() - cached.timestamp < 600000) {
                return cached.result;
            } else {
                this.analysisCache.delete(key);
            }
        }
        return null;
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        this.analysisCache.clear();
    }
    
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.analysisCache.size,
            maxSize: this.maxCacheSize,
            entries: Array.from(this.analysisCache.keys()),
            totalSize: Array.from(this.analysisCache.values()).reduce((sum, entry) => sum + entry.size, 0)
        };
    }
    
    /**
     * Perform comprehensive analysis
     */
    async performAnalysis(data, options = {}) {
        const cacheKey = this.generateCacheKey(data, options);
        const cached = this.getCachedAnalysis(cacheKey);
        
        if (cached) {
            return cached;
        }
        
        const startTime = Date.now();
        
        // Perform analysis
        const structure = this.analyzeDataStructure(data);
        const insights = this.generateInsights(structure);
        
        const result = {
            structure: structure,
            insights: insights,
            analysisTime: Date.now() - startTime,
            timestamp: Date.now(),
            options: options
        };
        
        // Cache result
        this.cacheAnalysis(cacheKey, result);
        
        return result;
    }
    
    /**
     * Generate cache key
     */
    generateCacheKey(data, options) {
        const dataHash = this.hashData(data);
        const optionsHash = JSON.stringify(options);
        return `${dataHash}-${optionsHash}`;
    }
    
    /**
     * Simple data hash function
     */
    hashData(data) {
        const str = JSON.stringify(data.slice(0, 100)); // Hash only first 100 rows
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
    
    /**
     * Export analysis report
     */
    exportAnalysisReport(analysisResult) {
        const report = {
            metadata: {
                title: 'Data Analysis Report',
                generatedAt: new Date().toISOString(),
                version: '1.0.0'
            },
            summary: {
                rowCount: analysisResult.structure.rowCount,
                columnCount: analysisResult.structure.columnCount,
                analysisTime: analysisResult.analysisTime
            },
            dataStructure: analysisResult.structure,
            insights: analysisResult.insights,
            recommendations: this.generateRecommendations(analysisResult)
        };
        
        return JSON.stringify(report, null, 2);
    }
    
    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations(analysisResult) {
        const recommendations = [];
        
        // Data quality recommendations
        const dataQuality = analysisResult.insights.find(i => i.type === 'data_quality');
        if (dataQuality && dataQuality.severity === 'warning') {
            recommendations.push({
                category: 'Data Quality',
                priority: 'high',
                action: 'Clean missing values',
                description: 'Consider filling or removing missing data to improve analysis quality.'
            });
        }
        
        // Visualization recommendations
        const vizOpportunities = analysisResult.insights.filter(i => i.type === 'visualization_opportunity');
        if (vizOpportunities.length > 0) {
            recommendations.push({
                category: 'Visualization',
                priority: 'medium',
                action: 'Create charts',
                description: 'Generate visualizations for categorical data to identify patterns.'
            });
        }
        
        // Analysis recommendations
        const analysisOpportunities = analysisResult.insights.filter(i => i.type === 'analysis_opportunity');
        if (analysisOpportunities.length > 0) {
            recommendations.push({
                category: 'Analysis',
                priority: 'medium',
                action: 'Perform correlation analysis',
                description: 'Analyze relationships between numeric variables.'
            });
        }
        
        return recommendations;
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Analytics;
} else {
    window.Analytics = Analytics;
}