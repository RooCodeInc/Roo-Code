/**
 * Validation Utilities
 * 
 * Input validation functions for the Excel Analyzer Web application.
 */

class Validators {
    /**
     * Validate file format
     */
    validateFileFormat(file) {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        
        if (!file) {
            return { isValid: false, error: 'No file selected' };
        }
        
        if (!allowedTypes.includes(file.type)) {
            return { 
                isValid: false, 
                error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' 
            };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate file size
     */
    validateFileSize(file, maxSize = 50 * 1024 * 1024) {
        if (!file) {
            return { isValid: false, error: 'No file selected' };
        }
        
        if (file.size > maxSize) {
            const maxSizeMB = Math.round(maxSize / (1024 * 1024));
            return { 
                isValid: false, 
                error: `File too large. Maximum file size is ${maxSizeMB}MB` 
            };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate email address
     */
    validateEmail(email) {
        if (!email) {
            return { isValid: false, error: 'Email is required' };
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { isValid: false, error: 'Invalid email format' };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate URL
     */
    validateUrl(url) {
        if (!url) {
            return { isValid: false, error: 'URL is required' };
        }
        
        try {
            new URL(url);
            return { isValid: true };
        } catch (error) {
            return { isValid: false, error: 'Invalid URL format' };
        }
    }
    
    /**
     * Validate number range
     */
    validateNumberRange(value, min = null, max = null) {
        if (value === null || value === undefined || value === '') {
            return { isValid: false, error: 'Number is required' };
        }
        
        const num = Number(value);
        if (isNaN(num)) {
            return { isValid: false, error: 'Value must be a number' };
        }
        
        if (min !== null && num < min) {
            return { isValid: false, error: `Value must be at least ${min}` };
        }
        
        if (max !== null && num > max) {
            return { isValid: false, error: `Value must be at most ${max}` };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate string length
     */
    validateStringLength(str, minLength = 1, maxLength = null) {
        if (!str) {
            return { isValid: false, error: 'String is required' };
        }
        
        if (str.length < minLength) {
            return { isValid: false, error: `String must be at least ${minLength} characters long` };
        }
        
        if (maxLength && str.length > maxLength) {
            return { isValid: false, error: `String must be at most ${maxLength} characters long` };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate data structure
     */
    validateDataStructure(data) {
        if (!data || !Array.isArray(data)) {
            return { isValid: false, error: 'Invalid data structure' };
        }
        
        if (data.length === 0) {
            return { isValid: false, error: 'No data available' };
        }
        
        const headers = Object.keys(data[0]);
        if (headers.length === 0) {
            return { isValid: false, error: 'No columns found in data' };
        }
        
        // Check for consistent structure
        for (let i = 1; i < data.length; i++) {
            const rowHeaders = Object.keys(data[i]);
            if (rowHeaders.length !== headers.length) {
                return { isValid: false, error: `Inconsistent data structure at row ${i + 1}` };
            }
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate chart configuration
     */
    validateChartConfig(config) {
        const requiredFields = ['type', 'data'];
        const errors = [];
        
        for (const field of requiredFields) {
            if (!config[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }
        
        if (config.type && !['bar', 'line', 'pie', 'scatter', 'doughnut'].includes(config.type)) {
            errors.push('Invalid chart type');
        }
        
        if (config.data && !Array.isArray(config.data)) {
            errors.push('Chart data must be an array');
        }
        
        if (errors.length > 0) {
            return { isValid: false, error: errors.join(', ') };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate export settings
     */
    validateExportSettings(settings) {
        const errors = [];
        
        if (!settings) {
            return { isValid: false, error: 'Export settings are required' };
        }
        
        const validFormats = ['pdf', 'excel', 'csv', 'json'];
        if (settings.format && !validFormats.includes(settings.format)) {
            errors.push('Invalid export format');
        }
        
        if (settings.includeCharts !== undefined && typeof settings.includeCharts !== 'boolean') {
            errors.push('includeCharts must be boolean');
        }
        
        if (settings.includeData !== undefined && typeof settings.includeData !== 'boolean') {
            errors.push('includeData must be boolean');
        }
        
        if (errors.length > 0) {
            return { isValid: false, error: errors.join(', ') };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate dashboard configuration
     */
    validateDashboardConfig(config) {
        const errors = [];
        
        if (!config) {
            return { isValid: false, error: 'Dashboard configuration is required' };
        }
        
        if (config.widgets && !Array.isArray(config.widgets)) {
            errors.push('Widgets must be an array');
        }
        
        if (config.layout && typeof config.layout !== 'string') {
            errors.push('Layout must be a string');
        }
        
        if (errors.length > 0) {
            return { isValid: false, error: errors.join(', ') };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate settings object
     */
    validateSettings(settings) {
        const errors = [];
        
        if (!settings || typeof settings !== 'object') {
            return { isValid: false, error: 'Settings must be an object' };
        }
        
        // Validate specific settings
        if (settings.maxFileSize && !this.validateNumberRange(settings.maxFileSize, 1024).isValid) {
            errors.push('maxFileSize must be at least 1024 bytes');
        }
        
        if (settings.maxRows && !this.validateNumberRange(settings.maxRows, 1, 100000).isValid) {
            errors.push('maxRows must be between 1 and 100000');
        }
        
        if (settings.maxColumns && !this.validateNumberRange(settings.maxColumns, 1, 1000).isValid) {
            errors.push('maxColumns must be between 1 and 1000');
        }
        
        if (settings.outlierThreshold && !this.validateNumberRange(settings.outlierThreshold, 1).isValid) {
            errors.push('outlierThreshold must be at least 1');
        }
        
        if (settings.theme && !['light', 'dark'].includes(settings.theme)) {
            errors.push('theme must be either "light" or "dark"');
        }
        
        if (errors.length > 0) {
            return { isValid: false, error: errors.join(', ') };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate color value
     */
    validateColor(color) {
        if (!color) {
            return { isValid: false, error: 'Color is required' };
        }
        
        // Check for hex color
        const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (hexRegex.test(color)) {
            return { isValid: true };
        }
        
        // Check for RGB color
        const rgbRegex = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/;
        if (rgbRegex.test(color)) {
            const matches = color.match(rgbRegex);
            const r = parseInt(matches[1]);
            const g = parseInt(matches[2]);
            const b = parseInt(matches[3]);
            
            if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
                return { isValid: true };
            }
        }
        
        // Check for named colors
        const namedColors = [
            'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
            'black', 'white', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'navy',
            'maroon', 'olive', 'teal', 'silver', 'aqua', 'fuchsia'
        ];
        
        if (namedColors.includes(color.toLowerCase())) {
            return { isValid: true };
        }
        
        return { isValid: false, error: 'Invalid color format' };
    }
    
    /**
     * Validate date range
     */
    validateDateRange(startDate, endDate) {
        if (!startDate || !endDate) {
            return { isValid: false, error: 'Both start and end dates are required' };
        }
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return { isValid: false, error: 'Invalid date format' };
        }
        
        if (start > end) {
            return { isValid: false, error: 'Start date must be before end date' };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate array of items
     */
    validateArray(items, validatorFn, minItems = 0, maxItems = null) {
        if (!Array.isArray(items)) {
            return { isValid: false, error: 'Must be an array' };
        }
        
        if (items.length < minItems) {
            return { isValid: false, error: `Must have at least ${minItems} items` };
        }
        
        if (maxItems && items.length > maxItems) {
            return { isValid: false, error: `Must have at most ${maxItems} items` };
        }
        
        for (let i = 0; i < items.length; i++) {
            const result = validatorFn(items[i]);
            if (!result.isValid) {
                return { isValid: false, error: `Item ${i + 1}: ${result.error}` };
            }
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate object properties
     */
    validateObject(obj, rules) {
        if (!obj || typeof obj !== 'object') {
            return { isValid: false, error: 'Must be an object' };
        }
        
        for (const [key, validator] of Object.entries(rules)) {
            if (obj[key] !== undefined) {
                const result = validator(obj[key]);
                if (!result.isValid) {
                    return { isValid: false, error: `${key}: ${result.error}` };
                }
            }
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate required field
     */
    validateRequired(value, fieldName = 'Field') {
        if (value === null || value === undefined || value === '') {
            return { isValid: false, error: `${fieldName} is required` };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate against custom function
     */
    validateCustom(value, validatorFn, errorMessage = 'Validation failed') {
        try {
            const result = validatorFn(value);
            if (result === true) {
                return { isValid: true };
            } else if (typeof result === 'string') {
                return { isValid: false, error: result };
            } else {
                return { isValid: false, error: errorMessage };
            }
        } catch (error) {
            return { isValid: false, error: error.message || errorMessage };
        }
    }
    
    /**
     * Batch validation
     */
    validateBatch(validations) {
        const results = [];
        let isValid = true;
        
        for (const validation of validations) {
            const result = validation.validator(validation.value, ...validation.args);
            results.push({
                ...result,
                field: validation.field
            });
            
            if (!result.isValid) {
                isValid = false;
            }
        }
        
        return {
            isValid,
            results,
            errors: results.filter(r => !r.isValid).map(r => `${r.field}: ${r.error}`)
        };
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validators;
} else {
    window.Validators = Validators;
}