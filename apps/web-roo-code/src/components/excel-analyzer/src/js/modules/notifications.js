/**
 * Notifications Module
 * 
 * Handles user notifications, alerts, and feedback messages.
 */

class Notifications {
    constructor(options = {}) {
        this.options = options;
        this.notifications = [];
        this.maxNotifications = 50;
        this.container = null;
        
        this.init();
    }
    
    init() {
        this.createContainer();
        this.setupEventListeners();
    }
    
    /**
     * Create notifications container
     */
    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'notifications-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        
        document.body.appendChild(this.container);
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Auto-dismiss notifications after timeout
        setInterval(() => {
            this.notifications.forEach(notification => {
                if (notification.autoDismiss && Date.now() - notification.timestamp > notification.timeout) {
                    this.removeNotification(notification.id);
                }
            });
        }, 1000);
    }
    
    /**
     * Show success notification
     */
    success(message, options = {}) {
        return this.show({
            type: 'success',
            message: message,
            ...options
        });
    }
    
    /**
     * Show error notification
     */
    error(message, options = {}) {
        return this.show({
            type: 'error',
            message: message,
            ...options
        });
    }
    
    /**
     * Show warning notification
     */
    warning(message, options = {}) {
        return this.show({
            type: 'warning',
            message: message,
            ...options
        });
    }
    
    /**
     * Show info notification
     */
    info(message, options = {}) {
        return this.show({
            type: 'info',
            message: message,
            ...options
        });
    }
    
    /**
     * Show notification
     */
    show(notificationData) {
        const notification = {
            id: this.generateId(),
            type: notificationData.type || 'info',
            message: notificationData.message || '',
            title: notificationData.title || this.getNotificationTitle(notificationData.type),
            timestamp: Date.now(),
            autoDismiss: notificationData.autoDismiss !== false,
            timeout: notificationData.timeout || this.getTimeoutForType(notificationData.type),
            persistent: notificationData.persistent || false,
            actions: notificationData.actions || [],
            onDismiss: notificationData.onDismiss || null
        };
        
        this.notifications.push(notification);
        this.renderNotification(notification);
        
        // Limit notifications
        if (this.notifications.length > this.maxNotifications) {
            const oldest = this.notifications.shift();
            this.removeNotification(oldest.id);
        }
        
        return notification.id;
    }
    
    /**
     * Render notification element
     */
    renderNotification(notification) {
        const element = document.createElement('div');
        element.className = `notification notification-${notification.type}`;
        element.dataset.notificationId = notification.id;
        element.style.cssText = `
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-lg);
            padding: 15px;
            min-width: 250px;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        
        // Icon
        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        icon.innerHTML = this.getNotificationIcon(notification.type);
        icon.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 18px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // Content
        const content = document.createElement('div');
        content.className = 'notification-content';
        content.style.cssText = `
            margin-left: 35px;
            min-height: 24px;
        `;
        
        const title = document.createElement('div');
        title.className = 'notification-title';
        title.textContent = notification.title;
        title.style.cssText = `
            font-weight: 600;
            font-size: 14px;
            color: var(--text-primary);
            margin-bottom: 4px;
        `;
        
        const message = document.createElement('div');
        message.className = 'notification-message';
        message.textContent = notification.message;
        message.style.cssText = `
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.4;
        `;
        
        content.appendChild(title);
        content.appendChild(message);
        
        // Actions
        if (notification.actions.length > 0) {
            const actions = document.createElement('div');
            actions.className = 'notification-actions';
            actions.style.cssText = `
                margin-left: 35px;
                display: flex;
                gap: 8px;
                margin-top: 8px;
            `;
            
            notification.actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'btn btn-sm btn-outline-secondary';
                button.textContent = action.label;
                button.style.cssText = `
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    border: 1px solid var(--border-color);
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                `;
                
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (action.onClick) {
                        action.onClick(notification);
                    }
                    this.removeNotification(notification.id);
                });
                
                actions.appendChild(button);
            });
            
            content.appendChild(actions);
        }
        
        // Dismiss button
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'notification-dismiss';
        dismissBtn.innerHTML = '&times;';
        dismissBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: transparent;
            border: none;
            font-size: 20px;
            color: var(--text-muted);
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background-color 0.2s;
        `;
        
        dismissBtn.addEventListener('mouseenter', () => {
            dismissBtn.style.backgroundColor = 'var(--bg-secondary)';
        });
        
        dismissBtn.addEventListener('mouseleave', () => {
            dismissBtn.style.backgroundColor = 'transparent';
        });
        
        dismissBtn.addEventListener('click', () => {
            this.removeNotification(notification.id);
        });
        
        element.appendChild(icon);
        element.appendChild(content);
        element.appendChild(dismissBtn);
        
        this.container.appendChild(element);
        
        // Trigger animation
        setTimeout(() => {
            element.style.animation = 'none';
        }, 300);
    }
    
    /**
     * Remove notification
     */
    removeNotification(id) {
        const index = this.notifications.findIndex(n => n.id === id);
        if (index === -1) return;
        
        const notification = this.notifications[index];
        const element = this.container.querySelector(`[data-notification-id="${id}"]`);
        
        if (element) {
            element.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }, 300);
        }
        
        this.notifications.splice(index, 1);
        
        // Call dismiss callback
        if (notification.onDismiss) {
            notification.onDismiss(notification);
        }
    }
    
    /**
     * Clear all notifications
     */
    clear() {
        this.notifications.forEach(notification => {
            this.removeNotification(notification.id);
        });
    }
    
    /**
     * Get notification title
     */
    getNotificationTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        return titles[type] || 'Notification';
    }
    
    /**
     * Get notification icon
     */
    getNotificationIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || 'ℹ';
    }
    
    /**
     * Get timeout for notification type
     */
    getTimeoutForType(type) {
        const timeouts = {
            success: 3000,
            error: 5000,
            warning: 4000,
            info: 3000
        };
        return timeouts[type] || 3000;
    }
    
    /**
     * Generate unique ID
     */
    generateId() {
        return 'notification-' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Show loading notification
     */
    loading(message, options = {}) {
        const notification = {
            id: this.generateId(),
            type: 'loading',
            message: message,
            title: 'Processing',
            timestamp: Date.now(),
            autoDismiss: false,
            persistent: true,
            actions: [],
            onDismiss: null
        };
        
        this.notifications.push(notification);
        this.renderLoadingNotification(notification);
        
        return notification.id;
    }
    
    /**
     * Render loading notification
     */
    renderLoadingNotification(notification) {
        const element = document.createElement('div');
        element.className = `notification notification-loading`;
        element.dataset.notificationId = notification.id;
        element.style.cssText = `
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-lg);
            padding: 15px;
            min-width: 250px;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
            position: relative;
            display: flex;
            align-items: center;
            gap: 12px;
        `;
        
        // Spinner
        const spinner = document.createElement('div');
        spinner.className = 'notification-spinner';
        spinner.style.cssText = `
            width: 20px;
            height: 20px;
            border: 2px solid var(--border-color);
            border-top: 2px solid var(--primary-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        `;
        
        // Content
        const content = document.createElement('div');
        content.className = 'notification-content';
        content.style.cssText = `
            flex: 1;
            font-size: 14px;
            color: var(--text-primary);
        `;
        
        content.textContent = notification.message;
        
        element.appendChild(spinner);
        element.appendChild(content);
        
        this.container.appendChild(element);
    }
    
    /**
     * Update loading notification
     */
    updateLoading(id, message) {
        const element = this.container.querySelector(`[data-notification-id="${id}"]`);
        if (element) {
            const content = element.querySelector('.notification-content');
            if (content) {
                content.textContent = message;
            }
        }
    }
    
    /**
     * Complete loading notification
     */
    completeLoading(id, success = true, message = null) {
        const element = this.container.querySelector(`[data-notification-id="${id}"]`);
        if (element) {
            const type = success ? 'success' : 'error';
            const title = success ? 'Completed' : 'Failed';
            const icon = success ? '✓' : '✗';
            
            // Update content
            const content = element.querySelector('.notification-content');
            if (content) {
                content.textContent = message || (success ? 'Operation completed successfully' : 'Operation failed');
            }
            
            // Update styles
            element.className = `notification notification-${type}`;
            element.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue(`--${type}-color`);
            
            // Update spinner to icon
            const spinner = element.querySelector('.notification-spinner');
            if (spinner) {
                spinner.outerHTML = `<div class="notification-icon" style="position: relative; font-size: 18px; color: var(--${type}-color)">${icon}</div>`;
            }
            
            // Auto-dismiss after delay
            setTimeout(() => {
                this.removeNotification(id);
            }, success ? 2000 : 4000);
        }
    }
    
    /**
     * Show confirmation dialog
     */
    confirm(message, options = {}) {
        return new Promise((resolve) => {
            const notification = {
                id: this.generateId(),
                type: 'confirm',
                message: message,
                title: options.title || 'Confirm Action',
                timestamp: Date.now(),
                autoDismiss: false,
                persistent: true,
                actions: [
                    {
                        label: options.cancelLabel || 'Cancel',
                        onClick: () => resolve(false)
                    },
                    {
                        label: options.confirmLabel || 'Confirm',
                        onClick: () => resolve(true)
                    }
                ],
                onDismiss: () => resolve(false)
            };
            
            this.notifications.push(notification);
            this.renderNotification(notification);
        });
    }
    
    /**
     * Show prompt dialog
     */
    prompt(message, options = {}) {
        return new Promise((resolve) => {
            const notification = {
                id: this.generateId(),
                type: 'prompt',
                message: message,
                title: options.title || 'Input Required',
                timestamp: Date.now(),
                autoDismiss: false,
                persistent: true,
                actions: [
                    {
                        label: options.cancelLabel || 'Cancel',
                        onClick: () => resolve(null)
                    },
                    {
                        label: options.confirmLabel || 'Submit',
                        onClick: (notification) => {
                            const input = document.querySelector(`[data-notification-id="${notification.id}"] input`);
                            resolve(input ? input.value : null);
                        }
                    }
                ],
                onDismiss: () => resolve(null)
            };
            
            this.notifications.push(notification);
            this.renderPromptNotification(notification);
        });
    }
    
    /**
     * Render prompt notification
     */
    renderPromptNotification(notification) {
        const element = document.createElement('div');
        element.className = `notification notification-prompt`;
        element.dataset.notificationId = notification.id;
        element.style.cssText = `
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-lg);
            padding: 15px;
            min-width: 300px;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        
        // Title
        const title = document.createElement('div');
        title.className = 'notification-title';
        title.textContent = notification.title;
        title.style.cssText = `
            font-weight: 600;
            font-size: 14px;
            color: var(--text-primary);
        `;
        
        // Message
        const message = document.createElement('div');
        message.className = 'notification-message';
        message.textContent = notification.message;
        message.style.cssText = `
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.4;
        `;
        
        // Input
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter your response...';
        input.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            font-size: 14px;
            color: var(--text-primary);
            background: var(--bg-secondary);
        `;
        
        // Actions
        const actions = document.createElement('div');
        actions.className = 'notification-actions';
        actions.style.cssText = `
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        `;
        
        notification.actions.forEach(action => {
            const button = document.createElement('button');
            button.className = 'btn btn-sm';
            button.textContent = action.label;
            button.style.cssText = `
                font-size: 12px;
                padding: 6px 12px;
                border-radius: 4px;
                border: 1px solid var(--border-color);
                background: ${action.label.toLowerCase().includes('cancel') ? 'transparent' : 'var(--primary-color)'};
                color: ${action.label.toLowerCase().includes('cancel') ? 'var(--text-secondary)' : 'white'};
                cursor: pointer;
            `;
            
            button.addEventListener('click', (e) => {
                e.preventDefault();
                if (action.onClick) {
                    action.onClick(notification);
                }
                this.removeNotification(notification.id);
            });
            
            actions.appendChild(button);
        });
        
        element.appendChild(title);
        element.appendChild(message);
        element.appendChild(input);
        element.appendChild(actions);
        
        this.container.appendChild(element);
        
        // Focus input
        setTimeout(() => input.focus(), 100);
    }
    
    /**
     * Get notification statistics
     */
    getStats() {
        const stats = {
            total: this.notifications.length,
            byType: {},
            oldest: null,
            newest: null
        };
        
        this.notifications.forEach(notification => {
            stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
        });
        
        if (this.notifications.length > 0) {
            stats.oldest = this.notifications[0];
            stats.newest = this.notifications[this.notifications.length - 1];
        }
        
        return stats;
    }
    
    /**
     * Export notifications
     */
    exportNotifications() {
        return {
            notifications: this.notifications,
            stats: this.getStats(),
            exportedAt: new Date().toISOString()
        };
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .notifications-container {
        --primary-color: #007bff;
        --secondary-color: #6c757d;
        --success-color: #28a745;
        --danger-color: #dc3545;
        --warning-color: #ffc107;
        --info-color: #17a2b8;
        --bg-primary: #ffffff;
        --bg-secondary: #f8f9fa;
        --text-primary: #212529;
        --text-secondary: #6c757d;
        --text-muted: #6c757d;
        --border-color: #dee2e6;
        --shadow-lg: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
        --border-radius: 0.375rem;
    }
    
    .notification {
        transition: all 0.3s ease;
    }
    
    .notification:hover {
        transform: translateY(-2px);
        box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.1);
    }
    
    .notification.notification-success {
        border-color: var(--success-color);
    }
    
    .notification.notification-error {
        border-color: var(--danger-color);
    }
    
    .notification.notification-warning {
        border-color: var(--warning-color);
    }
    
    .notification.notification-info {
        border-color: var(--info-color);
    }
    
    .notification.notification-loading {
        border-color: var(--primary-color);
    }
    
    .notification.notification-confirm,
    .notification.notification-prompt {
        border-color: var(--info-color);
    }
`;
document.head.appendChild(style);

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Notifications;
} else {
    window.Notifications = Notifications;
}