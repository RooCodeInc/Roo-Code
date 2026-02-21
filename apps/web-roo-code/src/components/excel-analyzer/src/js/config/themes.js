/**
 * Theme Manager of Web Application
 * 
 * Manages theme switching and CSS custom properties for the Excel Analyzer application.
 */

class ThemeManager {
    constructor() {
        this.themes = {
            royal: {
                name: '👑 Royal',
                description: 'Purple, Gold, Black & White — elegant royal palette',
                cssVariables: {
                    '--primary-color': '#6a0dad',
                    '--secondary-color': '#FFD700',
                    '--success-color': '#4caf50',
                    '--danger-color': '#e53935',
                    '--warning-color': '#FFD700',
                    '--info-color': '#ab47bc',
                    '--light-color': '#ffffff',
                    '--dark-color': '#0d0d0d',

                    '--bg-primary': '#ffffff',
                    '--bg-secondary': '#f5f0ff',
                    '--bg-accent': '#ede7f6',

                    '--text-primary': '#0d0d0d',
                    '--text-secondary': '#4a148c',
                    '--text-muted': '#7b5ea7',

                    '--border-color': '#ce93d8',
                    '--shadow': '0 0.125rem 0.25rem rgba(106, 13, 173, 0.15)',
                    '--shadow-lg': '0 0.5rem 1rem rgba(106, 13, 173, 0.25)',

                    '--gold-color': '#FFD700',
                    '--gold-dark': '#c9a800',
                    '--purple-dark': '#4a148c',
                    '--purple-mid': '#6a0dad',
                    '--purple-light': '#ab47bc',

                    '--font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    '--font-size-base': '1rem',
                    '--line-height-base': '1.5',
                    '--border-radius': '0.375rem',
                    '--border-radius-lg': '0.5rem',
                    '--border-radius-sm': '0.25rem'
                }
            },
            'royal-dark': {
                name: '🌑 Royal Dark',
                description: 'Black, Deep Purple & Gold — dark royal palette',
                cssVariables: {
                    '--primary-color': '#ce93d8',
                    '--secondary-color': '#FFD700',
                    '--success-color': '#66bb6a',
                    '--danger-color': '#ef5350',
                    '--warning-color': '#FFD700',
                    '--info-color': '#ba68c8',
                    '--light-color': '#0d0d0d',
                    '--dark-color': '#ffffff',

                    '--bg-primary': '#0d0d0d',
                    '--bg-secondary': '#1a0a2e',
                    '--bg-accent': '#2d1b4e',

                    '--text-primary': '#ffffff',
                    '--text-secondary': '#FFD700',
                    '--text-muted': '#ce93d8',

                    '--border-color': '#4a148c',
                    '--shadow': '0 0.125rem 0.25rem rgba(0, 0, 0, 0.6)',
                    '--shadow-lg': '0 0.5rem 1rem rgba(206, 147, 216, 0.2)',

                    '--gold-color': '#FFD700',
                    '--gold-dark': '#c9a800',
                    '--purple-dark': '#4a148c',
                    '--purple-mid': '#6a0dad',
                    '--purple-light': '#ce93d8',

                    '--font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    '--font-size-base': '1rem',
                    '--line-height-base': '1.5',
                    '--border-radius': '0.375rem',
                    '--border-radius-lg': '0.5rem',
                    '--border-radius-sm': '0.25rem'
                }
            },
            light: {
                name: 'Light',
                description: 'Clean and bright interface',
                cssVariables: {
                    '--primary-color': '#007bff',
                    '--secondary-color': '#6c757d',
                    '--success-color': '#28a745',
                    '--danger-color': '#dc3545',
                    '--warning-color': '#ffc107',
                    '--info-color': '#17a2b8',
                    '--light-color': '#f8f9fa',
                    '--dark-color': '#343a40',

                    '--bg-primary': '#ffffff',
                    '--bg-secondary': '#f8f9fa',
                    '--bg-accent': '#e9ecef',

                    '--text-primary': '#212529',
                    '--text-secondary': '#6c757d',
                    '--text-muted': '#6c757d',

                    '--border-color': '#dee2e6',
                    '--shadow': '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
                    '--shadow-lg': '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',

                    '--gold-color': '#ffc107',
                    '--gold-dark': '#e0a800',
                    '--purple-dark': '#6f42c1',
                    '--purple-mid': '#7b1fa2',
                    '--purple-light': '#ab47bc',

                    '--font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    '--font-size-base': '1rem',
                    '--line-height-base': '1.5',
                    '--border-radius': '0.375rem',
                    '--border-radius-lg': '0.5rem',
                    '--border-radius-sm': '0.25rem'
                }
            },
            dark: {
                name: 'Dark',
                description: 'Dark interface for reduced eye strain',
                cssVariables: {
                    '--primary-color': '#4dabf7',
                    '--secondary-color': '#66d9ef',
                    '--success-color': '#51cf66',
                    '--danger-color': '#ff6b6b',
                    '--warning-color': '#ffd43b',
                    '--info-color': '#22d3ee',
                    '--light-color': '#121212',
                    '--dark-color': '#ffffff',

                    '--bg-primary': '#121212',
                    '--bg-secondary': '#1e1e1e',
                    '--bg-accent': '#2d2d2d',

                    '--text-primary': '#ffffff',
                    '--text-secondary': '#b0b0b0',
                    '--text-muted': '#8e8e8e',

                    '--border-color': '#3a3a3a',
                    '--shadow': '0 0.125rem 0.25rem rgba(0, 0, 0, 0.5)',
                    '--shadow-lg': '0 0.5rem 1rem rgba(0, 0, 0, 0.3)',

                    '--gold-color': '#ffd43b',
                    '--gold-dark': '#e0a800',
                    '--purple-dark': '#6f42c1',
                    '--purple-mid': '#7b1fa2',
                    '--purple-light': '#ab47bc',

                    '--font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    '--font-size-base': '1rem',
                    '--line-height-base': '1.5',
                    '--border-radius': '0.375rem',
                    '--border-radius-lg': '0.5rem',
                    '--border-radius-sm': '0.25rem'
                }
            },
            blue: {
                name: 'Blue',
                description: 'Professional blue color scheme',
                cssVariables: {
                    '--primary-color': '#1976d2',
                    '--secondary-color': '#424242',
                    '--success-color': '#2e7d32',
                    '--danger-color': '#c62828',
                    '--warning-color': '#ef6c00',
                    '--info-color': '#0277bd',
                    '--light-color': '#e3f2fd',
                    '--dark-color': '#212121',
                    
                    '--bg-primary': '#ffffff',
                    '--bg-secondary': '#f5f5f5',
                    '--bg-accent': '#e8eaf6',
                    
                    '--text-primary': '#212121',
                    '--text-secondary': '#424242',
                    '--text-muted': '#757575',
                    
                    '--border-color': '#e0e0e0',
                    '--shadow': '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
                    '--shadow-lg': '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
                    
                    '--font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    '--font-size-base': '1rem',
                    '--line-height-base': '1.5',
                    '--border-radius': '0.375rem',
                    '--border-radius-lg': '0.5rem',
                    '--border-radius-sm': '0.25rem'
                }
            },
            green: {
                name: 'Green',
                description: 'Fresh and modern green theme',
                cssVariables: {
                    '--primary-color': '#2e7d32',
                    '--secondary-color': '#5d4037',
                    '--success-color': '#4caf50',
                    '--danger-color': '#d32f2f',
                    '--warning-color': '#f57c00',
                    '--info-color': '#00838f',
                    '--light-color': '#e8f5e9',
                    '--dark-color': '#1b5e20',
                    
                    '--bg-primary': '#ffffff',
                    '--bg-secondary': '#f1f8e9',
                    '--bg-accent': '#e8f5e9',
                    
                    '--text-primary': '#1b5e20',
                    '--text-secondary': '#4caf50',
                    '--text-muted': '#757575',
                    
                    '--border-color': '#c8e6c9',
                    '--shadow': '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
                    '--shadow-lg': '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
                    
                    '--font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    '--font-size-base': '1rem',
                    '--line-height-base': '1.5',
                    '--border-radius': '0.375rem',
                    '--border-radius-lg': '0.5rem',
                    '--border-radius-sm': '0.25rem'
                }
            },
            purple: {
                name: 'Purple',
                description: 'Elegant purple color scheme',
                cssVariables: {
                    '--primary-color': '#7b1fa2',
                    '--secondary-color': '#4527a0',
                    '--success-color': '#6a1b9a',
                    '--danger-color': '#d81b60',
                    '--warning-color': '#ef6c00',
                    '--info-color': '#00acc1',
                    '--light-color': '#f3e5f5',
                    '--dark-color': '#4a148c',
                    
                    '--bg-primary': '#ffffff',
                    '--bg-secondary': '#f3e5f5',
                    '--bg-accent': '#e1bee7',
                    
                    '--text-primary': '#4a148c',
                    '--text-secondary': '#7b1fa2',
                    '--text-muted': '#757575',
                    
                    '--border-color': '#ce93d8',
                    '--shadow': '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
                    '--shadow-lg': '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
                    
                    '--font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    '--font-size-base': '1rem',
                    '--line-height-base': '1.5',
                    '--border-radius': '0.375rem',
                    '--border-radius-lg': '0.5rem',
                    '--border-radius-sm': '0.25rem'
                }
            }
        };
        
        this.currentTheme = 'royal';
        this.element = document.documentElement;
    }
    
    /**
     * Set theme by name
     */
    setTheme(themeName) {
        if (!this.themes[themeName]) {
            console.warn(`Theme '${themeName}' not found. Using default theme.`);
            themeName = 'light';
        }
        
        this.currentTheme = themeName;
        this.applyTheme(themeName);
        
        // Save to localStorage
        localStorage.setItem('app-theme', themeName);
        
        // Dispatch theme change event
        this.dispatchThemeChange(themeName);
    }
    
    /**
     * Get current theme
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
    
    /**
     * Get theme by name
     */
    getTheme(themeName) {
        return this.themes[themeName] || this.themes['light'];
    }
    
    /**
     * Get all available themes
     */
    getThemes() {
        return { ...this.themes };
    }
    
    /**
     * Apply theme to document
     */
    applyTheme(themeName) {
        const theme = this.themes[themeName];
        if (!theme) return;
        
        // Remove existing theme classes
        Object.keys(this.themes).forEach(name => {
            this.element.classList.remove(`theme-${name}`);
        });
        
        // Add current theme class
        this.element.classList.add(`theme-${themeName}`);
        
        // Apply CSS custom properties
        const root = document.documentElement;
        Object.entries(theme.cssVariables).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(theme.cssVariables['--primary-color']);
    }
    
    /**
     * Update meta theme-color for mobile browsers
     */
    updateMetaThemeColor(color) {
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', color);
        }
    }
    
    /**
     * Toggle between Royal (light) and Royal Dark themes
     */
    toggleTheme() {
        const current = this.getCurrentTheme();
        const newTheme = current === 'royal-dark' ? 'royal' : 'royal-dark';
        this.setTheme(newTheme);
    }
    
    /**
     * Dispatch theme change event
     */
    dispatchThemeChange(themeName) {
        const event = new CustomEvent('theme:changed', {
            detail: {
                theme: themeName,
                timestamp: Date.now()
            }
        });
        
        window.dispatchEvent(event);
    }
    
    /**
     * Initialize theme from localStorage or system preference
     * Defaults to the Royal (Purple/Gold/Black/White) theme
     */
    init() {
        // Check localStorage first
        const savedTheme = localStorage.getItem('app-theme');
        if (savedTheme && this.themes[savedTheme]) {
            this.setTheme(savedTheme);
            return;
        }

        // Check system preference — map to Royal variants
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.setTheme('royal-dark');
        } else {
            this.setTheme('royal');
        }
    }
    
    /**
     * Create theme switcher component
     */
    createThemeSwitcher(container) {
        if (!container) return;
        
        const switcher = document.createElement('div');
        switcher.className = 'theme-switcher';
        switcher.innerHTML = `
            <label class="theme-switcher-label">
                <span class="theme-switcher-text">Theme:</span>
                <select class="form-select theme-switcher-select" style="width: auto; display: inline-block;">
                    ${Object.entries(this.themes).map(([name, theme]) => 
                        `<option value="${name}" ${name === this.currentTheme ? 'selected' : ''}>
                            ${theme.name}
                        </option>`
                    ).join('')}
                </select>
            </label>
        `;
        
        container.appendChild(switcher);
        
        // Add event listener
        const select = switcher.querySelector('.theme-switcher-select');
        select.addEventListener('change', (e) => {
            this.setTheme(e.target.value);
        });
        
        return switcher;
    }
    
    /**
     * Create theme preview component
     */
    createThemePreview(container) {
        if (!container) return;
        
        const preview = document.createElement('div');
        preview.className = 'theme-preview';
        preview.innerHTML = `
            <div class="row">
                ${Object.entries(this.themes).map(([name, theme]) => `
                    <div class="col-md-2 mb-3">
                        <div class="theme-card" data-theme="${name}" style="cursor: pointer; border: 2px solid transparent; border-radius: 8px; padding: 15px; transition: all 0.3s ease;">
                            <div style="height: 40px; background: ${theme.cssVariables['--bg-primary']}; border-radius: 4px; margin-bottom: 8px;"></div>
                            <div style="height: 20px; background: ${theme.cssVariables['--primary-color']}; border-radius: 4px; margin-bottom: 8px;"></div>
                            <div style="height: 15px; background: ${theme.cssVariables['--secondary-color']}; border-radius: 4px;"></div>
                            <div style="font-size: 12px; color: ${theme.cssVariables['--text-secondary']}; margin-top: 8px;">
                                ${theme.name}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.appendChild(preview);
        
        // Add click listeners
        const themeCards = preview.querySelectorAll('.theme-card');
        themeCards.forEach(card => {
            card.addEventListener('click', () => {
                const themeName = card.getAttribute('data-theme');
                this.setTheme(themeName);
                
                // Update selection indicators
                themeCards.forEach(c => c.style.borderColor = 'transparent');
                card.style.borderColor = this.themes[themeName].cssVariables['--primary-color'];
            });
        });
        
        return preview;
    }
    
    /**
     * Export current theme
     */
    exportTheme() {
        const theme = this.getTheme(this.currentTheme);
        return {
            name: theme.name,
            description: theme.description,
            cssVariables: { ...theme.cssVariables },
            timestamp: Date.now()
        };
    }
    
    /**
     * Import custom theme
     */
    importTheme(themeData) {
        if (!themeData || !themeData.cssVariables) {
            throw new Error('Invalid theme data');
        }
        
        const themeName = themeData.name || 'custom';
        this.themes[themeName] = {
            name: themeData.name || 'Custom Theme',
            description: themeData.description || 'Custom imported theme',
            cssVariables: { ...themeData.cssVariables }
        };
        
        this.setTheme(themeName);
    }
    
    /**
     * Create custom theme from colors
     */
    createCustomTheme(colors) {
        const customTheme = {
            name: 'Custom',
            description: 'User-defined theme',
            cssVariables: {
                '--primary-color': colors.primary || '#007bff',
                '--secondary-color': colors.secondary || '#6c757d',
                '--success-color': colors.success || '#28a745',
                '--danger-color': colors.danger || '#dc3545',
                '--warning-color': colors.warning || '#ffc107',
                '--info-color': colors.info || '#17a2b8',
                '--light-color': colors.light || '#f8f9fa',
                '--dark-color': colors.dark || '#343a40',
                
                '--bg-primary': colors.bgPrimary || '#ffffff',
                '--bg-secondary': colors.bgSecondary || '#f8f9fa',
                '--bg-accent': colors.bgAccent || '#e9ecef',
                
                '--text-primary': colors.textPrimary || '#212529',
                '--text-secondary': colors.textSecondary || '#6c757d',
                '--text-muted': colors.textMuted || '#6c757d',
                
                '--border-color': colors.borderColor || '#dee2e6',
                '--shadow': '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
                '--shadow-lg': '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
                
                '--font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                '--font-size-base': '1rem',
                '--line-height-base': '1.5',
                '--border-radius': '0.375rem',
                '--border-radius-lg': '0.5rem',
                '--border-radius-sm': '0.25rem'
            }
        };
        
        this.themes.custom = customTheme;
        this.setTheme('custom');
    }
    
    /**
     * Reset to default theme
     */
    resetTheme() {
        this.setTheme('light');
    }
    
    /**
     * Check if theme exists
     */
    hasTheme(themeName) {
        return !!this.themes[themeName];
    }
    
    /**
     * Remove theme
     */
    removeTheme(themeName) {
        if (themeName === this.currentTheme) {
            this.setTheme('light');
        }
        delete this.themes[themeName];
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
} else {
    window.ThemeManager = ThemeManager;
}