/**
 * Enhanced Phantom Inventory Renderer
 * Handles UI interactions for phantom inventory detection system
 */

class PhantomInventoryRenderer {
    constructor() {
        this.isSetupComplete = false;
        this.currentStore = null;
        this.phantomResults = null;
        this.systemStats = null;
        
        this.initializeEventListeners();
        this.checkSetupStatus();
    }

    /**
     * Initialize event listeners for phantom inventory UI
     */
    initializeEventListeners() {
        // Store selection dropdown
        const storeSelect = document.getElementById('phantomStoreSelect');
        const initializeBtn = document.getElementById('initializePhantomSystemBtn');
        
        if (storeSelect) {
            storeSelect.addEventListener('change', (e) => {
                initializeBtn.disabled = !e.target.value;
            });
        }

        // Setup button
        if (initializeBtn) {
            initializeBtn.addEventListener('click', () => this.initializePhantomSystem());
        }

        // Main phantom inventory button
        const phantomBtn = document.getElementById('runPhantomInventoryBtn');
        if (phantomBtn) {
            phantomBtn.addEventListener('click', () => this.showPhantomInventoryPanel());
        }

        // Phantom control buttons
        const analyzeBtn = document.getElementById('analyzePhantomBtn');
        const verificationBtn = document.getElementById('generateVerificationListBtn');
        const reportBtn = document.getElementById('phantomReportBtn');
        const statsBtn = document.getElementById('phantomStatsBtn');

        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzePhantomInventory());
        }
        if (verificationBtn) {
            verificationBtn.addEventListener('click', () => this.generateVerificationList());
        }
        if (reportBtn) {
            reportBtn.addEventListener('click', () => this.generatePhantomReport());
        }
        if (statsBtn) {
            statsBtn.addEventListener('click', () => this.showSystemStats());
        }

        // Collapsible panel
        const phantomToggle = document.getElementById('phantomInventoryToggle');
        if (phantomToggle) {
            phantomToggle.addEventListener('click', () => this.togglePhantomPanel());
        }
    }

    /**
     * Check if phantom system setup is complete
     */
    async checkSetupStatus() {
        try {
            const response = await window.electronAPI.invoke('phantom-get-status');
            if (response.success) {
                const status = response.data;
                this.isSetupComplete = status.isSetup;
                this.currentStore = status.currentStore;
                
                if (this.isSetupComplete) {
                    this.showMainInterface();
                    this.enablePhantomButton();
                    this.updateStoreInfo();
                } else {
                    this.showSetupInterface();
                }
            }
        } catch (error) {
            console.error('Error checking phantom setup status:', error);
            this.showSetupInterface();
        }
    }

    /**
     * Initialize phantom inventory system
     */
    async initializePhantomSystem() {
        const storeSelect = document.getElementById('phantomStoreSelect');
        const initializeBtn = document.getElementById('initializePhantomSystemBtn');
        
        if (!storeSelect.value) {
            this.showError('Please select a store first');
            return;
        }

        try {
            initializeBtn.disabled = true;
            initializeBtn.textContent = 'Initializing...';
            
            const response = await window.electronAPI.invoke('phantom-complete-setup', storeSelect.value);
            
            if (response.success) {
                this.isSetupComplete = true;
                this.currentStore = response.store;
                this.showSuccess('Phantom Inventory System initialized successfully!');
                
                // Switch to main interface
                setTimeout(() => {
                    this.showMainInterface();
                    this.enablePhantomButton();
                    this.updateStoreInfo();
                }, 1500);
            } else {
                this.showError(`Setup failed: ${response.error}`);
            }
        } catch (error) {
            console.error('Error initializing phantom system:', error);
            this.showError('Failed to initialize phantom system');
        } finally {
            initializeBtn.disabled = false;
            initializeBtn.textContent = 'Initialize Enhanced System';
        }
    }

    /**
     * Show phantom inventory panel
     */
    showPhantomInventoryPanel() {
        const phantomSection = document.getElementById('phantomInventorySection');
        const phantomCollapsible = document.getElementById('phantomCollapsibleContent');
        
        if (phantomSection && phantomCollapsible) {
            phantomSection.style.display = 'block';
            phantomCollapsible.style.display = 'block';
            
            // Scroll to panel
            phantomSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Toggle phantom inventory panel
     */
    togglePhantomPanel() {
        const phantomCollapsible = document.getElementById('phantomCollapsibleContent');
        const arrow = document.querySelector('#phantomInventoryToggle .dropdown-arrow');
        
        if (phantomCollapsible) {
            const isVisible = phantomCollapsible.style.display === 'block';
            phantomCollapsible.style.display = isVisible ? 'none' : 'block';
            
            if (arrow) {
                arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        }
    }

    /**
     * Show setup interface
     */
    showSetupInterface() {
        const setupSection = document.getElementById('phantomSetupSection');
        const mainInterface = document.getElementById('phantomMainInterface');
        
        if (setupSection) setupSection.style.display = 'block';
        if (mainInterface) mainInterface.style.display = 'none';
    }

    /**
     * Show main interface
     */
    showMainInterface() {
        const setupSection = document.getElementById('phantomSetupSection');
        const mainInterface = document.getElementById('phantomMainInterface');
        
        if (setupSection) setupSection.style.display = 'none';
        if (mainInterface) {
            mainInterface.style.display = 'block';
            mainInterface.classList.add('setup-success');
        }
    }

    /**
     * Enable phantom inventory button
     */
    enablePhantomButton() {
        const phantomBtn = document.getElementById('runPhantomInventoryBtn');
        if (phantomBtn) {
            phantomBtn.disabled = false;
        }
    }

    /**
     * Update store info display
     */
    updateStoreInfo() {
        const storeInfo = document.getElementById('phantomStoreInfo');
        const networkStatus = document.getElementById('phantomNetworkStatus');
        
        if (storeInfo && this.currentStore) {
            storeInfo.textContent = this.currentStore.displayName;
        }
        
        if (networkStatus) {
            networkStatus.textContent = 'Network Connected';
            networkStatus.className = 'network-status';
        }
    }

    /**
     * Analyze phantom inventory
     */
    async analyzePhantomInventory() {
        try {
            // Get current inventory data
            const inventoryData = await this.getCurrentInventoryData();
            if (!inventoryData) {
                this.showError('No inventory data available. Please import inventory file first.');
                return;
            }

            this.showLoading('Analyzing phantom inventory...');
            
            const response = await window.electronAPI.invoke('phantom-analyze-inventory', inventoryData);
            
            if (response.success) {
                this.phantomResults = response.data;
                this.displayPhantomResults();
                this.showSuccess(`Found ${this.phantomResults.phantomCandidates.length} phantom inventory candidates`);
            } else {
                this.showError(`Analysis failed: ${response.error}`);
            }
        } catch (error) {
            console.error('Error analyzing phantom inventory:', error);
            this.showError('Failed to analyze phantom inventory');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Generate verification list
     */
    async generateVerificationList() {
        try {
            const inventoryData = await this.getCurrentInventoryData();
            if (!inventoryData) {
                this.showError('No inventory data available. Please import inventory file first.');
                return;
            }

            this.showLoading('Generating verification list...');
            
            const response = await window.electronAPI.invoke('phantom-generate-verification-list', inventoryData);
            
            if (response.success) {
                const result = response.data;
                this.showSuccess(`Generated verification list: ${result.dailyList} items across ${result.locationGroups} locations`);
                this.displayVerificationInfo(result);
            } else {
                this.showError(`Failed to generate verification list: ${response.error}`);
            }
        } catch (error) {
            console.error('Error generating verification list:', error);
            this.showError('Failed to generate verification list');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Generate phantom report
     */
    async generatePhantomReport() {
        try {
            this.showLoading('Generating comprehensive report...');
            
            const response = await window.electronAPI.invoke('phantom-generate-report');
            
            if (response.success) {
                const report = response.data;
                this.showSuccess(`Report generated: ${report.filename}`);
                this.displayReportInfo(report);
            } else {
                this.showError(`Failed to generate report: ${response.error}`);
            }
        } catch (error) {
            console.error('Error generating report:', error);
            this.showError('Failed to generate report');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Show system statistics
     */
    async showSystemStats() {
        try {
            this.showLoading('Loading system statistics...');
            
            const response = await window.electronAPI.invoke('phantom-get-stats');
            
            if (response.success) {
                this.systemStats = response.data;
                this.displaySystemStats();
            } else {
                this.showError(`Failed to load stats: ${response.error}`);
            }
        } catch (error) {
            console.error('Error loading system stats:', error);
            this.showError('Failed to load system statistics');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Get current inventory data
     */
    async getCurrentInventoryData() {
        // This should integrate with your existing inventory loading logic
        // For now, we'll assume the inventory data is available globally
        if (window.currentInventoryData) {
            return window.currentInventoryData;
        }
        
        // Try to get from file input
        const fileInput = document.getElementById('fileInput');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            // Parse the file - this should match your existing file parsing logic
            return await this.parseInventoryFile(fileInput.files[0]);
        }
        
        return null;
    }

    /**
     * Parse inventory file
     */
    async parseInventoryFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n');
                    const headers = lines[0].split('\t');
                    
                    const data = lines.slice(1).map(line => {
                        const values = line.split('\t');
                        const item = {};
                        headers.forEach((header, index) => {
                            item[header] = values[index] || '';
                        });
                        return item;
                    }).filter(item => item.PARTNUMBER); // Filter out empty rows
                    
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Display phantom inventory results
     */
    displayPhantomResults() {
        const resultsContent = document.getElementById('phantomResultsContent');
        if (!resultsContent || !this.phantomResults) return;

        const html = `
            <div class="phantom-stats-grid">
                <div class="phantom-stat-card">
                    <h4>Total Items Analyzed</h4>
                    <div class="stat-value">${this.phantomResults.totalItems.toLocaleString()}</div>
                    <div class="stat-label">Inventory Items</div>
                </div>
                <div class="phantom-stat-card">
                    <h4>Phantom Candidates</h4>
                    <div class="stat-value">${this.phantomResults.phantomCandidates.length}</div>
                    <div class="stat-label">High Risk Items</div>
                </div>
                <div class="phantom-stat-card">
                    <h4>Total Value at Risk</h4>
                    <div class="stat-value">$${this.calculateTotalValue().toLocaleString()}</div>
                    <div class="stat-label">Potential Loss</div>
                </div>
            </div>
            
            ${this.renderRecommendations()}
            ${this.renderCategoryBreakdown()}
            ${this.renderPhantomCandidatesTable()}
            ${this.renderNetworkInsights()}
        `;
        
        resultsContent.innerHTML = html;
    }

    /**
     * Calculate total value at risk
     */
    calculateTotalValue() {
        if (!this.phantomResults) return 0;
        
        return this.phantomResults.phantomCandidates.reduce((total, candidate) => {
            return total + parseFloat(candidate.estimatedValue || 0);
        }, 0);
    }

    /**
     * Render recommendations
     */
    renderRecommendations() {
        if (!this.phantomResults.verificationRecommendations?.length) return '';
        
        const recommendations = this.phantomResults.verificationRecommendations.map(rec => `
            <div class="recommendation-item">
                <h5>${rec.title}</h5>
                <p>${rec.message}</p>
                ${rec.items ? `<ul>${rec.items.map(item => `<li>${item}</li>`).join('')}</ul>` : ''}
            </div>
        `).join('');
        
        return `
            <div class="phantom-recommendations">
                <h4>🎯 Verification Recommendations</h4>
                ${recommendations}
            </div>
        `;
    }

    /**
     * Render category breakdown
     */
    renderCategoryBreakdown() {
        if (!this.phantomResults.categoryBreakdown) return '';
        
        const categories = Object.entries(this.phantomResults.categoryBreakdown).map(([category, data]) => `
            <div class="category-card">
                <h5>${category}</h5>
                <div class="category-stats">
                    <span>${data.count} items</span>
                    <span>$${data.totalValue.toFixed(2)}</span>
                </div>
            </div>
        `).join('');
        
        return `
            <div class="category-breakdown">
                ${categories}
            </div>
        `;
    }

    /**
     * Render phantom candidates table
     */
    renderPhantomCandidatesTable() {
        if (!this.phantomResults.phantomCandidates?.length) return '';
        
        const rows = this.phantomResults.phantomCandidates.slice(0, 50).map(candidate => `
            <tr>
                <td>${candidate.partNumber}</td>
                <td>${candidate.description}</td>
                <td>${candidate.currentStock}</td>
                <td>$${candidate.unitCost.toFixed(2)}</td>
                <td>$${candidate.estimatedValue}</td>
                <td><span class="risk-score ${this.getRiskClass(candidate.riskScore)}">${candidate.riskScore}</span></td>
                <td><span class="priority-indicator ${this.getPriorityClass(candidate.verificationPriority)}">${candidate.verificationPriority}</span></td>
                <td>${candidate.category}</td>
                <td>${candidate.location}</td>
            </tr>
        `).join('');
        
        return `
            <table class="phantom-candidates-table">
                <thead>
                    <tr>
                        <th>Part Number</th>
                        <th>Description</th>
                        <th>Stock</th>
                        <th>Unit Cost</th>
                        <th>Est. Value</th>
                        <th>Risk Score</th>
                        <th>Priority</th>
                        <th>Category</th>
                        <th>Location</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            ${this.phantomResults.phantomCandidates.length > 50 ? `<p><em>Showing top 50 of ${this.phantomResults.phantomCandidates.length} candidates</em></p>` : ''}
        `;
    }

    /**
     * Render network insights
     */
    renderNetworkInsights() {
        if (!this.phantomResults.networkInsights?.length) return '';
        
        const insights = this.phantomResults.networkInsights.map(insight => `
            <div class="network-insight-item">
                <strong>${insight.type}:</strong> ${insight.message}
            </div>
        `).join('');
        
        return `
            <div class="network-insights">
                <h4>🌐 Network Insights</h4>
                ${insights}
            </div>
        `;
    }

    /**
     * Get risk class for styling
     */
    getRiskClass(score) {
        if (score >= 85) return 'high';
        if (score >= 70) return 'medium';
        return 'low';
    }

    /**
     * Get priority class for styling
     */
    getPriorityClass(priority) {
        if (priority >= 90) return 'urgent';
        if (priority >= 80) return 'high';
        if (priority >= 70) return 'medium';
        return 'low';
    }

    /**
     * Display verification info
     */
    displayVerificationInfo(result) {
        const resultsContent = document.getElementById('phantomResultsContent');
        if (!resultsContent) return;

        const html = `
            <div class="phantom-success">
                <h5>✅ Verification List Generated</h5>
                <p>Created verification sheets for ${result.dailyList} items across ${result.locationGroups} location groups.</p>
                <p>Estimated verification time: ${result.estimatedTime} minutes</p>
                <p>High priority items: ${result.highPriorityItems}</p>
            </div>
        `;
        
        resultsContent.innerHTML = html;
    }

    /**
     * Display report info
     */
    displayReportInfo(report) {
        const resultsContent = document.getElementById('phantomResultsContent');
        if (!resultsContent) return;

        const html = `
            <div class="phantom-success">
                <h5>📊 Comprehensive Report Generated</h5>
                <p>Report saved as: <strong>${report.filename}</strong></p>
                <p>The report includes system statistics, category performance, and network recommendations.</p>
            </div>
        `;
        
        resultsContent.innerHTML = html;
    }

    /**
     * Display system statistics
     */
    displaySystemStats() {
        const resultsContent = document.getElementById('phantomResultsContent');
        if (!resultsContent || !this.systemStats) return;

        const html = `
            <div class="phantom-stats-grid">
                <div class="phantom-stat-card">
                    <h4>ML Accuracy</h4>
                    <div class="stat-value">${this.systemStats.systemHealth.mlAccuracy.toFixed(1)}%</div>
                    <div class="stat-label">Prediction Accuracy</div>
                </div>
                <div class="phantom-stat-card">
                    <h4>Total Verifications</h4>
                    <div class="stat-value">${this.systemStats.mlStats.totalVerifications}</div>
                    <div class="stat-label">Completed</div>
                </div>
                <div class="phantom-stat-card">
                    <h4>Network Stores</h4>
                    <div class="stat-value">${this.systemStats.networkStats.totalStores}</div>
                    <div class="stat-label">Connected</div>
                </div>
                <div class="phantom-stat-card">
                    <h4>Verification Backlog</h4>
                    <div class="stat-value">${this.systemStats.systemHealth.verificationBacklog}</div>
                    <div class="stat-label">Pending</div>
                </div>
            </div>
            
            <div class="phantom-success">
                <h5>🔧 System Health</h5>
                <p>Network Connected: ${this.systemStats.systemHealth.networkConnected ? '✅ Yes' : '❌ No'}</p>
                <p>Last Sync: ${this.systemStats.systemHealth.lastSync ? new Date(this.systemStats.systemHealth.lastSync).toLocaleString() : 'Never'}</p>
                <p>Store: ${this.currentStore?.displayName || 'Unknown'}</p>
            </div>
        `;
        
        resultsContent.innerHTML = html;
    }

    /**
     * Show loading state
     */
    showLoading(message) {
        const resultsContent = document.getElementById('phantomResultsContent');
        if (resultsContent) {
            resultsContent.innerHTML = `<div class="phantom-loading">${message}</div>`;
        }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        // Loading will be replaced by results or error messages
    }

    /**
     * Show error message
     */
    showError(message) {
        const resultsContent = document.getElementById('phantomResultsContent');
        if (resultsContent) {
            resultsContent.innerHTML = `
                <div class="phantom-error">
                    <h5>❌ Error</h5>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        // Success messages are typically shown within the results
        console.log('Success:', message);
    }
}

// Initialize phantom inventory renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.phantomInventoryRenderer = new PhantomInventoryRenderer();
});

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhantomInventoryRenderer;
} 