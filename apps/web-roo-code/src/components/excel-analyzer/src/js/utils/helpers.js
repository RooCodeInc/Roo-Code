/**
 * Helper Utilities
 * 
 * Common utility functions for the Excel Analyzer Web application.
 */

class Helpers {
    /**
     * Deep clone an object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (obj instanceof Array) {
            return obj.map(item => this.deepClone(item));
        }
        
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }
    
    /**
     * Generate unique ID
     */
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Format number with commas and decimal places
     */
    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) {
            return '0';
        }
        
        return Number(num).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
    
    /**
     * Format currency
     */
    formatCurrency(num, currency = 'USD', decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) {
            return '$0.00';
        }
        
        return Number(num).toLocaleString('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
    
    /**
     * Format percentage
     */
    formatPercentage(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) {
            return '0%';
        }
        
        return Number(num).toLocaleString('en-US', {
            style: 'percent',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
    
    /**
     * Format date
     */
    formatDate(date, format = 'YYYY-MM-DD') {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }
    
    /**
     * Debounce function
     */
    debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }
    
    /**
     * Throttle function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * Check if value is empty
     */
    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }
    
    /**
     * Get object size in bytes
     */
    getObjectSize(obj) {
        const objStr = JSON.stringify(obj);
        return new Blob([objStr]).size;
    }
    
    /**
     * Capitalize first letter
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
    
    /**
     * Truncate string
     */
    truncate(str, maxLength = 50, suffix = '...') {
        if (!str || str.length <= maxLength) return str;
        return str.substring(0, maxLength - suffix.length) + suffix;
    }
    
    /**
     * Get file extension
     */
    getFileExtension(filename) {
        if (!filename) return '';
        return filename.split('.').pop().toLowerCase();
    }
    
    /**
     * Check if file is image
     */
    isImageFile(filename) {
        const ext = this.getFileExtension(filename);
        return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(ext);
    }
    
    /**
     * Check if file is Excel
     */
    isExcelFile(filename) {
        const ext = this.getFileExtension(filename);
        return ['xlsx', 'xls'].includes(ext);
    }
    
    /**
     * Get random color
     */
    getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }
    
    /**
     * Generate color palette
     */
    generateColorPalette(count = 5) {
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
            return Math.round(255 * color).toString(16).padStart(2, '0'); // convert to Hex and prefix "0" if needed
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }
    
    /**
     * Shuffle array
     */
    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    
    /**
     * Get unique values from array
     */
    getUniqueValues(array) {
        return [...new Set(array)];
    }
    
    /**
     * Group array by property
     */
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const groupKey = item[key];
            groups[groupKey] = groups[groupKey] || [];
            groups[groupKey].push(item);
            return groups;
        }, {});
    }
    
    /**
     * Sort array by property
     */
    sortBy(array, key, direction = 'asc') {
        return [...array].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    /**
     * Search in array of objects
     */
    searchInArray(array, searchTerm, keys) {
        if (!searchTerm) return array;
        
        const term = searchTerm.toLowerCase();
        return array.filter(item => {
            return keys.some(key => {
                const value = item[key];
                return value && value.toString().toLowerCase().includes(term);
            });
        });
    }
    
    /**
     * Download file
     */
    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Copy text to clipboard
     */
    copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Failed to copy text: ', err);
            } finally {
                document.body.removeChild(textArea);
            }
        }
    }
    
    /**
     * Validate email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    /**
     * Validate URL
     */
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    
    /**
     * Get URL parameters
     */
    getUrlParams(url = window.location.href) {
        const params = {};
        const urlObj = new URL(url);
        urlObj.searchParams.forEach((value, key) => {
            params[key] = value;
        });
        return params;
    }
    
    /**
     * Set URL parameters
     */
    setUrlParams(params) {
        const url = new URL(window.location.href);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.set(key, params[key]);
            } else {
                url.searchParams.delete(key);
            }
        });
        window.history.replaceState({}, '', url.toString());
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Helpers;
} else {
    window.Helpers = Helpers;
}