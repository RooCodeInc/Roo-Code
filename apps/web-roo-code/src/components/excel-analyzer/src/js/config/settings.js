/**
 * Settings Manager of Web Application
 *
 * Lightweight settings storage for the Excel Analyzer app.
 */

class SettingsManager {
    constructor() {
        this.storageKey = 'excel-analyzer-settings';
        this.defaultSettings = {
            maxFileSize: 50 * 1024 * 1024,
            maxRows: 10000,
            previewRows: 100,
            theme: 'light',
            ui: {
                theme: 'light'
            },
            dashboard: {
                layout: 'layout1'
            },
            export: {
                includeCharts: true,
                includeData: true,
                includeSummary: true
            }
        };

        this.settings = this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return this.clone(this.defaultSettings);
            const parsed = JSON.parse(raw);
            return this.merge(this.defaultSettings, parsed);
        } catch (error) {
            console.warn('Failed to load settings, using defaults.', error);
            return this.clone(this.defaultSettings);
        }
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save settings.', error);
        }
    }

    get(path, fallback = null) {
        if (!path) return this.settings;
        const keys = path.split('.');
        let current = this.settings;

        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return fallback;
            }
        }

        return current;
    }

    set(path, value) {
        const keys = path.split('.');
        let current = this.settings;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
        this.save();
    }

    update(values = {}) {
        this.settings = this.merge(this.settings, values);
        this.save();
    }

    reset() {
        this.settings = this.clone(this.defaultSettings);
        this.save();
    }

    clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    merge(base, extra) {
        const merged = this.clone(base);
        Object.keys(extra || {}).forEach((key) => {
            const baseValue = merged[key];
            const extraValue = extra[key];

            if (
                baseValue &&
                typeof baseValue === 'object' &&
                !Array.isArray(baseValue) &&
                extraValue &&
                typeof extraValue === 'object' &&
                !Array.isArray(extraValue)
            ) {
                merged[key] = this.merge(baseValue, extraValue);
            } else {
                merged[key] = extraValue;
            }
        });
        return merged;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsManager;
} else {
    window.SettingsManager = SettingsManager;
}
