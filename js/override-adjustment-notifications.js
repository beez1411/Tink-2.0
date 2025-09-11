/**
 * Override Adjustment Notification System
 * 
 * Handles popup notifications for suggested override adjustments
 * based on sales trend analysis
 */

class OverrideAdjustmentNotifications {
    constructor() {
        this.notifications = [];
        this.isInitialized = false;
        this.notificationContainer = null;
    }

    /**
     * Initialize the notification system
     */
    initialize() {
        if (this.isInitialized) return;

        // Create notification container
        this.createNotificationContainer();
        
        // Add CSS styles
        this.addNotificationStyles();
        
        this.isInitialized = true;
        console.log('Override Adjustment Notifications initialized');
    }

    /**
     * Create the notification container
     */
    createNotificationContainer() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.id = 'override-notifications-container';
        this.notificationContainer.className = 'override-notifications-container';
        document.body.appendChild(this.notificationContainer);
    }

    /**
     * Add CSS styles for notifications
     */
    addNotificationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .override-notifications-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            }

            .override-notification {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 15px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                animation: slideInRight 0.5s ease-out;
                position: relative;
                overflow: hidden;
            }

            .override-notification::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #4CAF50, #2196F3, #FF9800);
            }

            .override-notification-header {
                display: flex;
                align-items: center;
                margin-bottom: 12px;
            }

            .override-notification-icon {
                font-size: 24px;
                margin-right: 12px;
            }

            .override-notification-title {
                font-size: 16px;
                font-weight: 600;
                margin: 0;
            }

            .override-notification-content {
                margin-bottom: 16px;
                line-height: 1.5;
            }

            .override-notification-sku {
                font-weight: 600;
                color: #FFD700;
            }

            .override-notification-metrics {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 12px;
                margin: 12px 0;
                font-size: 14px;
            }

            .override-notification-metric {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
            }

            .override-notification-metric:last-child {
                margin-bottom: 0;
            }

            .override-notification-actions {
                display: flex;
                gap: 10px;
                margin-top: 16px;
            }

            .override-notification-btn {
                flex: 1;
                padding: 10px 16px;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 14px;
            }

            .override-notification-btn-accept {
                background: #4CAF50;
                color: white;
            }

            .override-notification-btn-accept:hover {
                background: #45a049;
                transform: translateY(-2px);
            }

            .override-notification-btn-dismiss {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
            }

            .override-notification-btn-dismiss:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-2px);
            }

            .override-notification-close {
                position: absolute;
                top: 10px;
                right: 10px;
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                opacity: 0.7;
                transition: opacity 0.3s ease;
            }

            .override-notification-close:hover {
                opacity: 1;
            }

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

            .override-notification.removing {
                animation: slideOutRight 0.3s ease-in forwards;
            }

            .confidence-high { color: #4CAF50; }
            .confidence-medium { color: #FF9800; }
            .confidence-low { color: #f44336; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show override adjustment suggestions
     */
    async showOverrideAdjustmentSuggestions(suggestions) {
        if (!this.isInitialized) {
            this.initialize();
        }

        for (const suggestion of suggestions.slice(0, 3)) { // Show max 3 at a time
            this.showSingleSuggestion(suggestion);
        }
    }

    /**
     * Show a single override adjustment suggestion
     */
    showSingleSuggestion(suggestion) {
        const notification = document.createElement('div');
        notification.className = 'override-notification';
        notification.dataset.sku = suggestion.sku;

        const confidenceClass = this.getConfidenceClass(suggestion.confidence);
        const confidencePercent = Math.round(suggestion.confidence * 100);

        notification.innerHTML = `
            <button class="override-notification-close" onclick="this.parentElement.remove()">×</button>
            
            <div class="override-notification-header">
                <span class="override-notification-icon">📈</span>
                <h4 class="override-notification-title">Override Adjustment Suggestion</h4>
            </div>

            <div class="override-notification-content">
                <div>Sales have increased for <span class="override-notification-sku">${suggestion.sku}</span></div>
                <div style="margin-top: 8px; font-size: 14px; opacity: 0.9;">
                    ${suggestion.reason}
                </div>
            </div>

            <div class="override-notification-metrics">
                <div class="override-notification-metric">
                    <span>Current Override:</span>
                    <span><strong>${suggestion.currentOverride}</strong></span>
                </div>
                <div class="override-notification-metric">
                    <span>Suggested Quantity:</span>
                    <span><strong>${suggestion.suggestedQuantity}</strong></span>
                </div>
                <div class="override-notification-metric">
                    <span>Sales Growth:</span>
                    <span><strong>+${suggestion.growthRate.toFixed(1)}%</strong></span>
                </div>
                <div class="override-notification-metric">
                    <span>Confidence:</span>
                    <span class="${confidenceClass}"><strong>${confidencePercent}%</strong></span>
                </div>
            </div>

            <div class="override-notification-actions">
                <button class="override-notification-btn override-notification-btn-accept" 
                        onclick="window.overrideNotifications.acceptSuggestion('${suggestion.sku}', ${suggestion.suggestedQuantity}, '${suggestion.reason}')">
                    Accept Suggestion
                </button>
                <button class="override-notification-btn override-notification-btn-dismiss" 
                        onclick="window.overrideNotifications.dismissSuggestion('${suggestion.sku}')">
                    Keep Current
                </button>
            </div>
        `;

        this.notificationContainer.appendChild(notification);

        // Auto-dismiss after 30 seconds if no action taken
        setTimeout(() => {
            if (notification.parentElement) {
                this.dismissNotification(notification);
            }
        }, 30000);
    }

    /**
     * Get CSS class for confidence level
     */
    getConfidenceClass(confidence) {
        if (confidence >= 0.8) return 'confidence-high';
        if (confidence >= 0.6) return 'confidence-medium';
        return 'confidence-low';
    }

    /**
     * Accept an override adjustment suggestion
     */
    async acceptSuggestion(sku, newQuantity, reason) {
        try {
            // Call the intelligent feedback learning system
            if (window.intelligentFeedback) {
                const success = await window.intelligentFeedback.acceptOverrideAdjustment(sku, newQuantity, reason);
                
                if (success) {
                    this.showSuccessMessage(`Override updated for ${sku}: Now recommending ${newQuantity} units`);
                    
                    // Update any current order displays
                    this.updateOrderDisplays(sku, newQuantity);
                } else {
                    this.showErrorMessage('Failed to update override. Please try again.');
                }
            }
            
            // Remove the notification
            this.removeNotificationBySku(sku);
            
        } catch (error) {
            console.error('Error accepting suggestion:', error);
            this.showErrorMessage('Error updating override: ' + error.message);
        }
    }

    /**
     * Dismiss a suggestion
     */
    dismissSuggestion(sku) {
        this.removeNotificationBySku(sku);
        
        // Optionally record that this suggestion was dismissed
        console.log(`Override adjustment suggestion dismissed for ${sku}`);
    }

    /**
     * Remove notification by SKU
     */
    removeNotificationBySku(sku) {
        const notification = this.notificationContainer.querySelector(`[data-sku="${sku}"]`);
        if (notification) {
            this.dismissNotification(notification);
        }
    }

    /**
     * Dismiss a notification with animation
     */
    dismissNotification(notification) {
        notification.classList.add('removing');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }

    /**
     * Update order displays with new override
     */
    updateOrderDisplays(sku, newQuantity) {
        // Find and update any order table rows for this SKU
        const orderRows = document.querySelectorAll('#orderTableBody tr');
        
        for (const row of orderRows) {
            const skuCell = row.querySelector('td:first-child');
            if (skuCell && skuCell.textContent.trim() === sku) {
                const qtyInput = row.querySelector('.qty-input');
                if (qtyInput) {
                    qtyInput.value = newQuantity;
                    // Trigger any change events
                    qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                break;
            }
        }
    }

    /**
     * Show success message
     */
    showSuccessMessage(message) {
        const notification = document.createElement('div');
        notification.className = 'override-notification';
        notification.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
        
        notification.innerHTML = `
            <div class="override-notification-header">
                <span class="override-notification-icon">✅</span>
                <h4 class="override-notification-title">Success</h4>
            </div>
            <div class="override-notification-content">${message}</div>
        `;

        this.notificationContainer.appendChild(notification);

        setTimeout(() => {
            this.dismissNotification(notification);
        }, 5000);
    }

    /**
     * Show error message
     */
    showErrorMessage(message) {
        const notification = document.createElement('div');
        notification.className = 'override-notification';
        notification.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
        
        notification.innerHTML = `
            <div class="override-notification-header">
                <span class="override-notification-icon">❌</span>
                <h4 class="override-notification-title">Error</h4>
            </div>
            <div class="override-notification-content">${message}</div>
        `;

        this.notificationContainer.appendChild(notification);

        setTimeout(() => {
            this.dismissNotification(notification);
        }, 8000);
    }

    /**
     * Clear all notifications
     */
    clearAllNotifications() {
        const notifications = this.notificationContainer.querySelectorAll('.override-notification');
        notifications.forEach(notification => {
            this.dismissNotification(notification);
        });
    }
}

// Make it globally available
window.overrideNotifications = new OverrideAdjustmentNotifications();
