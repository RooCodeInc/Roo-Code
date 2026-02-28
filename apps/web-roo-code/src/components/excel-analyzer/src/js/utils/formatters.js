/**
 * Formatting Utilities
 * 
 * Data formatting functions for the Excel Analyzer Web application.
 */

class Formatters {
    /**
     * Format number with locale
     */
    formatNumber(num, options = {}) {
        if (num === null || num === undefined || isNaN(num)) {
            return options.defaultValue || '0';
        }
        
        const defaultOptions = {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
            useGrouping: true,
            locale: 'en-US'
        };
        
        const config = { ...defaultOptions, ...options };
        
        return Number(num).toLocaleString(config.locale, {
            minimumFractionDigits: config.minimumFractionDigits,
            maximumFractionDigits: config.maximumFractionDigits,
            useGrouping: config.useGrouping
        });
    }
    
    /**
     * Format currency
     */
    formatCurrency(num, options = {}) {
        if (num === null || num === undefined || isNaN(num)) {
            return options.defaultValue || '$0.00';
        }
        
        const defaultOptions = {
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            locale: 'en-US'
        };
        
        const config = { ...defaultOptions, ...options };
        
        return Number(num).toLocaleString(config.locale, {
            style: 'currency',
            currency: config.currency,
            minimumFractionDigits: config.minimumFractionDigits,
            maximumFractionDigits: config.maximumFractionDigits
        });
    }
    
    /**
     * Format percentage
     */
    formatPercentage(num, options = {}) {
        if (num === null || num === undefined || isNaN(num)) {
            return options.defaultValue || '0%';
        }
        
        const defaultOptions = {
            minimumFractionDigits: 1,
            maximumFractionDigits: 2,
            locale: 'en-US'
        };
        
        const config = { ...defaultOptions, ...options };
        
        return Number(num).toLocaleString(config.locale, {
            style: 'percent',
            minimumFractionDigits: config.minimumFractionDigits,
            maximumFractionDigits: config.maximumFractionDigits
        });
    }
    
    /**
     * Format date
     */
    formatDate(date, options = {}) {
        if (!date) {
            return options.defaultValue || '';
        }
        
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            locale: 'en-US'
        };
        
        const config = { ...defaultOptions, ...options };
        
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) {
                return options.defaultValue || '';
            }
            
            return d.toLocaleDateString(config.locale, {
                year: config.year,
                month: config.month,
                day: config.day,
                hour: config.hour,
                minute: config.minute,
                second: config.second
            });
        } catch (error) {
            return options.defaultValue || '';
        }
    }
    
    /**
     * Format time
     */
    formatTime(date, options = {}) {
        if (!date) {
            return options.defaultValue || '';
        }
        
        const defaultOptions = {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            locale: 'en-US'
        };
        
        const config = { ...defaultOptions, ...options };
        
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) {
                return options.defaultValue || '';
            }
            
            return d.toLocaleTimeString(config.locale, {
                hour: config.hour,
                minute: config.minute,
                second: config.second
            });
        } catch (error) {
            return options.defaultValue || '';
        }
    }
    
    /**
     * Format file size
     */
    formatFileSize(bytes, options = {}) {
        if (bytes === 0) {
            return options.defaultValue || '0 Bytes';
        }
        
        const defaultOptions = {
            decimals: 2,
            units: ['Bytes', 'KB', 'MB', 'GB', 'TB']
        };
        
        const config = { ...defaultOptions, ...options };
        
        if (bytes === 0) return '0 ' + config.units[0];
        
        const k = 1024;
        const dm = config.decimals < 0 ? 0 : config.decimals;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + config.units[i];
    }
    
    /**
     * Format duration
     */
    formatDuration(milliseconds, options = {}) {
        if (!milliseconds || milliseconds <= 0) {
            return options.defaultValue || '0s';
        }
        
        const defaultOptions = {
            showDays: true,
            showHours: true,
            showMinutes: true,
            showSeconds: true,
            showMilliseconds: false
        };
        
        const config = { ...defaultOptions, ...options };
        
        const ms = milliseconds % 1000;
        const seconds = Math.floor((milliseconds / 1000) % 60);
        const minutes = Math.floor((milliseconds / (1000 * 60)) % 60);
        const hours = Math.floor((milliseconds / (1000 * 60 * 60)) % 24);
        const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
        
        const parts = [];
        
        if (config.showDays && days > 0) {
            parts.push(`${days}d`);
        }
        
        if (config.showHours && (hours > 0 || parts.length > 0)) {
            parts.push(`${hours}h`);
        }
        
        if (config.showMinutes && (minutes > 0 || parts.length > 0)) {
            parts.push(`${minutes}m`);
        }
        
        if (config.showSeconds && (seconds > 0 || parts.length > 0)) {
            parts.push(`${seconds}s`);
        }
        
        if (config.showMilliseconds && ms > 0) {
            parts.push(`${ms}ms`);
        }
        
        return parts.join(' ') || '0s';
    }
    
    /**
     * Format large numbers with abbreviations
     */
    formatLargeNumber(num, options = {}) {
        if (num === null || num === undefined || isNaN(num)) {
            return options.defaultValue || '0';
        }
        
        const defaultOptions = {
            decimals: 1,
            abbreviations: {
                1e3: 'K',
                1e6: 'M',
                1e9: 'B',
                1e12: 'T'
            }
        };
        
        const config = { ...defaultOptions, ...options };
        
        const absNum = Math.abs(num);
        
        for (const [threshold, abbr] of Object.entries(config.abbreviations).sort((a, b) => b[0] - a[0])) {
            if (absNum >= threshold) {
                const value = num / threshold;
                const decimals = absNum >= threshold * 10 ? 0 : config.decimals;
                return value.toFixed(decimals) + abbr;
            }
        }
        
        return this.formatNumber(num, { maximumFractionDigits: config.decimals });
    }
    
    /**
     * Format text case
     */
    formatTextCase(text, format = 'title') {
        if (!text) return '';
        
        switch (format.toLowerCase()) {
            case 'upper':
                return text.toUpperCase();
            case 'lower':
                return text.toLowerCase();
            case 'title':
                return text.replace(/\w\S*/g, (txt) => {
                    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                });
            case 'sentence':
                return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
            case 'camel':
                return text.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                    return index === 0 ? word.toLowerCase() : word.toUpperCase();
                }).replace(/\s+/g, '');
            case 'pascal':
                return text.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
                    return word.toUpperCase();
                }).replace(/\s+/g, '');
            case 'kebab':
                return text.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/\s+/g, '-').toLowerCase();
            case 'snake':
                return text.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/\s+/g, '_').toLowerCase();
            default:
                return text;
        }
    }
    
    /**
     * Format phone number
     */
    formatPhoneNumber(phone, options = {}) {
        if (!phone) return '';
        
        const defaultOptions = {
            format: 'US', // US, International, etc.
            separator: '-'
        };
        
        const config = { ...defaultOptions, ...options };
        
        // Remove all non-digit characters
        const digits = phone.replace(/\D/g, '');
        
        if (config.format === 'US') {
            if (digits.length === 10) {
                return digits.replace(/(\d{3})(\d{3})(\d{4})/, `($1) $2${config.separator}$3`);
            } else if (digits.length === 11 && digits[0] === '1') {
                return digits.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, `+$1 ($2) $3${config.separator}$4`);
            }
        }
        
        // Default format
        return digits;
    }
    
    /**
     * Format postal code
     */
    formatPostalCode(code, options = {}) {
        if (!code) return '';
        
        const defaultOptions = {
            format: 'US' // US, Canada, etc.
        };
        
        const config = { ...defaultOptions, ...options };
        
        const cleanCode = code.replace(/\s+/g, '').toUpperCase();
        
        if (config.format === 'US') {
            // US ZIP code format: 12345 or 12345-6789
            if (cleanCode.length === 5) {
                return cleanCode;
            } else if (cleanCode.length === 9) {
                return cleanCode.replace(/(\d{5})(\d{4})/, '$1-$2');
            }
        } else if (config.format === 'Canada') {
            // Canadian postal code format: A1A 1A1
            if (cleanCode.length === 6) {
                return cleanCode.replace(/(.{3})(.{3})/, '$1 $2');
            }
        }
        
        return cleanCode;
    }
    
    /**
     * Format percentage change
     */
    formatPercentageChange(oldValue, newValue, options = {}) {
        if (oldValue === null || newValue === null || oldValue === 0) {
            return options.defaultValue || '0%';
        }
        
        const change = ((newValue - oldValue) / Math.abs(oldValue)) * 100;
        const formattedChange = this.formatPercentage(Math.abs(change) / 100, options);
        
        if (newValue > oldValue) {
            return `+${formattedChange}`;
        } else if (newValue < oldValue) {
            return `-${formattedChange}`;
        } else {
            return '0%';
        }
    }
    
    /**
     * Format data size
     */
    formatDataSize(bytes, options = {}) {
        return this.formatFileSize(bytes, options);
    }
    
    /**
     * Format memory size
     */
    formatMemorySize(bytes, options = {}) {
        const defaultOptions = {
            units: ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
        };
        
        return this.formatFileSize(bytes, { ...defaultOptions, ...options });
    }
    
    /**
     * Format speed
     */
    formatSpeed(bytesPerSecond, options = {}) {
        const defaultOptions = {
            timeUnit: 's' // s, m, h
        };
        
        const config = { ...defaultOptions, ...options };
        
        let unit = '/s';
        let speed = bytesPerSecond;
        
        switch (config.timeUnit) {
            case 'm':
                speed = bytesPerSecond * 60;
                unit = '/m';
                break;
            case 'h':
                speed = bytesPerSecond * 3600;
                unit = '/h';
                break;
        }
        
        return this.formatDataSize(speed, { ...config, defaultValue: '0 B' }) + unit;
    }
    
    /**
     * Format ratio
     */
    formatRatio(numerator, denominator, options = {}) {
        if (denominator === 0) {
            return options.defaultValue || '0:1';
        }
        
        const defaultOptions = {
            decimals: 2
        };
        
        const config = { ...defaultOptions, ...options };
        
        const ratio = numerator / denominator;
        return this.formatNumber(ratio, { ...config, defaultValue: '0' }) + ':1';
    }
    
    /**
     * Format score
     */
    formatScore(score, maxScore = 100, options = {}) {
        if (score === null || score === undefined) {
            return options.defaultValue || '0';
        }
        
        const defaultOptions = {
            showPercentage: true,
            showFraction: false,
            maxDecimals: 2
        };
        
        const config = { ...defaultOptions, ...options };
        
        let result = '';
        
        if (config.showFraction) {
            result += `${score}/${maxScore}`;
        }
        
        if (config.showPercentage) {
            const percentage = (score / maxScore) * 100;
            const formattedPercentage = this.formatNumber(percentage, { 
                maximumFractionDigits: config.maxDecimals 
            });
            
            if (result) {
                result += ' ';
            }
            result += `(${formattedPercentage}%)`;
        }
        
        return result || this.formatNumber(score, { maximumFractionDigits: config.maxDecimals });
    }
    
    /**
     * Format progress
     */
    formatProgress(current, total, options = {}) {
        if (total === 0) {
            return options.defaultValue || '0%';
        }
        
        const percentage = (current / total) * 100;
        return this.formatPercentage(percentage / 100, options);
    }
    
    /**
     * Format version
     */
    formatVersion(version, options = {}) {
        if (!version) return '';
        
        const defaultOptions = {
            padZeros: true,
            maxParts: 4
        };
        
        const config = { ...defaultOptions, ...options };
        
        // Remove all non-numeric and non-dot characters except hyphens
        const cleanVersion = version.replace(/[^\d.-]/g, '');
        
        // Split by dots and hyphens
        const parts = cleanVersion.split(/[.-]/).filter(part => part.length > 0);
        
        if (config.padZeros) {
            // Pad each part to at least 2 digits
            const paddedParts = parts.map(part => part.padStart(2, '0'));
            return paddedParts.slice(0, config.maxParts).join('.');
        }
        
        return parts.slice(0, config.maxParts).join('.');
    }
    
    /**
     * Format scientific notation
     */
    formatScientific(num, options = {}) {
        if (num === null || num === undefined || isNaN(num)) {
            return options.defaultValue || '0';
        }
        
        const defaultOptions = {
            precision: 2
        };
        
        const config = { ...defaultOptions, ...options };
        
        return Number(num).toExponential(config.precision);
    }
    
    /**
     * Format boolean
     */
    formatBoolean(value, options = {}) {
        const defaultOptions = {
            trueLabel: 'Yes',
            falseLabel: 'No',
            nullLabel: 'N/A'
        };
        
        const config = { ...defaultOptions, ...options };
        
        if (value === true || value === 'true' || value === 1) {
            return config.trueLabel;
        } else if (value === false || value === 'false' || value === 0) {
            return config.falseLabel;
        } else {
            return config.nullLabel;
        }
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Formatters;
} else {
    window.Formatters = Formatters;
}