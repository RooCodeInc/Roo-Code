/**
 * Data Processing Module of Web Application
 * 
 * Handles data analysis, preprocessing, missing value detection,
 * outlier identification, and data cleaning.
 */

class DataProcessor {
    constructor(options = {}) {
        this.options = options;
        this.isProcessing = false;
    }
    
    /**
     * Analyze data structure and characteristics
     */
    analyzeDataStructure(data) {
        if (!data || data.length === 0) {
            throw new Error('No data to analyze');
        }
        
        const headers = Object.keys(data[0]);
        const rowCount = data.length;
        
        const columns = headers.map(header => {
            const values = data.map(row => row[header]);
            return this.analyzeColumn(header, values);
        });
        
        const structure = {
            rowCount,
            columnCount: headers.length,
            columns,
            totalCells: rowCount * headers.length,
            missingCells: this.countMissingValues(data),
            dataTypes: this.detectDataTypes(data)
        };
        
        if (this.options.onDataAnalyzed) {
            this.options.onDataAnalyzed(structure);
        }
        
        return structure;
    }
    
    /**
     * Analyze individual column characteristics
     */
    analyzeColumn(name, values) {
        const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
        const nullCount = values.length - nonNullValues.length;
        const uniqueValues = new Set(nonNullValues.map(v => v.toString())).size;
        
        const dataType = this.detectColumnType(nonNullValues);
        const statistics = this.calculateStatistics(nonNullValues, dataType);
        
        return {
            name,
            type: dataType,
            uniqueValues,
            nullCount,
            nullPercentage: Math.round((nullCount / values.length) * 100),
            statistics
        };
    }
    
    /**
     * Detect column data type
     */
    detectColumnType(values) {
        if (values.length === 0) return 'unknown';
        
        // Check for date/time
        const datePattern = /^\d{4}-\d{2}-\d{2}/;
        const timePattern = /^\d{2}:\d{2}:\d{2}/;
        
        for (let value of values) {
            if (typeof value === 'string') {
                if (datePattern.test(value) || timePattern.test(value)) {
                    return 'datetime';
                }
                if (!isNaN(Date.parse(value))) {
                    return 'datetime';
                }
            }
        }
        
        // Check for numeric
        const numericValues = values.filter(v => !isNaN(v) && v !== '');
        if (numericValues.length / values.length > 0.8) {
            return 'numeric';
        }
        
        // Check for boolean
        const booleanValues = values.filter(v => 
            v === true || v === false || 
            v === 'true' || v === 'false' ||
            v === 'TRUE' || v === 'FALSE' ||
            v === 0 || v === 1
        );
        if (booleanValues.length / values.length > 0.9) {
            return 'boolean';
        }
        
        // Default to text
        return 'text';
    }
    
    /**
     * Calculate column statistics
     */
    calculateStatistics(values, dataType) {
        if (dataType !== 'numeric' || values.length === 0) {
            return {
                min: null,
                max: null,
                mean: null,
                median: null,
                stdDev: null,
                outliers: []
            };
        }
        
        const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
        
        if (numericValues.length === 0) {
            return { min: null, max: null, mean: null, median: null, stdDev: null, outliers: [] };
        }
        
        numericValues.sort((a, b) => a - b);
        
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        const mean = this.calculateMean(numericValues);
        const median = this.calculateMedian(numericValues);
        const stdDev = this.calculateStdDev(numericValues, mean);
        const outliers = this.detectOutliers(numericValues, mean, stdDev);
        
        return {
            min,
            max,
            mean,
            median,
            stdDev,
            outliers
        };
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
        const mid = Math.floor(values.length / 2);
        return values.length % 2 !== 0 
            ? values[mid] 
            : (values[mid - 1] + values[mid]) / 2;
    }
    
    /**
     * Calculate standard deviation
     */
    calculateStdDev(values, mean) {
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    
    /**
     * Detect outliers using IQR method
     */
    detectOutliers(values, mean, stdDev) {
        // Using Z-score method for outlier detection
        const threshold = 3;
        const outliers = [];
        
        values.forEach((value, index) => {
            const zScore = Math.abs((value - mean) / stdDev);
            if (zScore > threshold) {
                outliers.push({
                    index,
                    value,
                    zScore
                });
            }
        });
        
        return outliers;
    }
    
    /**
     * Count missing values in dataset
     */
    countMissingValues(data) {
        let count = 0;
        const headers = Object.keys(data[0]);
        
        data.forEach(row => {
            headers.forEach(header => {
                if (row[header] === null || row[header] === undefined || row[header] === '') {
                    count++;
                }
            });
        });
        
        return count;
    }
    
    /**
     * Detect data types for all columns
     */
    detectDataTypes(data) {
        if (data.length === 0) return {};
        
        const headers = Object.keys(data[0]);
        const types = {};
        
        headers.forEach(header => {
            const values = data.map(row => row[header]);
            types[header] = this.detectColumnType(values);
        });
        
        return types;
    }
    
    /**
     * Clean data by handling missing values and outliers
     */
    cleanData(data, rules = {}) {
        if (!data || data.length === 0) return data;
        
        const cleanedData = JSON.parse(JSON.stringify(data)); // Deep copy
        const headers = Object.keys(data[0]);
        
        headers.forEach(header => {
            const columnRules = rules[header] || {};
            const values = cleanedData.map(row => row[header]);
            const dataType = this.detectColumnType(values);
            
            // Handle missing values
            if (columnRules.handleMissing) {
                cleanedData.forEach(row => {
                    if (row[header] === null || row[header] === undefined || row[header] === '') {
                        row[header] = this.handleMissingValue(row[header], dataType, columnRules);
                    }
                });
            }
            
            // Handle outliers
            if (columnRules.handleOutliers && dataType === 'numeric') {
                const numericValues = values
                    .filter(v => !isNaN(v) && v !== '')
                    .map(v => parseFloat(v));
                
                if (numericValues.length > 0) {
                    const mean = this.calculateMean(numericValues);
                    const stdDev = this.calculateStdDev(numericValues, mean);
                    
                    cleanedData.forEach(row => {
                        const value = parseFloat(row[header]);
                        if (!isNaN(value)) {
                            const zScore = Math.abs((value - mean) / stdDev);
                            if (zScore > 3) { // Outlier threshold
                                row[header] = this.handleOutlier(value, mean, stdDev, columnRules);
                            }
                        }
                    });
                }
            }
        });
        
        if (this.options.onDataProcessed) {
            this.options.onDataProcessed(cleanedData);
        }
        
        return cleanedData;
    }
    
    /**
     * Handle missing values based on strategy
     */
    handleMissingValue(value, dataType, rules) {
        const strategy = rules.missingStrategy || 'remove';
        
        switch (strategy) {
            case 'mean':
                return dataType === 'numeric' ? 0 : '';
            case 'median':
                return dataType === 'numeric' ? 0 : '';
            case 'mode':
                return '';
            case 'forward_fill':
                return value; // Would need previous value
            case 'backward_fill':
                return value; // Would need next value
            case 'remove':
            default:
                return null;
        }
    }
    
    /**
     * Handle outliers based on strategy
     */
    handleOutlier(value, mean, stdDev, rules) {
        const strategy = rules.outlierStrategy || 'remove';
        
        switch (strategy) {
            case 'cap':
                return Math.sign(value) * 3 * stdDev + mean;
            case 'mean':
                return mean;
            case 'remove':
            default:
                return null;
        }
    }
    
    /**
     * Get data quality report
     */
    getDataQualityReport(data) {
        if (!data || data.length === 0) {
            return { quality: 0, issues: ['No data available'] };
        }
        
        const headers = Object.keys(data[0]);
        const totalCells = data.length * headers.length;
        const missingCells = this.countMissingValues(data);
        const missingPercentage = (missingCells / totalCells) * 100;
        
        const issues = [];
        let quality = 100;
        
        if (missingPercentage > 10) {
            issues.push(`High missing value rate: ${missingPercentage.toFixed(1)}%`);
            quality -= 20;
        } else if (missingPercentage > 5) {
            issues.push(`Moderate missing value rate: ${missingPercentage.toFixed(1)}%`);
            quality -= 10;
        }
        
        // Check for data type inconsistencies
        headers.forEach(header => {
            const values = data.map(row => row[header]);
            const dataType = this.detectColumnType(values);
            
            if (dataType === 'unknown') {
                issues.push(`Column "${header}" has inconsistent data types`);
                quality -= 5;
            }
        });
        
        return {
            quality: Math.max(0, quality),
            missingPercentage,
            issues,
            totalRecords: data.length,
            totalFields: headers.length
        };
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataProcessor;
} else {
    window.DataProcessor = DataProcessor;
}